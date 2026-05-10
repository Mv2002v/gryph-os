"""Vapi.ai outbound calling helpers."""
import os
from typing import Optional

import httpx

VAPI_API_KEY = os.environ.get("VAPI_API_KEY")
VAPI_BASE = "https://api.vapi.ai"
VAPI_DEFAULT_PHONE = os.environ.get("VAPI_DEFAULT_PHONE", "+17743349020")

_PHONE_NUMBER_ID_CACHE: Optional[str] = None


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {VAPI_API_KEY}",
        "Content-Type": "application/json",
    }


async def list_phone_numbers() -> list:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{VAPI_BASE}/phone-number", headers=_headers())
        r.raise_for_status()
        return r.json()


async def get_default_phone_number_id() -> Optional[str]:
    global _PHONE_NUMBER_ID_CACHE
    if _PHONE_NUMBER_ID_CACHE:
        return _PHONE_NUMBER_ID_CACHE
    nums = await list_phone_numbers()
    if not nums:
        return None
    target = VAPI_DEFAULT_PHONE.replace(" ", "")
    chosen = None
    for n in nums:
        if (n.get("number") or "").replace(" ", "") == target:
            chosen = n
            break
    chosen = chosen or nums[0]
    _PHONE_NUMBER_ID_CACHE = chosen.get("id")
    return _PHONE_NUMBER_ID_CACHE


def _build_quiz_prompt(quiz: dict, student_name: Optional[str] = None) -> str:
    questions = quiz.get("questions", [])[:10]
    lines = []
    for i, q in enumerate(questions, 1):
        q_text = q.get("q", "")
        choices = q.get("choices", [])
        ans_idx = q.get("answerIndex", 0)
        if 0 <= ans_idx < len(choices):
            correct = choices[ans_idx]
        else:
            correct = ""
        explain = q.get("explanation", "")
        lines.append(
            f"Question {i}: {q_text}\n"
            f"  Options: {', '.join(choices)}\n"
            f"  Correct answer: {correct}\n"
            f"  Explanation: {explain}"
        )
    quiz_block = "\n\n".join(lines)
    name_line = f"The student's name is {student_name}. " if student_name else ""
    topic = quiz.get("topic") or quiz.get("course") or "the assigned material"
    return (
        f"You are a friendly, encouraging tutor calling a student to quiz them on {topic}. "
        f"{name_line}Speak naturally and conversationally. "
        "Ask each question one at a time. After they answer, briefly tell them whether they "
        "got it right or wrong, give a one-line explanation, then move to the next question. "
        "Keep your responses short (one to three sentences). Do not read out the multiple-choice "
        "letter options unless the student asks. Accept answers in natural language. "
        "After all questions, give a short summary of how they did and end the call warmly.\n\n"
        f"Quiz to administer:\n{quiz_block}"
    )


async def place_outbound_call(
    customer_phone: str,
    quiz: dict,
    student_name: Optional[str] = None,
    server_url: Optional[str] = None,
) -> dict:
    """Place an outbound call with a transient assistant configured for this quiz."""
    phone_number_id = await get_default_phone_number_id()
    if not phone_number_id:
        raise RuntimeError("No Vapi phone number available")

    system_prompt = _build_quiz_prompt(quiz, student_name)
    first_msg = (
        f"Hey{(' ' + student_name) if student_name else ''}! It's your StudySpark tutor. "
        f"Ready for a quick quiz? Let's start with the first question."
    )

    assistant = {
        "model": {
            "provider": "openai",
            "model": "gpt-4o-mini",
            "temperature": 0.45,
            "messages": [{"role": "system", "content": system_prompt}],
        },
        "voice": {"provider": "vapi", "voiceId": "Elliot"},
        "firstMessage": first_msg,
        "firstMessageMode": "assistant-speaks-first",
        "endCallMessage": "Great work! Talk soon — keep studying!",
        "transcriber": {"provider": "deepgram", "model": "nova-2", "language": "en"},
    }
    if server_url:
        assistant["serverMessages"] = ["end-of-call-report", "transcript"]
        assistant["server"] = {"url": server_url}

    payload = {
        "phoneNumberId": phone_number_id,
        "customer": {"number": customer_phone, "numberE164CheckEnabled": True},
        "assistant": assistant,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(f"{VAPI_BASE}/call/phone", headers=_headers(), json=payload)
        if r.status_code >= 400:
            raise RuntimeError(f"Vapi error {r.status_code}: {r.text}")
        return r.json()


async def get_call(call_id: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{VAPI_BASE}/call/{call_id}", headers=_headers())
        r.raise_for_status()
        return r.json()
