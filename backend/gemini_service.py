"""Gemini-powered helpers: extract deadlines from syllabus PDF."""
import base64
import json
import os
import re

from google import genai
from google.genai import types

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
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
    client = genai.Client(api_key=EMERGENT_LLM_KEY)

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part(
                        inline_data=types.Blob(
                            mime_type="application/pdf",
                            data=base64.b64encode(pdf_bytes).decode("utf-8"),
                        )
                    ),
                    types.Part(text="Extract all deadlines from this syllabus and return strict JSON only."),
                ],
            )
        ],
        config=types.GenerateContentConfig(system_instruction=_SYSTEM_EXTRACT),
    )
    return _parse_json(response.text)
