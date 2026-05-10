"""Gemini-powered helpers: extract deadlines from syllabus, generate quizzes."""
import json
import os
import re
from typing import Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-pro")


def _parse_json(raw: str) -> dict:
    s = (raw or "").strip()
    m = re.search(r"```(?:json)?\s*(.+?)\s*```", s, re.DOTALL)
    if m:
        s = m.group(1).strip()
    if not s.startswith("{"):
        left = s.find("{")
        right = s.rfind("}")
        if left != -1 and right != -1:
            s = s[left : right + 1]
    return json.loads(s)


async def extract_deadlines(pdf_path: str, session_id: str) -> dict:
    """Extract structured deadlines/events JSON from a syllabus PDF."""
    system = (
        "You are an academic scheduling assistant. Extract every deadline, exam, "
        "quiz, project, and reading deadline from the supplied syllabus PDF. "
        "Return ONLY valid JSON (no markdown, no commentary) with this schema: "
        "{\"course\": {\"code\": str, \"title\": str, \"term\": str|null, \"instructor\": str|null}, "
        "\"events\": [ {\"title\": str, \"type\": one of "
        "[\"assignment\",\"quiz\",\"midterm\",\"final\",\"project\",\"reading\",\"other\"], "
        "\"dueDateISO\": str (YYYY-MM-DD), \"notes\": str|null } ] } "
        "If the year is missing in the syllabus, infer the most likely upcoming year. "
        "Sort events ascending by dueDateISO."
    )
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system)
        .with_model("gemini", GEMINI_MODEL)
    )
    file_attach = FileContentWithMimeType(file_path=pdf_path, mime_type="application/pdf")
    msg = UserMessage(
        text="Extract all deadlines from this syllabus and return strict JSON only.",
        file_contents=[file_attach],
    )
    raw = await chat.send_message(msg)
    return _parse_json(raw)


async def generate_quiz(
    file_path: Optional[str],
    raw_text: Optional[str],
    topic: Optional[str],
    num_questions: int,
    difficulty: str,
    session_id: str,
) -> dict:
    """Generate a multiple-choice quiz JSON from study material (file or text)."""
    system = (
        "You are a tutor that creates short multiple-choice quizzes from study material. "
        f"Generate exactly {num_questions} questions at {difficulty} difficulty. "
        "Return ONLY valid JSON (no markdown, no commentary). Schema: "
        "{ \"course\": str|null, \"topic\": str, \"questions\": [ "
        "{ \"q\": str, \"choices\": [str, str, str, str], \"answerIndex\": int (0-3), "
        "\"explanation\": str, \"difficulty\": one of [\"easy\",\"medium\",\"hard\"] } ] }. "
        "Vary question wording. Make distractors plausible. Each correct answer must "
        "be unambiguously the best."
    )
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system)
        .with_model("gemini", GEMINI_MODEL)
    )
    text_part = (
        f"Create a {num_questions}-question multiple-choice quiz at {difficulty} difficulty"
        + (f" focusing on the topic: {topic}." if topic else ".")
        + " Return strict JSON only."
    )
    if raw_text:
        text_part += "\n\nStudy material:\n" + raw_text[:12000]
    file_contents = []
    if file_path:
        ext = (file_path.split(".")[-1] or "").lower()
        mime = {
            "pdf": "application/pdf",
            "txt": "text/plain",
            "md": "text/plain",
            "csv": "text/csv",
        }.get(ext, "application/pdf")
        file_contents.append(FileContentWithMimeType(file_path=file_path, mime_type=mime))
    msg = UserMessage(text=text_part, file_contents=file_contents or None)
    raw = await chat.send_message(msg)
    return _parse_json(raw)


async def score_call_transcript(transcript: str, quiz: dict, session_id: str) -> dict:
    """Score a Vapi voice quiz call transcript against the original quiz JSON."""
    system = (
        "You are an academic grader scoring a voice quiz call. Given the transcript "
        "of a phone call and the original quiz (with correct answers), determine for "
        "each question whether the student answered correctly. The student answered in "
        "natural language so accept paraphrases. Return ONLY valid JSON with this schema: "
        "{ \"score\": int (number correct), \"total\": int, \"percent\": int (0-100), "
        "\"summary\": str (1-2 sentence overall feedback), "
        "\"weak_topics\": [str, ...], "
        "\"strong_topics\": [str, ...], "
        "\"breakdown\": [ { \"index\": int, \"q\": str, \"correct_answer\": str, "
        "\"student_answer\": str|null, \"is_correct\": bool, \"note\": str } ] }"
    )
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system)
        .with_model("gemini", GEMINI_MODEL)
    )
    qs = quiz.get("questions", [])
    quiz_compact = {
        "topic": quiz.get("topic"),
        "course": quiz.get("course"),
        "questions": [
            {
                "index": i,
                "q": q.get("q"),
                "correct_answer": (q.get("choices", []) or [None])[
                    max(0, min(len(q.get("choices", [])) - 1, q.get("answerIndex", 0)))
                ]
                if q.get("choices")
                else None,
                "explanation": q.get("explanation"),
            }
            for i, q in enumerate(qs)
        ],
    }
    text = (
        "Score this voice quiz call. Return strict JSON.\n\n"
        f"Quiz JSON:\n{json.dumps(quiz_compact, ensure_ascii=False)}\n\n"
        f"Call transcript:\n{transcript[:14000]}"
    )
    raw = await chat.send_message(UserMessage(text=text))
    return _parse_json(raw)
