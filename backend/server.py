"""StudySpark backend — Cognito auth + S3 storage + Vapi webhook + scoring + scheduler."""
import asyncio
import logging
import os
import tempfile
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
    UploadFile,
)
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from auth import (  # noqa: E402
    DEMO_EMAIL,
    DEMO_USER_ID,
    LoginReq,
    SignupReq,
    get_current_principal,
    get_current_user_id,
    hash_password,
    make_local_token,
    new_user_id,
)
from aws_clients import (  # noqa: E402
    aws_status,
    cognito_admin_update_user,
    cognito_get_user,
    cognito_login,
    cognito_signup,
    s3_delete,
    s3_get_bytes,
    s3_presigned_url,
    s3_upload_bytes,
    S3_BUCKET,
)
from gemini_service import extract_deadlines, generate_quiz, score_call_transcript  # noqa: E402
from vapi_service import get_call, get_default_phone_number_id, place_outbound_call  # noqa: E402

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
log = logging.getLogger("studyspark")

# --- DB --------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "studyspark")]

# --- App -------------------------------------------------------------------
app = FastAPI(title="StudySpark API")
api = APIRouter(prefix="/api")

UPLOAD_TMP = Path("/tmp/studyspark_uploads")
UPLOAD_TMP.mkdir(parents=True, exist_ok=True)

PUBLIC_BACKEND_URL = os.environ.get("PUBLIC_BACKEND_URL")  # Optional override


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
    when_ts: float  # unix epoch
    status: str = "scheduled"  # scheduled | running | done | failed | canceled
    note: Optional[str] = None
    created_at: float = Field(default_factory=lambda: time.time())
    fired_at: Optional[float] = None
    session_id: Optional[str] = None


COURSE_COLORS = ["sky", "lime", "sun", "pink", "teal", "violet", "orange"]


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


async def ensure_demo_user():
    existing = await db.users.find_one({"_id": DEMO_USER_ID})
    if not existing:
        await db.users.insert_one({
            "_id": DEMO_USER_ID,
            "email": DEMO_EMAIL,
            "name": "Demo Student",
            "phone": None,
            "password_hash": hash_password("demo1234"),
            "auth_source": "local",
            "created_at": time.time(),
        })


async def get_or_create_user_from_principal(principal: dict) -> dict:
    """Resolve / lazy-create a Mongo user record from a token principal."""
    uid = principal["user_id"]
    doc = await db.users.find_one({"_id": uid})
    if doc:
        return doc
    # First time we see this Cognito user — create local profile
    email = principal.get("email")
    await db.users.insert_one({
        "_id": uid,
        "email": email,
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


# === Auth ==================================================================
@api.post("/auth/signup")
async def auth_signup(req: SignupReq):
    # Try Cognito first; fallback to local for demos / no AWS.
    try:
        cognito_signup(req.email, req.password, req.name)
        tokens = cognito_login(req.email, req.password)
    except Exception as e:
        msg = str(e)
        if "UsernameExistsException" in msg:
            raise HTTPException(409, "Email already registered")
        log.exception("Cognito signup failed")
        raise HTTPException(500, f"Signup failed: {msg}")

    # Materialise local user using id_token sub
    import jwt as pyjwt
    payload = pyjwt.decode(tokens["id_token"], options={"verify_signature": False})
    uid = payload["sub"]
    if not await db.users.find_one({"_id": uid}):
        await db.users.insert_one({
            "_id": uid, "email": req.email, "name": req.name,
            "phone": None, "auth_source": "cognito",
            "created_at": time.time(),
        })
    return {
        "token": tokens["id_token"],  # Frontend uses ID token as bearer
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "user": {"id": uid, "email": req.email, "name": req.name, "phone": None,
                 "auth_source": "cognito"},
    }


@api.post("/auth/login")
async def auth_login(req: LoginReq):
    try:
        tokens = cognito_login(req.email, req.password)
    except Exception as e:
        msg = str(e)
        if "NotAuthorizedException" in msg or "UserNotFoundException" in msg:
            raise HTTPException(401, "Invalid credentials")
        log.exception("Cognito login failed")
        raise HTTPException(401, "Invalid credentials")
    import jwt as pyjwt
    payload = pyjwt.decode(tokens["id_token"], options={"verify_signature": False})
    uid = payload["sub"]
    if not await db.users.find_one({"_id": uid}):
        await db.users.insert_one({
            "_id": uid, "email": req.email, "name": payload.get("name"),
            "phone": payload.get("phone_number"), "auth_source": "cognito",
            "created_at": time.time(),
        })
    user = await db.users.find_one({"_id": uid})
    return {
        "token": tokens["id_token"],
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "user": {
            "id": uid,
            "email": user["email"],
            "name": user.get("name"),
            "phone": user.get("phone"),
            "auth_source": "cognito",
        },
    }


@api.post("/auth/demo")
async def auth_demo():
    """Demo bypass — issues a LOCAL JWT (not Cognito)."""
    await ensure_demo_user()
    token = make_local_token(DEMO_USER_ID, DEMO_EMAIL)
    doc = await db.users.find_one({"_id": DEMO_USER_ID})
    return {
        "token": token,
        "user": {
            "id": DEMO_USER_ID,
            "email": doc["email"],
            "name": doc.get("name"),
            "phone": doc.get("phone"),
            "auth_source": "local-demo",
        },
    }


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

    # Mirror to Cognito for non-demo users
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
    return {
        "id": uid,
        "email": user["email"],
        "name": user.get("name"),
        "phone": user.get("phone"),
        "auth_source": user.get("auth_source"),
    }


# === Syllabus upload + deadline extraction =================================
@api.post("/syllabi/upload")
async def upload_syllabus(file: UploadFile = File(...),
                          uid: str = Depends(get_current_user_id)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported for syllabi")
    content = await file.read()
    if len(content) > 12 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 12MB)")

    # Store in S3
    upload = None
    try:
        upload = s3_upload_bytes(
            content, prefix=f"syllabi/{uid}", filename=file.filename,
            content_type="application/pdf",
        )
    except Exception as e:  # noqa: BLE001
        log.exception("S3 upload failed")
        raise HTTPException(500, f"S3 upload failed: {e}")

    # Write locally for Gemini multimodal
    fid = str(uuid.uuid4())
    fpath = UPLOAD_TMP / f"{fid}.pdf"
    fpath.write_bytes(content)

    try:
        data = await extract_deadlines(str(fpath), session_id=f"syllabus-{uid}-{fid}")
    except Exception as e:  # noqa: BLE001
        log.exception("Gemini deadline extraction failed")
        raise HTTPException(500, f"Could not extract deadlines: {e}")
    finally:
        try: fpath.unlink()
        except Exception: pass

    course_info = data.get("course") or {}
    course_code = (course_info.get("code") or file.filename.rsplit(".", 1)[0])[:32]
    course = await get_or_create_course(
        uid, course_code, course_info.get("title"),
        course_info.get("term"), course_info.get("instructor"),
    )
    events_in = data.get("events") or []
    saved = []
    for ev in events_in:
        try:
            due = (ev.get("dueDateISO") or "").strip()
            if not due:
                continue
            obj = DeadlineEvent(
                user_id=uid, course_id=course.id, course_code=course.code,
                course_title=course.title,
                title=str(ev.get("title") or "Untitled")[:200],
                type=str(ev.get("type") or "other"),
                due_date=due, notes=ev.get("notes"),
            )
            await db.events.insert_one({**obj.model_dump(), "_id": obj.id})
            saved.append(obj.model_dump())
        except Exception as e:  # noqa: BLE001
            log.warning("Skipping bad event %s: %s", ev, e)

    # Persist syllabus pointer record (for downloads)
    syllabus_id = str(uuid.uuid4())
    await db.syllabi.insert_one({
        "_id": syllabus_id,
        "id": syllabus_id,
        "user_id": uid,
        "course_id": course.id,
        "filename": file.filename,
        "s3_key": upload["key"],
        "s3_bucket": upload["bucket"],
        "size": upload["size"],
        "uploaded_at": time.time(),
    })

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
    # delete S3 syllabus blobs
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


# === Quiz generation ========================================================
@api.post("/quiz/generate")
async def quiz_generate(
    background: BackgroundTasks,
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
    fpath: Optional[str] = None
    src_name = None
    s3_key = None
    if file:
        content = await file.read()
        if len(content) > 15 * 1024 * 1024:
            raise HTTPException(413, "File too large (max 15MB)")
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "pdf"
        # Upload to S3
        try:
            up = s3_upload_bytes(
                content, prefix=f"materials/{uid}", filename=file.filename,
                content_type="application/pdf" if ext == "pdf" else "text/plain",
            )
            s3_key = up["key"]
        except Exception as e:  # noqa: BLE001
            log.exception("S3 material upload failed")
            raise HTTPException(500, f"S3 upload failed: {e}")
        fid = str(uuid.uuid4())
        local = UPLOAD_TMP / f"{fid}.{ext}"
        local.write_bytes(content)
        fpath = str(local)
        src_name = file.filename

    num_questions = max(3, min(15, int(num_questions)))
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"

    try:
        data = await generate_quiz(
            file_path=fpath, raw_text=text, topic=topic,
            num_questions=num_questions, difficulty=difficulty,
            session_id=f"quiz-{uid}-{uuid.uuid4()}",
        )
    except Exception as e:  # noqa: BLE001
        log.exception("Gemini quiz generation failed")
        raise HTTPException(500, f"Could not generate quiz: {e}")
    finally:
        if fpath:
            try: Path(fpath).unlink()
            except Exception: pass

    quiz = Quiz(
        user_id=uid, title=title or (data.get("topic") or "Untitled Quiz"),
        course=course or data.get("course"), topic=topic or data.get("topic"),
        difficulty=difficulty, questions=data.get("questions") or [],
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
class StartCallReq(BaseModel):
    quiz_id: str
    phone: str
    name: Optional[str] = None


def _public_webhook_url() -> Optional[str]:
    # Use explicitly configured backend URL if present.
    if PUBLIC_BACKEND_URL:
        return PUBLIC_BACKEND_URL.rstrip("/") + "/api/webhooks/vapi"
    return None


async def _maybe_score(session_id: str):
    """Run Gemini scoring once we have transcript + quiz."""
    sess = await db.call_sessions.find_one({"_id": session_id})
    if not sess or sess.get("score") is not None:
        return
    if not sess.get("transcript"):
        return
    quiz = await db.quizzes.find_one({"_id": sess["quiz_id"], "user_id": sess["user_id"]})
    if not quiz:
        return
    try:
        scoring = await score_call_transcript(
            sess["transcript"], _scrub(dict(quiz)), session_id=f"score-{session_id}"
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


async def _poll_call(call_id: str, session_id: str):
    last_status = None
    started_at = time.time()
    for _ in range(180):
        try:
            info = await get_call(call_id)
            status_v = info.get("status") or info.get("endedReason") or last_status
            update = {"raw": info}
            if status_v and status_v != last_status:
                update["status"] = status_v
                last_status = status_v
            for fld_in, fld_out in [("startedAt", "started_at"), ("endedAt", "ended_at")]:
                if info.get(fld_in):
                    try:
                        update[fld_out] = datetime.fromisoformat(
                            info[fld_in].replace("Z", "+00:00")
                        ).timestamp()
                    except Exception: pass
            artifact = info.get("artifact") or {}
            if artifact.get("transcript"):
                update["transcript"] = artifact["transcript"]
            analysis = info.get("analysis") or {}
            if analysis.get("summary"):
                update["summary"] = analysis["summary"]
            await db.call_sessions.update_one({"_id": session_id}, {"$set": update})
            if status_v in ("ended", "failed", "canceled"):
                if update.get("transcript"):
                    await _maybe_score(session_id)
                break
        except Exception as e:  # noqa: BLE001
            log.warning("poll_call error: %s", e)
        await asyncio.sleep(5)
    if time.time() - started_at > 120 and last_status not in ("ended", "failed"):
        await db.call_sessions.update_one(
            {"_id": session_id}, {"$set": {"status": last_status or "timeout"}}
        )


async def _start_call_internal(uid: str, quiz_id: str, phone: str,
                               name: Optional[str], background: BackgroundTasks) -> dict:
    quiz = await db.quizzes.find_one({"_id": quiz_id, "user_id": uid})
    if not quiz:
        raise HTTPException(404, "Quiz not found")
    if not (phone or "").startswith("+") or len(phone) < 10:
        raise HTTPException(400, "Phone must be in E.164 format (e.g. +14155552671)")

    user_doc = await db.users.find_one({"_id": uid}) or {}
    student_name = name or user_doc.get("name")

    try:
        result = await place_outbound_call(
            customer_phone=phone, quiz=_scrub(dict(quiz)),
            student_name=student_name, server_url=_public_webhook_url(),
        )
    except Exception as e:  # noqa: BLE001
        log.exception("vapi place_outbound_call failed")
        raise HTTPException(502, f"Vapi error: {e}")

    session = CallSession(
        user_id=uid, quiz_id=quiz_id, quiz_title=quiz.get("title") or "Quiz",
        phone=phone, vapi_call_id=result.get("id"),
        status=result.get("status") or "queued", raw=result,
    )
    await db.call_sessions.insert_one({**session.model_dump(), "_id": session.id})
    if result.get("id"):
        background.add_task(_poll_call, result["id"], session.id)
    return {"session_id": session.id, "call_id": result.get("id"), "status": session.status}


@api.post("/call/start")
async def call_start(req: StartCallReq, background: BackgroundTasks,
                     uid: str = Depends(get_current_user_id)):
    return await _start_call_internal(uid, req.quiz_id, req.phone, req.name, background)


@api.get("/calls")
async def list_calls(uid: str = Depends(get_current_user_id)):
    docs = await db.call_sessions.find({"user_id": uid}).sort("created_at", -1).to_list(100)
    return [_scrub(d) for d in docs]


@api.get("/calls/{session_id}")
async def get_call_session(session_id: str, uid: str = Depends(get_current_user_id)):
    doc = await db.call_sessions.find_one({"_id": session_id, "user_id": uid})
    if not doc:
        raise HTTPException(404, "Call session not found")
    vapi_call_id = doc.get("vapi_call_id")
    if vapi_call_id and doc.get("status") not in ("ended", "failed", "canceled"):
        try:
            info = await get_call(vapi_call_id)
            update = {"raw": info}
            status_v = info.get("status") or doc.get("status")
            if status_v: update["status"] = status_v
            artifact = info.get("artifact") or {}
            if artifact.get("transcript"): update["transcript"] = artifact["transcript"]
            analysis = info.get("analysis") or {}
            if analysis.get("summary"): update["summary"] = analysis["summary"]
            await db.call_sessions.update_one({"_id": session_id}, {"$set": update})
            doc.update(update)
            if status_v in ("ended", "failed") and update.get("transcript") and doc.get("score") is None:
                asyncio.create_task(_maybe_score(session_id))
        except Exception as e:  # noqa: BLE001
            log.warning("get_call refresh failed: %s", e)
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


# === Vapi webhook ===========================================================
@app.post("/api/webhooks/vapi")
async def vapi_webhook(request: Request):
    """Receives end-of-call-report from Vapi and persists transcript + triggers scoring."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    msg = body.get("message") or body
    mtype = msg.get("type")
    call_obj = msg.get("call") or {}
    call_id = call_obj.get("id") or msg.get("callId")
    log.info("Vapi webhook: type=%s call_id=%s", mtype, call_id)
    if not call_id:
        return {"ok": True}
    sess = await db.call_sessions.find_one({"vapi_call_id": call_id})
    if not sess:
        return {"ok": True}

    update: dict = {}
    artifact = msg.get("artifact") or {}
    if artifact.get("transcript"):
        update["transcript"] = artifact["transcript"]
    if msg.get("transcript") and not update.get("transcript"):
        update["transcript"] = msg["transcript"]
    analysis = msg.get("analysis") or {}
    if analysis.get("summary"):
        update["summary"] = analysis["summary"]
    if mtype == "end-of-call-report":
        update["status"] = "ended"
        update["ended_at"] = time.time()
    if call_obj.get("status"):
        update.setdefault("status", call_obj["status"])
    update["raw"] = msg
    await db.call_sessions.update_one({"_id": sess["_id"]}, {"$set": update})
    if update.get("transcript") and sess.get("score") is None:
        asyncio.create_task(_maybe_score(sess["_id"]))
    return {"ok": True}


# === Phase 4: Scheduling ====================================================
class ScheduleReq(BaseModel):
    quiz_id: str
    phone: str
    when_iso: str  # "2026-05-10T19:00:00" or with offset
    note: Optional[str] = None


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
    except Exception as e:
        raise HTTPException(400, f"Bad when_iso: {e}")
    if ts < time.time() - 60:
        raise HTTPException(400, "Scheduled time is in the past")
    sched = ScheduledCall(
        user_id=uid, quiz_id=req.quiz_id, quiz_title=quiz.get("title") or "Quiz",
        phone=req.phone, when_ts=ts, note=req.note,
    )
    await db.scheduled_calls.insert_one({**sched.model_dump(), "_id": sched.id})
    return _scrub(sched.model_dump())


@api.get("/schedule")
async def list_schedule(uid: str = Depends(get_current_user_id)):
    docs = await db.scheduled_calls.find({"user_id": uid}).sort("when_ts", 1).to_list(200)
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


_SCHEDULER_TASK = None


async def _scheduler_loop():
    """Background loop that fires due scheduled calls."""
    log.info("scheduler loop started")
    while True:
        try:
            now = time.time()
            cur = db.scheduled_calls.find({
                "status": "scheduled", "when_ts": {"$lte": now},
            })
            async for sched in cur:
                # Mark running
                await db.scheduled_calls.update_one(
                    {"_id": sched["_id"], "status": "scheduled"},
                    {"$set": {"status": "running"}},
                )
                # Re-read to ensure we won
                row = await db.scheduled_calls.find_one({"_id": sched["_id"]})
                if not row or row.get("status") != "running":
                    continue
                try:
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
                    # Also run any background tasks the placement registered
                    for t in bg.tasks:
                        asyncio.create_task(t())
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
    except Exception:
        pass
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
    await ensure_demo_user()
    global _SCHEDULER_TASK
    _SCHEDULER_TASK = asyncio.create_task(_scheduler_loop())
    log.info("StudySpark backend ready (Cognito=%s, S3=%s)",
             bool(os.environ.get("COGNITO_USER_POOL_ID")), bool(S3_BUCKET))


@app.on_event("shutdown")
async def on_shutdown():
    if _SCHEDULER_TASK:
        _SCHEDULER_TASK.cancel()
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"], allow_headers=["*"],
)
