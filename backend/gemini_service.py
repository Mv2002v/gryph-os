"""Gemini-powered helpers: extract deadlines from syllabus PDF."""
import asyncio
import base64
import json
import os
import re

from google import genai
from google.genai import types

# Accept both key names for flexibility
GEMINI_API_KEY = (
    os.environ.get("GEMINI_API_KEY")
    or os.environ.get("EMERGENT_LLM_KEY")
)
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

_SYSTEM_EXTRACT = (
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


def _parse_json(raw: str) -> dict:
    s = (raw or "").strip()
    m = re.search(r"```(?:json)?\s*(.+?)\s*```", s, re.DOTALL)
    if m:
        s = m.group(1).strip()
    if not s.startswith("{"):
        left = s.find("{")
        right = s.rfind("}")
        if left != -1 and right != -1:
            s = s[left: right + 1]
    return json.loads(s)


async def extract_deadlines(pdf_path: str, session_id: str) -> dict:
    """Extract structured deadlines/events JSON from a syllabus PDF."""
    if not GEMINI_API_KEY:
        raise RuntimeError("No Gemini API key configured (set GEMINI_API_KEY in .env)")

    client = genai.Client(api_key=GEMINI_API_KEY)

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part(
                    inline_data=types.Blob(
                        mime_type="application/pdf",
                        data=pdf_b64,
                    )
                ),
                types.Part(text="Extract all deadlines from this syllabus and return strict JSON only."),
            ],
        )
    ]
    config = types.GenerateContentConfig(system_instruction=_SYSTEM_EXTRACT)

    # Run the synchronous Gemini call off the event loop thread
    def _call():
        return client.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config=config,
        )

    response = await asyncio.to_thread(_call)
    return _parse_json(response.text)
