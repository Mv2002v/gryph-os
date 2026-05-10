"""StudySpark backend — auth + syllabus extraction + quiz gen + Vapi calling."""
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
    User,
    get_current_user_id,
    hash_password,
    make_token,
    new_user_id,
    verify_password,
)
from gemini_service import extract_deadlines, generate_quiz  # noqa: E402
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
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "studyspark")]

# --- App -------------------------------------------------------------------
app = FastAPI(title="StudySpark API")
api = APIRouter(prefix="/api")

UPLOAD_DIR = Path("/tmp/studyspark_uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# === Models ================================================================
class DeadlineEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    course_id: str
    course_code: str
    course_title: Optional[str] = None
    title: str
    type: str
    due_date: str  # ISO YYYY-MM-DD
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
    raw: Optional[dict] = None


COURSE_COLORS = ["sky", "lime", "sun", "pink", "teal", "violet", "orange"]


# === Helpers ===============================================================
async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.courses.create_index([("user_id", 1), ("code", 1)], unique=True)
    await db.events.create_index([("user_id", 1), ("due_date", 1)])
    await db.quizzes.create_index([("user_id", 1), ("created_at", -1)])
    await db.call_sessions.create_index([("user_id", 1), ("created_at", -1)])


async def ensure_demo_user():
    existing = await db.users.find_one({"_id": DEMO_USER_ID})
    if not existing:
        await db.users.insert_one(
            {
                "_id": DEMO_USER_ID,
                "email": DEMO_EMAIL,
                "name": "Demo Student",
                "phone": None,
                "password_hash": hash_password("demo1234"),
                "created_at": time.time(),
            }
        )


async def get_or_create_course(
    user_id: str, code: str, title: Optional[str], term: Optional[str], instructor: Optional[str]
) -> Course:
    safe_code = (code or "GENERAL").strip().upper()[:32]
    doc = await db.courses.find_one({"user_id": user_id, "code": safe_code})
    if doc:
        return Course(**{k: v for k, v in doc.items() if k != "_id"})
    count = await db.courses.count_documents({"user_id": user_id})
    course = Course(
        user_id=user_id,
        code=safe_code,
        title=title,
        term=term,
        instructor=instructor,
        color_index=count % len(COURSE_COLORS),
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
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(409, "Email already registered")
    uid = new_user_id()
    await db.users.insert_one(
        {
            "_id": uid,
            "email": req.email,
            "name": req.name,
            "phone": None,
            "password_hash": hash_password(req.password),
            "created_at": time.time(),
        }
    )
    token = make_token(uid, req.email)
    return {
        "token": token,
        "user": {"id": uid, "email": req.email, "name": req.name, "phone": None},
    }


@api.post("/auth/login")
async def auth_login(req: LoginReq):
    doc = await db.users.find_one({"email": req.email})
    if not doc or not verify_password(req.password, doc.get("password_hash", "")):
        raise HTTPException(401, "Invalid credentials")
    uid = doc["_id"]
    token = make_token(uid, req.email)
    return {
        "token": token,
        "user": {
            "id": uid,
            "email": doc["email"],
            "name": doc.get("name"),
            "phone": doc.get("phone"),
        },
    }


@api.post("/auth/demo")
async def auth_demo():
    await ensure_demo_user()
    token = make_token(DEMO_USER_ID, DEMO_EMAIL)
    doc = await db.users.find_one({"_id": DEMO_USER_ID})
    return {
        "token": token,
        "user": {
            "id": DEMO_USER_ID,
            "email": doc["email"],
            "name": doc.get("name"),
            "phone": doc.get("phone"),
        },
    }


@api.get("/auth/me")
async def auth_me(uid: str = Depends(get_current_user_id)):
    doc = await db.users.find_one({"_id": uid})
    if not doc:
        raise HTTPException(404, "User not found")
    return {
        "id": uid,
        "email": doc["email"],
        "name": doc.get("name"),
        "phone": doc.get("phone"),
    }


@api.put("/auth/me")
async def auth_update_me(
    body: dict, uid: str = Depends(get_current_user_id)
):
    update = {}
    if "name" in body:
        update["name"] = (body["name"] or "").strip() or None
    if "phone" in body:
        update["phone"] = (body["phone"] or "").strip() or None
    if not update:
        raise HTTPException(400, "No fields to update")
    await db.users.update_one({"_id": uid}, {"$set": update})
    doc = await db.users.find_one({"_id": uid})
    return {
        "id": uid,
        "email": doc["email"],
        "name": doc.get("name"),
        "phone": doc.get("phone"),
    }


# === Syllabus upload + deadline extraction =================================
@api.post("/syllabi/upload")
async def upload_syllabus(
    file: UploadFile = File(...),
    uid: str = Depends(get_current_user_id),
):
    if not file.filename.lower().endswith((".pdf",)):
        raise HTTPException(400, "Only PDF files are supported for syllabi")
    content = await file.read()
    if len(content) > 12 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 12MB)")
    fid = str(uuid.uuid4())
    fpath = UPLOAD_DIR / f"{fid}.pdf"
    fpath.write_bytes(content)

    try:
        data = await extract_deadlines(str(fpath), session_id=f"syllabus-{uid}-{fid}")
    except Exception as e:  # noqa: BLE001
        log.exception("Gemini deadline extraction failed")
        raise HTTPException(500, f"Could not extract deadlines: {e}")

    course_info = data.get("course") or {}
    course_code = (course_info.get("code") or file.filename.rsplit(".", 1)[0])[:32]
    course = await get_or_create_course(
        uid,
        course_code,
        course_info.get("title"),
        course_info.get("term"),
        course_info.get("instructor"),
    )
    events_in = data.get("events") or []
    saved = []
    for ev in events_in:
        try:
            due = (ev.get("dueDateISO") or "").strip()
            if not due:
                continue
            obj = DeadlineEvent(
                user_id=uid,
                course_id=course.id,
                course_code=course.code,
                course_title=course.title,
                title=str(ev.get("title") or "Untitled")[:200],
                type=str(ev.get("type") or "other"),
                due_date=due,
                notes=ev.get("notes"),
            )
            await db.events.insert_one({**obj.model_dump(), "_id": obj.id})
            saved.append(obj.model_dump())
        except Exception as e:  # noqa: BLE001
            log.warning("Skipping bad event %s: %s", ev, e)
    return {
        "course": course.model_dump(),
        "events": saved,
        "counts": {"events": len(saved)},
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
    if res.deleted_count == 0:
        raise HTTPException(404, "Course not found")
    return {"ok": True}


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
    if file:
        content = await file.read()
        if len(content) > 15 * 1024 * 1024:
            raise HTTPException(413, "File too large (max 15MB)")
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "pdf"
        fid = str(uuid.uuid4())
        local = UPLOAD_DIR / f"{fid}.{ext}"
        local.write_bytes(content)
        fpath = str(local)
        src_name = file.filename

    num_questions = max(3, min(15, int(num_questions)))
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"

    try:
        data = await generate_quiz(
            file_path=fpath,
            raw_text=text,
            topic=topic,
            num_questions=num_questions,
            difficulty=difficulty,
            session_id=f"quiz-{uid}-{uuid.uuid4()}",
        )
    except Exception as e:  # noqa: BLE001
        log.exception("Gemini quiz generation failed")
        raise HTTPException(500, f"Could not generate quiz: {e}")

    quiz = Quiz(
        user_id=uid,
        title=title or (data.get("topic") or "Untitled Quiz"),
        course=course or data.get("course"),
        topic=topic or data.get("topic"),
        difficulty=difficulty,
        questions=data.get("questions") or [],
        source_filename=src_name,
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
    res = await db.quizzes.delete_one({"_id": quiz_id, "user_id": uid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Quiz not found")
    return {"ok": True}


# === Vapi calling ===========================================================
class StartCallReq(BaseModel):
    quiz_id: str
    phone: str
    name: Optional[str] = None


async def _poll_call(call_id: str, session_id: str):
    """Poll Vapi until the call ends. Persist transcript + status."""
    last_status = None
    started_at = time.time()
    for attempt in range(180):  # up to ~15 minutes
        try:
            info = await get_call(call_id)
            status = info.get("status") or info.get("endedReason") or last_status
            update = {"raw": info}
            if status and status != last_status:
                update["status"] = status
                last_status = status
            if info.get("startedAt"):
                try:
                    update["started_at"] = (
                        datetime.fromisoformat(info["startedAt"].replace("Z", "+00:00")).timestamp()
                    )
                except Exception:  # noqa: BLE001
                    pass
            if info.get("endedAt"):
                try:
                    update["ended_at"] = (
                        datetime.fromisoformat(info["endedAt"].replace("Z", "+00:00")).timestamp()
                    )
                except Exception:  # noqa: BLE001
                    pass
            artifact = info.get("artifact") or {}
            if artifact.get("transcript"):
                update["transcript"] = artifact.get("transcript")
            analysis = info.get("analysis") or {}
            if analysis.get("summary"):
                update["summary"] = analysis.get("summary")
            await db.call_sessions.update_one({"_id": session_id}, {"$set": update})
            if status in ("ended", "failed", "canceled"):
                break
        except Exception as e:  # noqa: BLE001
            log.warning("poll_call error: %s", e)
        await asyncio.sleep(5)
    if time.time() - started_at > 120 and last_status not in ("ended", "failed"):
        await db.call_sessions.update_one(
            {"_id": session_id}, {"$set": {"status": last_status or "timeout"}}
        )


@api.post("/call/start")
async def call_start(
    req: StartCallReq,
    background: BackgroundTasks,
    uid: str = Depends(get_current_user_id),
):
    quiz = await db.quizzes.find_one({"_id": req.quiz_id, "user_id": uid})
    if not quiz:
        raise HTTPException(404, "Quiz not found")
    if not (req.phone or "").startswith("+") or len(req.phone) < 10:
        raise HTTPException(400, "Phone must be in E.164 format (e.g. +14155552671)")

    user_doc = await db.users.find_one({"_id": uid}) or {}
    name = req.name or user_doc.get("name")

    try:
        result = await place_outbound_call(
            customer_phone=req.phone,
            quiz=_scrub(dict(quiz)),
            student_name=name,
        )
    except Exception as e:  # noqa: BLE001
        log.exception("vapi place_outbound_call failed")
        raise HTTPException(502, f"Vapi error: {e}")

    session = CallSession(
        user_id=uid,
        quiz_id=req.quiz_id,
        quiz_title=quiz.get("title") or "Quiz",
        phone=req.phone,
        vapi_call_id=result.get("id"),
        status=result.get("status") or "queued",
        raw=result,
    )
    await db.call_sessions.insert_one({**session.model_dump(), "_id": session.id})

    if result.get("id"):
        background.add_task(_poll_call, result["id"], session.id)

    return {
        "session_id": session.id,
        "call_id": result.get("id"),
        "status": session.status,
    }


@api.get("/calls")
async def list_calls(uid: str = Depends(get_current_user_id)):
    docs = await db.call_sessions.find({"user_id": uid}).sort("created_at", -1).to_list(100)
    return [_scrub(d) for d in docs]


@api.get("/calls/{session_id}")
async def get_call_session(session_id: str, uid: str = Depends(get_current_user_id)):
    doc = await db.call_sessions.find_one({"_id": session_id, "user_id": uid})
    if not doc:
        raise HTTPException(404, "Call session not found")
    # Refresh from Vapi for up-to-date status if still active
    vapi_call_id = doc.get("vapi_call_id")
    if vapi_call_id and doc.get("status") not in ("ended", "failed", "canceled"):
        try:
            info = await get_call(vapi_call_id)
            update = {"raw": info}
            status = info.get("status") or doc.get("status")
            if status:
                update["status"] = status
            artifact = info.get("artifact") or {}
            if artifact.get("transcript"):
                update["transcript"] = artifact["transcript"]
            analysis = info.get("analysis") or {}
            if analysis.get("summary"):
                update["summary"] = analysis["summary"]
            await db.call_sessions.update_one({"_id": session_id}, {"$set": update})
            doc.update(update)
        except Exception as e:  # noqa: BLE001
            log.warning("get_call refresh failed: %s", e)
    return _scrub(doc)


# === Health / debug ========================================================
@api.get("/")
async def root():
    return {"app": "StudySpark", "ok": True}


@api.get("/health")
async def health():
    pid = None
    try:
        pid = await get_default_phone_number_id()
    except Exception:  # noqa: BLE001
        pass
    return {
        "ok": True,
        "vapi_phone_id": pid,
        "gemini_model": os.environ.get("GEMINI_MODEL", "gemini-2.5-pro"),
    }


# === Lifecycle ==============================================================
@app.on_event("startup")
async def on_startup():
    await ensure_indexes()
    await ensure_demo_user()
    log.info("StudySpark backend ready")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
