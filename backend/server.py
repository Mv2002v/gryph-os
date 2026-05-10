"""StudySpark backend — Cognito auth + S3 + Vapi + scoring + scheduler."""
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
    generate_quiz,
    score_call_transcript,
)
from vapi_service import (  # noqa: E402
    get_call,
    get_default_phone_number_id,
    place_outbound_call,
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

UPLOAD_TMP = Path("/tmp/studyspark_uploads")
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
    created_at: float = Field(default_factory=lambda: time.time())


class Quiz(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    course: Optional[str] = None
    topic: Optional[str] = None
    difficulty: str = "medium"
    questions: List[dict] = Field(default_factory=list)
    source_filename: Optional[str] = None
    s3_key: Optional[str] = None
    created_at: float = Field(default_factory=lambda: time.time())


class CallSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    quiz_id: str
    quiz_title: str
    phone: str
    vapi_call_id: Optional[str] = None
    status: str = "queued"
    created_at: float = Field(default_factory=lambda: time.time())
    started_at: Optional[float] = None
    ended_at: Optional[float] = None
    transcript: Optional[str] = None
    summary: Optional[str] = None
    score: Optional[int] = None
    total: Optional[int] = None
    percent: Optional[int] = None
    weak_topics: Optional[List[str]] = None
    strong_topics: Optional[List[str]] = None
    breakdown: Optional[List[dict]] = None
    raw: Optional[dict] = None


class ScheduledCall(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    quiz_id: str
    quiz_title: str
    phone: str
    when_ts: float
    status: str = "scheduled"
    note: Optional[str] = None
    created_at: float = Field(default_factory=lambda: time.time())
    fired_at: Optional[float] = None
    session_id: Optional[str] = None


class StartCallReq(BaseModel):
    quiz_id: str
    phone: str
    name: Optional[str] = None


class ScheduleReq(BaseModel):
    quiz_id: str
    phone: str
    when_iso: str
    note: Optional[str] = None


# === Helpers ===============================================================
async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.courses.create_index([("user_id", 1), ("code", 1)], unique=True)
    await db.events.create_index([("user_id", 1), ("due_date", 1)])
    await db.quizzes.create_index([("user_id", 1), ("created_at", -1)])
    await db.call_sessions.create_index([("user_id", 1), ("created_at", -1)])
    await db.call_sessions.create_index([("vapi_call_id", 1)], sparse=True)
    await db.scheduled_calls.create_index([("when_ts", 1)])
    await db.scheduled_calls.create_index([("user_id", 1)])


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


async def get_or_create_course(uid, code, title, term, instructor) -> Course:
    safe_code = (code or "GENERAL").strip().upper()[:32]
    doc = await db.courses.find_one({"user_id": uid, "code": safe_code})
    if doc:
        return Course(**{k: v for k, v in doc.items() if k != "_id"})
    count = await db.courses.count_documents({"user_id": uid})
    course = Course(
        user_id=uid, code=safe_code, title=title, term=term,
        instructor=instructor, color_index=count % len(COURSE_COLORS),
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
        samesite="lax",
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
    }


@api.post("/auth/signup")
async def auth_signup(req: SignupReq, response: Response):
    tokens: dict = {}
    try:
        cognito_signup(req.email, req.password, req.name)
        tokens = cognito_login(req.email, req.password)
    except Exception as e:
        msg = str(e)
        if "UsernameExistsException" in msg:
            raise HTTPException(409, "Email already registered") from e
        log.exception("Cognito signup failed")
        raise HTTPException(500, f"Signup failed: {msg}") from e

    import jwt as pyjwt
    payload = pyjwt.decode(tokens["id_token"], options={"verify_signature": False})
    uid = payload["sub"]
    user = await _ensure_local_user_for(uid, req.email, name=req.name)
    _set_session_cookie(response, tokens["id_token"])
    return {
        "token": tokens["id_token"],  # also returned for back-compat
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
    }


@api.put("/auth/me")
async def auth_update_me(body: dict, principal: dict = Depends(get_current_principal)):
    uid = principal["user_id"]
    update = {}
    if "name" in body:
        update["name"] = (body["name"] or "").strip() or None
    if "phone" in body:
        update["phone"] = (body["phone"] or "").strip() or None
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
        log.exception("Gemini deadline extraction failed")
        raise HTTPException(500, f"Could not extract deadlines: {e}") from e
    finally:
        try:
            local_path.unlink()
        except FileNotFoundError:
            pass


async def _persist_events(uid: str, course: Course, events_in: list) -> list:
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
        await db.events.insert_one({**obj.model_dump(), "_id": obj.id})
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


@api.post("/syllabi/upload")
async def upload_syllabus(file: UploadFile = File(...),
                          uid: str = Depends(get_current_user_id)):
    content = await _read_uploaded_pdf(file, max_bytes=12 * 1024 * 1024)
    upload = _persist_pdf_to_s3(uid, file.filename, content)
    local_path = _stash_pdf_locally(content)
    data = await _extract_with_gemini(
        local_path, session_id=f"syllabus-{uid}-{uuid.uuid4()}"
    )

    course_info = data.get("course") or {}
    course_code = (
        course_info.get("code") or file.filename.rsplit(".", 1)[0]
    )[:32]
    course = await get_or_create_course(
        uid, course_code,
        course_info.get("title"),
        course_info.get("term"),
        course_info.get("instructor"),
    )
    saved = await _persist_events(uid, course, data.get("events"))
    await _record_syllabus_pointer(uid, course.id, file.filename, upload)
    return {
        "course": course.model_dump(),
        "events": saved,
        "counts": {"events": len(saved)},
        "s3": {"bucket": upload["bucket"], "key": upload["key"]},
    }


@api.get("/courses")
async def list_courses(uid: str = Depends(get_current_user_id)):
    docs = await db.courses.find({"user_id": uid}).to_list(200)
    return [_scrub(d) for d in docs]


@api.get("/events")
async def list_events(uid: str = Depends(get_current_user_id)):
    docs = await db.events.find({"user_id": uid}).sort("due_date", 1).to_list(2000)
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


# === Quiz generation ========================================================
class QuizGenInput(BaseModel):
    text: Optional[str] = None
    title: Optional[str] = None
    topic: Optional[str] = None
    course: Optional[str] = None
    num_questions: int = 5
    difficulty: str = "medium"


def _normalize_quiz_input(text, num, diff) -> tuple:
    n = max(3, min(15, int(num)))
    d = diff if diff in ("easy", "medium", "hard") else "medium"
    return (text, n, d)


async def _persist_material_to_s3(uid: str, file: UploadFile) -> tuple:
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 15MB)")
    ext = (
        file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "pdf"
    )
    try:
        up = s3_upload_bytes(
            content, prefix=f"materials/{uid}", filename=file.filename,
            content_type="application/pdf" if ext == "pdf" else "text/plain",
        )
    except Exception as e:  # noqa: BLE001
        log.exception("S3 material upload failed")
        raise HTTPException(500, f"S3 upload failed: {e}") from e
    local = UPLOAD_TMP / f"{uuid.uuid4()}.{ext}"
    local.write_bytes(content)
    return (up["key"], local)


@api.post("/quiz/generate")
async def quiz_generate(
    file: Optional[UploadFile] = File(default=None),
    text: Optional[str] = Form(default=None),
    title: Optional[str] = Form(default=None),
    topic: Optional[str] = Form(default=None),
    course: Optional[str] = Form(default=None),
    num_questions: int = Form(default=5),
    difficulty: str = Form(default="medium"),
    uid: str = Depends(get_current_user_id),
):
    if not file and not (text and text.strip()):
        raise HTTPException(400, "Provide either a file or text")

    s3_key: Optional[str] = None
    local_path: Optional[Path] = None
    src_name: Optional[str] = None
    if file:
        s3_key, local_path = await _persist_material_to_s3(uid, file)
        src_name = file.filename

    text_clean, n, d = _normalize_quiz_input(text, num_questions, difficulty)

    try:
        data = await generate_quiz(
            file_path=str(local_path) if local_path else None,
            raw_text=text_clean, topic=topic,
            num_questions=n, difficulty=d,
            session_id=f"quiz-{uid}-{uuid.uuid4()}",
        )
    except Exception as e:  # noqa: BLE001
        log.exception("Gemini quiz generation failed")
        raise HTTPException(500, f"Could not generate quiz: {e}") from e
    finally:
        if local_path:
            try:
                local_path.unlink()
            except FileNotFoundError:
                pass

    quiz = Quiz(
        user_id=uid, title=title or (data.get("topic") or "Untitled Quiz"),
        course=course or data.get("course"), topic=topic or data.get("topic"),
        difficulty=d, questions=data.get("questions") or [],
        source_filename=src_name, s3_key=s3_key,
    )
    await db.quizzes.insert_one({**quiz.model_dump(), "_id": quiz.id})
    return quiz.model_dump()


@api.get("/quizzes")
async def list_quizzes(uid: str = Depends(get_current_user_id)):
    docs = await db.quizzes.find({"user_id": uid}).sort("created_at", -1).to_list(200)
    return [_scrub(d) for d in docs]


@api.get("/quizzes/{quiz_id}")
async def get_quiz(quiz_id: str, uid: str = Depends(get_current_user_id)):
    doc = await db.quizzes.find_one({"_id": quiz_id, "user_id": uid})
    if not doc:
        raise HTTPException(404, "Quiz not found")
    return _scrub(doc)


@api.delete("/quizzes/{quiz_id}")
async def delete_quiz(quiz_id: str, uid: str = Depends(get_current_user_id)):
    doc = await db.quizzes.find_one({"_id": quiz_id, "user_id": uid})
    if not doc:
        raise HTTPException(404, "Quiz not found")
    if doc.get("s3_key"):
        s3_delete(doc["s3_key"])
    await db.quizzes.delete_one({"_id": quiz_id, "user_id": uid})
    return {"ok": True}


# === Vapi calling ===========================================================
def _public_webhook_url() -> Optional[str]:
    if PUBLIC_BACKEND_URL:
        return PUBLIC_BACKEND_URL.rstrip("/") + "/api/webhooks/vapi"
    return None


async def _maybe_score(session_id: str):
    sess = await db.call_sessions.find_one({"_id": session_id})
    if not sess or sess.get("score") is not None or not sess.get("transcript"):
        return
    quiz = await db.quizzes.find_one(
        {"_id": sess["quiz_id"], "user_id": sess["user_id"]}
    )
    if not quiz:
        return
    try:
        scoring = await score_call_transcript(
            sess["transcript"], _scrub(dict(quiz)),
            session_id=f"score-{session_id}",
        )
    except Exception as e:  # noqa: BLE001
        log.warning("scoring failed for %s: %s", session_id, e)
        return
    update = {
        "score": scoring.get("score"),
        "total": scoring.get("total"),
        "percent": scoring.get("percent"),
        "summary": scoring.get("summary") or sess.get("summary"),
        "weak_topics": scoring.get("weak_topics"),
        "strong_topics": scoring.get("strong_topics"),
        "breakdown": scoring.get("breakdown"),
    }
    await db.call_sessions.update_one({"_id": session_id}, {"$set": update})


def _build_call_update(info: dict, last_status: Optional[str]) -> tuple:
    """Translate a Vapi /call/{id} response into a Mongo update dict."""
    update: dict = {"raw": info}
    status_v = info.get("status") or info.get("endedReason") or last_status
    if status_v and status_v != last_status:
        update["status"] = status_v
    started = _safe_iso_to_ts(info.get("startedAt"))
    if started is not None:
        update["started_at"] = started
    ended = _safe_iso_to_ts(info.get("endedAt"))
    if ended is not None:
        update["ended_at"] = ended
    artifact = info.get("artifact") or {}
    if artifact.get("transcript"):
        update["transcript"] = artifact["transcript"]
    analysis = info.get("analysis") or {}
    if analysis.get("summary"):
        update["summary"] = analysis["summary"]
    return update, status_v


async def _poll_call(call_id: str, session_id: str):
    last_status: Optional[str] = None
    started_at = time.time()
    for _ in range(180):
        try:
            info = await get_call(call_id)
            update, status_v = _build_call_update(info, last_status)
            last_status = update.get("status", last_status)
            await db.call_sessions.update_one({"_id": session_id}, {"$set": update})
            if status_v in ("ended", "failed", "canceled"):
                if update.get("transcript"):
                    await _maybe_score(session_id)
                return
        except Exception as e:  # noqa: BLE001
            log.warning("poll_call error: %s", e)
        await asyncio.sleep(5)

    if time.time() - started_at > 120 and last_status not in ("ended", "failed"):
        await db.call_sessions.update_one(
            {"_id": session_id},
            {"$set": {"status": last_status or "timeout"}},
        )


async def _start_call_internal(uid: str, quiz_id: str, phone: str,
                               name: Optional[str],
                               background: BackgroundTasks) -> dict:
    quiz = await db.quizzes.find_one({"_id": quiz_id, "user_id": uid})
    if not quiz:
        raise HTTPException(404, "Quiz not found")
    if not (phone or "").startswith("+") or len(phone) < 10:
        raise HTTPException(400, "Phone must be in E.164 format (e.g. +14155552671)")

    user_doc = await db.users.find_one({"_id": uid}) or {}
    student_name = name or user_doc.get("name")

    result: dict = {}
    try:
        result = await place_outbound_call(
            customer_phone=phone, quiz=_scrub(dict(quiz)),
            student_name=student_name, server_url=_public_webhook_url(),
        )
    except Exception as e:  # noqa: BLE001
        log.exception("vapi place_outbound_call failed")
        raise HTTPException(502, f"Vapi error: {e}") from e

    session = CallSession(
        user_id=uid, quiz_id=quiz_id, quiz_title=quiz.get("title") or "Quiz",
        phone=phone, vapi_call_id=result.get("id"),
        status=result.get("status") or "queued", raw=result,
    )
    await db.call_sessions.insert_one({**session.model_dump(), "_id": session.id})
    if result.get("id"):
        background.add_task(_poll_call, result["id"], session.id)
    return {
        "session_id": session.id,
        "call_id": result.get("id"),
        "status": session.status,
    }


@api.post("/call/start")
async def call_start(req: StartCallReq, background: BackgroundTasks,
                     uid: str = Depends(get_current_user_id)):
    return await _start_call_internal(uid, req.quiz_id, req.phone, req.name, background)


@api.get("/calls")
async def list_calls(uid: str = Depends(get_current_user_id)):
    docs = await db.call_sessions.find(
        {"user_id": uid}
    ).sort("created_at", -1).to_list(100)
    return [_scrub(d) for d in docs]


async def _refresh_call_session(doc: dict) -> dict:
    """Pull the latest from Vapi for an active call session."""
    vapi_call_id = doc.get("vapi_call_id")
    if not vapi_call_id:
        return doc
    if doc.get("status") in ("ended", "failed", "canceled"):
        return doc
    try:
        info = await get_call(vapi_call_id)
    except Exception as e:  # noqa: BLE001
        log.warning("get_call refresh failed: %s", e)
        return doc
    update, status_v = _build_call_update(info, doc.get("status"))
    await db.call_sessions.update_one({"_id": doc["_id"]}, {"$set": update})
    doc.update(update)
    if (
        status_v in ("ended", "failed")
        and update.get("transcript")
        and doc.get("score") is None
    ):
        asyncio.create_task(_maybe_score(doc["_id"]))
    return doc


@api.get("/calls/{session_id}")
async def get_call_session(session_id: str,
                           uid: str = Depends(get_current_user_id)):
    doc = await db.call_sessions.find_one({"_id": session_id, "user_id": uid})
    if not doc:
        raise HTTPException(404, "Call session not found")
    doc = await _refresh_call_session(doc)
    return _scrub(doc)


@api.post("/calls/{session_id}/score")
async def force_score(session_id: str, uid: str = Depends(get_current_user_id)):
    doc = await db.call_sessions.find_one({"_id": session_id, "user_id": uid})
    if not doc:
        raise HTTPException(404, "Call session not found")
    if not doc.get("transcript"):
        raise HTTPException(400, "No transcript yet")
    await _maybe_score(session_id)
    fresh = await db.call_sessions.find_one({"_id": session_id})
    return _scrub(fresh)


@api.delete("/calls/{session_id}")
async def delete_call(session_id: str, uid: str = Depends(get_current_user_id)):
    res = await db.call_sessions.delete_one({"_id": session_id, "user_id": uid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Call session not found")
    return {"ok": True}


# === Account / data management =============================================
@api.get("/account/summary")
async def account_summary(uid: str = Depends(get_current_user_id)):
    return {
        "courses": await db.courses.count_documents({"user_id": uid}),
        "events": await db.events.count_documents({"user_id": uid}),
        "syllabi": await db.syllabi.count_documents({"user_id": uid}),
        "quizzes": await db.quizzes.count_documents({"user_id": uid}),
        "calls": await db.call_sessions.count_documents({"user_id": uid}),
        "scheduled": await db.scheduled_calls.count_documents(
            {"user_id": uid, "status": "scheduled"}
        ),
    }


@api.post("/account/reset")
async def account_reset(uid: str = Depends(get_current_user_id)):
    async for doc in db.syllabi.find({"user_id": uid}):
        if doc.get("s3_key"):
            s3_delete(doc["s3_key"])
    async for doc in db.quizzes.find({"user_id": uid}):
        if doc.get("s3_key"):
            s3_delete(doc["s3_key"])

    counts = {
        "events": (await db.events.delete_many({"user_id": uid})).deleted_count,
        "courses": (await db.courses.delete_many({"user_id": uid})).deleted_count,
        "syllabi": (await db.syllabi.delete_many({"user_id": uid})).deleted_count,
        "quizzes": (await db.quizzes.delete_many({"user_id": uid})).deleted_count,
        "calls": (await db.call_sessions.delete_many({"user_id": uid})).deleted_count,
        "scheduled": (
            await db.scheduled_calls.delete_many({"user_id": uid})
        ).deleted_count,
    }
    return {"ok": True, "deleted": counts}


# === Vapi webhook ===========================================================
def _build_webhook_update(msg: dict) -> dict:
    update: dict = {"raw": msg}
    artifact = msg.get("artifact") or {}
    transcript = artifact.get("transcript") or msg.get("transcript")
    if transcript:
        update["transcript"] = transcript
    analysis = msg.get("analysis") or {}
    if analysis.get("summary"):
        update["summary"] = analysis["summary"]
    if msg.get("type") == "end-of-call-report":
        update["status"] = "ended"
        update["ended_at"] = time.time()
    call_status = (msg.get("call") or {}).get("status")
    if call_status:
        update.setdefault("status", call_status)
    return update


@app.post("/api/webhooks/vapi")
async def vapi_webhook(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    msg = body.get("message") or body
    call_obj = msg.get("call") or {}
    call_id = call_obj.get("id") or msg.get("callId")
    log.info("Vapi webhook: type=%s call_id=%s", msg.get("type"), call_id)
    if not call_id:
        return {"ok": True}
    sess = await db.call_sessions.find_one({"vapi_call_id": call_id})
    if not sess:
        return {"ok": True}
    update = _build_webhook_update(msg)
    await db.call_sessions.update_one({"_id": sess["_id"]}, {"$set": update})
    if update.get("transcript") and sess.get("score") is None:
        asyncio.create_task(_maybe_score(sess["_id"]))
    return {"ok": True}


# === Phase 4: Scheduling ====================================================
@api.post("/schedule")
async def schedule_call(req: ScheduleReq, uid: str = Depends(get_current_user_id)):
    quiz = await db.quizzes.find_one({"_id": req.quiz_id, "user_id": uid})
    if not quiz:
        raise HTTPException(404, "Quiz not found")
    try:
        when = datetime.fromisoformat(req.when_iso.replace("Z", "+00:00"))
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        ts = when.timestamp()
    except (ValueError, AttributeError) as e:
        raise HTTPException(400, f"Bad when_iso: {e}") from e
    if ts < time.time() - 60:
        raise HTTPException(400, "Scheduled time is in the past")
    sched = ScheduledCall(
        user_id=uid, quiz_id=req.quiz_id,
        quiz_title=quiz.get("title") or "Quiz",
        phone=req.phone, when_ts=ts, note=req.note,
    )
    await db.scheduled_calls.insert_one({**sched.model_dump(), "_id": sched.id})
    return _scrub(sched.model_dump())


@api.get("/schedule")
async def list_schedule(uid: str = Depends(get_current_user_id)):
    docs = await db.scheduled_calls.find(
        {"user_id": uid}
    ).sort("when_ts", 1).to_list(200)
    return [_scrub(d) for d in docs]


@api.delete("/schedule/{sid}")
async def cancel_schedule(sid: str, uid: str = Depends(get_current_user_id)):
    res = await db.scheduled_calls.update_one(
        {"_id": sid, "user_id": uid, "status": "scheduled"},
        {"$set": {"status": "canceled"}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Scheduled call not found or already fired")
    return {"ok": True}


_SCHEDULER_TASK: Optional[asyncio.Task] = None


async def _fire_scheduled_call(sched: dict) -> None:
    bg = BackgroundTasks()
    user_doc = await db.users.find_one({"_id": sched["user_id"]}) or {}
    res = await _start_call_internal(
        sched["user_id"], sched["quiz_id"], sched["phone"],
        user_doc.get("name"), bg,
    )
    await db.scheduled_calls.update_one(
        {"_id": sched["_id"]},
        {"$set": {
            "status": "done",
            "fired_at": time.time(),
            "session_id": res.get("session_id"),
        }},
    )
    for t in bg.tasks:
        asyncio.create_task(t())


async def _scheduler_loop():
    log.info("scheduler loop started")
    while True:
        try:
            now = time.time()
            cur = db.scheduled_calls.find(
                {"status": "scheduled", "when_ts": {"$lte": now}}
            )
            async for sched in cur:
                claimed = await db.scheduled_calls.update_one(
                    {"_id": sched["_id"], "status": "scheduled"},
                    {"$set": {"status": "running"}},
                )
                if claimed.modified_count == 0:
                    continue
                try:
                    await _fire_scheduled_call(sched)
                except Exception as e:  # noqa: BLE001
                    log.warning("scheduled call %s failed: %s", sched["_id"], e)
                    await db.scheduled_calls.update_one(
                        {"_id": sched["_id"]},
                        {"$set": {
                            "status": "failed",
                            "fired_at": time.time(),
                            "note": str(e)[:200],
                        }},
                    )
        except Exception as e:  # noqa: BLE001
            log.warning("scheduler loop error: %s", e)
        await asyncio.sleep(20)


# === Health / debug ========================================================
@api.get("/")
async def root():
    return {"app": "StudySpark", "ok": True}


@api.get("/health")
async def health():
    pid = None
    try:
        pid = await get_default_phone_number_id()
    except Exception as e:  # noqa: BLE001
        log.warning("health: vapi phone id fetch failed: %s", e)
    return {
        "ok": True,
        "vapi_phone_id": pid,
        "gemini_model": os.environ.get("GEMINI_MODEL", "gemini-2.5-pro"),
        "aws": aws_status(),
    }


# === Lifecycle ==============================================================
@app.on_event("startup")
async def on_startup():
    await ensure_indexes()
    global _SCHEDULER_TASK
    _SCHEDULER_TASK = asyncio.create_task(_scheduler_loop())
    log.info(
        "StudySpark backend ready (Cognito=%s, S3=%s)",
        bool(os.environ.get("COGNITO_USER_POOL_ID")), bool(S3_BUCKET),
    )


@app.on_event("shutdown")
async def on_shutdown():
    if _SCHEDULER_TASK:
        _SCHEDULER_TASK.cancel()
    mongo_client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
