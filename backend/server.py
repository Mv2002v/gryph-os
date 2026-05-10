"""StudySpark backend — Cognito auth + S3 + deadline extraction."""
import asyncio
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from auth import (  # noqa: E402
    LoginReq,
    SESSION_COOKIE,
    SignupReq,
    get_current_principal,
    get_current_user_id,
)
from aws_clients import (  # noqa: E402
    aws_status,
    cognito_admin_update_user,
    cognito_login,
    cognito_signup,
    s3_delete,
    s3_presigned_url,
    s3_upload_bytes,
    S3_BUCKET,
)
from gemini_service import (  # noqa: E402
    extract_deadlines,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
log = logging.getLogger("studyspark")

# --- DB --------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ.get("DB_NAME", "studyspark")]

# --- App -------------------------------------------------------------------
app = FastAPI(title="StudySpark API")
api = APIRouter(prefix="/api")

import tempfile
UPLOAD_TMP = Path(tempfile.gettempdir()) / "studyspark_uploads"
UPLOAD_TMP.mkdir(parents=True, exist_ok=True)

PUBLIC_BACKEND_URL = os.environ.get("PUBLIC_BACKEND_URL")
COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30

COURSE_COLORS = ["sky", "lime", "sun", "pink", "teal", "violet", "orange"]


# === Models ================================================================
class DeadlineEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    course_id: str
    course_code: str
    course_title: Optional[str] = None
    title: str
    type: str
    due_date: str
    notes: Optional[str] = None
    created_at: float = Field(default_factory=lambda: time.time())


class Course(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    code: str
    title: Optional[str] = None
    term: Optional[str] = None
    instructor: Optional[str] = None
    color_index: int = 0
    semester_id: Optional[str] = None
    created_at: float = Field(default_factory=lambda: time.time())


class SemesterCreate(BaseModel):
    name: str          # "S1", "S2", "S3"
    label: str         # "Fall 2024", "Winter 2025", etc.
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    university: Optional[str] = None
    degree: Optional[str] = None
    current_semester: Optional[str] = None   # e.g. "S1", "S2", "S3"
    target_gpa: Optional[float] = None
    onboarded: Optional[bool] = None


# === Helpers ===============================================================
async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.courses.create_index([("user_id", 1), ("code", 1)], unique=True)
    await db.events.create_index([("user_id", 1), ("due_date", 1)])
    await db.semesters.create_index([("user_id", 1), ("created_at", 1)])


async def get_or_create_user_from_principal(principal: dict) -> dict:
    uid = principal["user_id"]
    doc = await db.users.find_one({"_id": uid})
    if doc:
        return doc
    await db.users.insert_one({
        "_id": uid,
        "email": principal.get("email"),
        "name": None,
        "phone": None,
        "auth_source": principal.get("source", "cognito"),
        "created_at": time.time(),
    })
    return await db.users.find_one({"_id": uid})


async def get_or_create_course(uid, code, title, term, instructor,
                               semester_id: Optional[str] = None) -> Course:
    safe_code = (code or "GENERAL").strip().upper()[:32]
    doc = await db.courses.find_one({"user_id": uid, "code": safe_code})
    if doc:
        return Course(**{k: v for k, v in doc.items() if k != "_id"})
    count = await db.courses.count_documents({"user_id": uid})
    course = Course(
        user_id=uid, code=safe_code, title=title, term=term,
        instructor=instructor, color_index=count % len(COURSE_COLORS),
        semester_id=semester_id,
    )
    await db.courses.insert_one({**course.model_dump(), "_id": course.id})
    return course


def _scrub(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=COOKIE_TTL_SECONDS,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE, path="/")


def _safe_iso_to_ts(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except (ValueError, AttributeError):
        return None


# === Auth ==================================================================
async def _ensure_local_user_for(uid: str, email: str,
                                  name: Optional[str] = None,
                                  phone: Optional[str] = None) -> dict:
    user = await db.users.find_one({"_id": uid})
    if user:
        return user
    await db.users.insert_one({
        "_id": uid,
        "email": email,
        "name": name,
        "phone": phone,
        "auth_source": "cognito",
        "created_at": time.time(),
    })
    return await db.users.find_one({"_id": uid})


def _user_payload(uid: str, user_doc: dict) -> dict:
    return {
        "id": uid,
        "email": user_doc.get("email"),
        "name": user_doc.get("name"),
        "phone": user_doc.get("phone"),
        "auth_source": user_doc.get("auth_source", "cognito"),
        "university": user_doc.get("university"),
        "degree": user_doc.get("degree"),
        "current_semester": user_doc.get("current_semester"),
        "target_gpa": user_doc.get("target_gpa"),
        "onboarded": user_doc.get("onboarded", False),
    }


@api.post("/auth/signup")
async def auth_signup(req: SignupReq, response: Response):
    # Step 1: create the Cognito user
    try:
        cognito_signup(req.email, req.password, req.name)
    except Exception as e:
        msg = str(e)
        if "UsernameExistsException" in msg or "UsernameExists" in msg:
            raise HTTPException(
                409,
                "An account with this email already exists. Please sign in instead.",
            ) from e
        log.exception("Cognito signup failed")
        raise HTTPException(500, f"Signup failed: {msg}") from e

    # Step 2: auto-login (best-effort — user was already created so don't fail the
    # whole request if Cognito takes a moment to settle the new account state)
    try:
        tokens = cognito_login(req.email, req.password)
    except Exception as e:
        log.warning("Auto-login after signup failed (%s) — user must log in manually", e)
        return {"created": True, "auto_login": False,
                "message": "Account created. Please sign in with your credentials."}

    import jwt as pyjwt
    payload = pyjwt.decode(tokens["id_token"], options={"verify_signature": False})
    uid = payload["sub"]
    user = await _ensure_local_user_for(uid, req.email, name=req.name)
    _set_session_cookie(response, tokens["id_token"])
    return {
        "created": True,
        "auto_login": True,
        "token": tokens["id_token"],
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "user": _user_payload(uid, user),
    }


@api.post("/auth/login")
async def auth_login(req: LoginReq, response: Response):
    tokens: dict = {}
    try:
        tokens = cognito_login(req.email, req.password)
    except Exception as e:
        msg = str(e)
        if "NotAuthorizedException" in msg or "UserNotFoundException" in msg:
            raise HTTPException(401, "Invalid credentials") from e
        log.exception("Cognito login failed")
        raise HTTPException(401, "Invalid credentials") from e

    import jwt as pyjwt
    payload = pyjwt.decode(tokens["id_token"], options={"verify_signature": False})
    uid = payload["sub"]
    user = await _ensure_local_user_for(
        uid, req.email,
        name=payload.get("name"),
        phone=payload.get("phone_number"),
    )
    _set_session_cookie(response, tokens["id_token"])
    return {
        "token": tokens["id_token"],
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "user": _user_payload(uid, user),
    }


@api.post("/auth/logout")
async def auth_logout(response: Response):
    _clear_session_cookie(response)
    return {"ok": True}


@api.get("/auth/me")
async def auth_me(principal: dict = Depends(get_current_principal)):
    user = await get_or_create_user_from_principal(principal)
    return {
        "id": principal["user_id"],
        "email": user.get("email") or principal.get("email"),
        "name": user.get("name"),
        "phone": user.get("phone"),
        "auth_source": user.get("auth_source", principal.get("source")),
        "university": user.get("university"),
        "degree": user.get("degree"),
        "current_semester": user.get("current_semester"),
        "target_gpa": user.get("target_gpa"),
        "onboarded": user.get("onboarded", False),
    }


@api.put("/auth/me")
async def auth_update_me(body: UpdateProfileRequest,
                         principal: dict = Depends(get_current_principal)):
    uid = principal["user_id"]
    update = {}
    if body.name is not None:
        update["name"] = (body.name or "").strip() or None
    if body.phone is not None:
        update["phone"] = (body.phone or "").strip() or None
    if body.university is not None:
        update["university"] = body.university
    if body.degree is not None:
        update["degree"] = body.degree
    if body.current_semester is not None:
        update["current_semester"] = body.current_semester
    if body.target_gpa is not None:
        update["target_gpa"] = body.target_gpa
    if body.onboarded is not None:
        update["onboarded"] = body.onboarded
    if not update:
        raise HTTPException(400, "No fields to update")
    await db.users.update_one({"_id": uid}, {"$set": update})

    if principal.get("source") == "cognito" and principal.get("email"):
        try:
            cognito_admin_update_user(
                principal["email"],
                name=update.get("name"),
                phone_number=update.get("phone"),
            )
        except Exception as e:  # noqa: BLE001
            log.warning("cognito mirror update failed: %s", e)

    user = await db.users.find_one({"_id": uid})
    return _user_payload(uid, user)


# === Semesters =============================================================
@api.post("/semesters")
async def create_semester(body: SemesterCreate, uid: str = Depends(get_current_user_id)):
    doc = {
        "user_id": uid,
        "name": body.name,
        "label": body.label,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "created_at": datetime.utcnow().isoformat()
    }
    result = await db.semesters.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


@api.get("/semesters")
async def list_semesters(uid: str = Depends(get_current_user_id)):
    docs = await db.semesters.find({"user_id": uid}).sort("created_at", 1).to_list(None)
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@api.delete("/semesters/{semester_id}")
async def delete_semester(semester_id: str, uid: str = Depends(get_current_user_id)):
    from bson import ObjectId
    result = await db.semesters.delete_one({"_id": ObjectId(semester_id), "user_id": uid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Semester not found")
    return {"deleted": semester_id}


# === Syllabus upload + deadline extraction =================================
async def _read_uploaded_pdf(file: UploadFile, max_bytes: int) -> bytes:
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported for syllabi")
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(413, "File too large")
    return content


def _persist_pdf_to_s3(uid: str, filename: str, content: bytes) -> dict:
    try:
        return s3_upload_bytes(
            content, prefix=f"syllabi/{uid}", filename=filename,
            content_type="application/pdf",
        )
    except Exception as e:  # noqa: BLE001
        log.exception("S3 upload failed")
        raise HTTPException(500, f"S3 upload failed: {e}") from e


def _stash_pdf_locally(content: bytes) -> Path:
    path = UPLOAD_TMP / f"{uuid.uuid4()}.pdf"
    path.write_bytes(content)
    return path


async def _extract_with_gemini(local_path: Path, session_id: str) -> dict:
    try:
        return await extract_deadlines(str(local_path), session_id=session_id)
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        log.exception("Gemini deadline extraction failed")
        if "RESOURCE_EXHAUSTED" in msg or "429" in msg:
            raise HTTPException(
                503,
                "Gemini API quota exhausted. Create a new API key at "
                "aistudio.google.com/app/apikey using a fresh Google Cloud project, "
                "then set GEMINI_API_KEY in backend/.env"
            ) from e
        if "No Gemini API key" in msg:
            raise HTTPException(503, "GEMINI_API_KEY not set in backend/.env") from e
        raise HTTPException(500, f"Could not extract deadlines: {e}") from e
    finally:
        try:
            local_path.unlink()
        except FileNotFoundError:
            pass


async def _persist_events(uid: str, course: Course, events_in: list,
                          semester_id: Optional[str] = None) -> list:
    saved = []
    for ev in events_in or []:
        due = (ev.get("dueDateISO") or "").strip()
        if not due:
            continue
        try:
            obj = DeadlineEvent(
                user_id=uid, course_id=course.id, course_code=course.code,
                course_title=course.title,
                title=str(ev.get("title") or "Untitled")[:200],
                type=str(ev.get("type") or "other"),
                due_date=due, notes=ev.get("notes"),
            )
        except Exception as e:  # noqa: BLE001
            log.warning("Skipping bad event %s: %s", ev, e)
            continue
        event_doc = {**obj.model_dump(), "_id": obj.id}
        if semester_id:
            event_doc["semester_id"] = semester_id
        await db.events.insert_one(event_doc)
        saved.append(obj.model_dump())
    return saved


async def _record_syllabus_pointer(uid: str, course_id: str, filename: str,
                                    upload: dict) -> str:
    sid = str(uuid.uuid4())
    await db.syllabi.insert_one({
        "_id": sid,
        "id": sid,
        "user_id": uid,
        "course_id": course_id,
        "filename": filename,
        "s3_key": upload["key"],
        "s3_bucket": upload["bucket"],
        "size": upload["size"],
        "uploaded_at": time.time(),
    })
    return sid


class CourseCreate(BaseModel):
    code: str
    title: Optional[str] = None
    term: Optional[str] = None
    instructor: Optional[str] = None
    semester_id: Optional[str] = None


@api.post("/courses")
async def create_course_endpoint(body: CourseCreate,
                                 uid: str = Depends(get_current_user_id)):
    course = await get_or_create_course(
        uid, body.code, body.title, body.term, body.instructor,
        semester_id=body.semester_id,
    )
    return course.model_dump()


@api.post("/syllabi/upload")
async def upload_syllabus(file: UploadFile = File(...),
                          semester_id: Optional[str] = Form(None),
                          course_code: Optional[str] = Form(None),
                          course_title: Optional[str] = Form(None),
                          uid: str = Depends(get_current_user_id)):
    content = await _read_uploaded_pdf(file, max_bytes=12 * 1024 * 1024)
    upload = _persist_pdf_to_s3(uid, file.filename, content)
    local_path = _stash_pdf_locally(content)
    data = await _extract_with_gemini(
        local_path, session_id=f"syllabus-{uid}-{uuid.uuid4()}"
    )

    course_info = data.get("course") or {}
    # User-provided values take priority over AI-extracted ones
    final_code = (course_code or course_info.get("code") or file.filename.rsplit(".", 1)[0])[:32]
    final_title = course_title or course_info.get("title")
    course = await get_or_create_course(
        uid, final_code,
        final_title,
        course_info.get("term"),
        course_info.get("instructor"),
        semester_id=semester_id,
    )
    saved = await _persist_events(uid, course, data.get("events"),
                                  semester_id=semester_id)
    await _record_syllabus_pointer(uid, course.id, file.filename, upload)
    return {
        "course": course.model_dump(),
        "events": saved,
        "counts": {"events": len(saved)},
        "s3": {"bucket": upload["bucket"], "key": upload["key"]},
    }


@api.get("/courses")
async def list_courses(semester_id: Optional[str] = None,
                       uid: str = Depends(get_current_user_id)):
    query = {"user_id": uid}
    if semester_id:
        query["semester_id"] = semester_id
    docs = await db.courses.find(query).to_list(200)
    return [_scrub(d) for d in docs]


@api.get("/events")
async def list_events(semester_id: Optional[str] = None,
                      uid: str = Depends(get_current_user_id)):
    query = {"user_id": uid}
    if semester_id:
        query["semester_id"] = semester_id
    docs = await db.events.find(query).sort("due_date", 1).to_list(2000)
    return [_scrub(d) for d in docs]


@api.delete("/events/{event_id}")
async def delete_event(event_id: str, uid: str = Depends(get_current_user_id)):
    res = await db.events.delete_one({"_id": event_id, "user_id": uid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Event not found")
    return {"ok": True}


@api.delete("/courses/{course_id}")
async def delete_course(course_id: str, uid: str = Depends(get_current_user_id)):
    res = await db.courses.delete_one({"_id": course_id, "user_id": uid})
    await db.events.delete_many({"user_id": uid, "course_id": course_id})
    async for doc in db.syllabi.find({"user_id": uid, "course_id": course_id}):
        s3_delete(doc.get("s3_key"))
    await db.syllabi.delete_many({"user_id": uid, "course_id": course_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Course not found")
    return {"ok": True}


@api.get("/syllabi")
async def list_syllabi(uid: str = Depends(get_current_user_id)):
    docs = await db.syllabi.find({"user_id": uid}).sort("uploaded_at", -1).to_list(100)
    return [_scrub(d) for d in docs]


@api.get("/syllabi/{syllabus_id}/download")
async def syllabus_download(syllabus_id: str, uid: str = Depends(get_current_user_id)):
    doc = await db.syllabi.find_one({"_id": syllabus_id, "user_id": uid})
    if not doc:
        raise HTTPException(404, "Not found")
    return {"url": s3_presigned_url(doc["s3_key"], expires_in=600)}


@api.delete("/syllabi/{syllabus_id}")
async def delete_syllabus(syllabus_id: str, uid: str = Depends(get_current_user_id)):
    doc = await db.syllabi.find_one({"_id": syllabus_id, "user_id": uid})
    if not doc:
        raise HTTPException(404, "Not found")
    if doc.get("s3_key"):
        s3_delete(doc["s3_key"])
    await db.syllabi.delete_one({"_id": syllabus_id, "user_id": uid})
    return {"ok": True}


# === Account / data management =============================================
@api.get("/account/summary")
async def account_summary(uid: str = Depends(get_current_user_id)):
    return {
        "courses": await db.courses.count_documents({"user_id": uid}),
        "events": await db.events.count_documents({"user_id": uid}),
        "syllabi": await db.syllabi.count_documents({"user_id": uid}),
        "semesters": await db.semesters.count_documents({"user_id": uid}),
    }


@api.post("/account/reset")
async def account_reset(uid: str = Depends(get_current_user_id)):
    async for doc in db.syllabi.find({"user_id": uid}):
        if doc.get("s3_key"):
            s3_delete(doc["s3_key"])

    counts = {
        "events": (await db.events.delete_many({"user_id": uid})).deleted_count,
        "courses": (await db.courses.delete_many({"user_id": uid})).deleted_count,
        "syllabi": (await db.syllabi.delete_many({"user_id": uid})).deleted_count,
        "semesters": (await db.semesters.delete_many({"user_id": uid})).deleted_count,
    }
    return {"ok": True, "deleted": counts}


# === Health / debug ========================================================
@api.get("/")
async def root():
    return {"app": "StudySpark", "ok": True}


@api.get("/health")
async def health():
    return {
        "ok": True,
        "gemini_model": os.environ.get("GEMINI_MODEL", "gemini-2.5-pro"),
        "aws": aws_status(),
    }


# === Lifecycle ==============================================================
@app.on_event("startup")
async def on_startup():
    await ensure_indexes()
    log.info(
        "StudySpark backend ready (Cognito=%s, S3=%s)",
        bool(os.environ.get("COGNITO_USER_POOL_ID")), bool(S3_BUCKET),
    )


@app.on_event("shutdown")
async def on_shutdown():
    mongo_client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
