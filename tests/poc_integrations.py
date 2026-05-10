"""
POC Integration Test Script — Study Assistant
Tests three core integrations:
  1) Gemini extracts structured deadlines JSON from a syllabus PDF
  2) Gemini generates a structured quiz JSON from study material (PDF/text)
  3) Vapi.ai outbound call API: list phone numbers + place transient assistant call

Run: python /app/tests/poc_integrations.py
"""
import os
import sys
import json
import asyncio
import tempfile
from pathlib import Path
from dotenv import load_dotenv

# Load env from backend
load_dotenv("/app/backend/.env")

EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY")
VAPI_API_KEY = os.getenv("VAPI_API_KEY")
VAPI_DEFAULT_PHONE = os.getenv("VAPI_DEFAULT_PHONE", "+17743349020")
TEST_CALLEE_PHONE = os.environ.get("TEST_CALLEE_PHONE")  # OPTIONAL: real phone to call

print("=" * 70)
print(" Study Assistant — POC Integration Tests")
print("=" * 70)
print(f"EMERGENT_LLM_KEY present: {bool(EMERGENT_LLM_KEY)}")
print(f"VAPI_API_KEY present:     {bool(VAPI_API_KEY)}")
print(f"VAPI_DEFAULT_PHONE:       {VAPI_DEFAULT_PHONE}")
print(f"TEST_CALLEE_PHONE:        {TEST_CALLEE_PHONE or '(not set — will skip placing real call)'}")
print()


# ---------------------------------------------------------------------------
# Sample syllabus PDF and study material generator
# ---------------------------------------------------------------------------
def make_sample_syllabus_pdf(path: str) -> None:
    from reportlab.lib.pagesizes import LETTER
    from reportlab.pdfgen import canvas

    c = canvas.Canvas(path, pagesize=LETTER)
    w, h = LETTER
    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, h - 72, "MATH 201 — Calculus II  (Spring 2026)")
    c.setFont("Helvetica", 11)
    lines = [
        "Instructor: Dr. Jane Doe   |   T/Th 10:00 - 11:30   |   Room HALL 204",
        "",
        "Course Schedule & Important Deadlines:",
        "  • Homework 1 due  :  February 10, 2026",
        "  • Quiz 1          :  February 17, 2026",
        "  • Homework 2 due  :  February 24, 2026",
        "  • Midterm Exam    :  March 5, 2026  (in class)",
        "  • Project Proposal:  March 19, 2026",
        "  • Homework 3 due  :  April 2, 2026",
        "  • Quiz 2          :  April 9, 2026",
        "  • Final Project   :  April 23, 2026",
        "  • Final Exam      :  May 7, 2026  (cumulative)",
        "",
        "Topics: Integration techniques, sequences, series, parametric/polar.",
        "Grading: HW 25%, Quizzes 15%, Midterm 25%, Project 15%, Final 20%.",
    ]
    y = h - 110
    for line in lines:
        c.drawString(72, y, line)
        y -= 18
    c.showPage()
    c.save()


def make_sample_study_material(path: str) -> None:
    from reportlab.lib.pagesizes import LETTER
    from reportlab.pdfgen import canvas

    c = canvas.Canvas(path, pagesize=LETTER)
    w, h = LETTER
    c.setFont("Helvetica-Bold", 14)
    c.drawString(72, h - 72, "Calculus II — Study Notes: Integration by Parts")
    c.setFont("Helvetica", 11)
    lines = [
        "Integration by parts comes from the product rule for differentiation:",
        "    (uv)' = u'v + uv'",
        "Rearranging and integrating gives the formula:",
        "    ∫ u dv = uv − ∫ v du",
        "",
        "Choosing u and dv: the LIATE rule recommends the order",
        "  Logarithmic, Inverse trig, Algebraic, Trigonometric, Exponential.",
        "",
        "Example 1: ∫ x e^x dx",
        "  Let u = x   → du = dx",
        "  Let dv = e^x dx → v = e^x",
        "  Result: x e^x − ∫ e^x dx = x e^x − e^x + C",
        "",
        "Example 2: ∫ ln(x) dx",
        "  Let u = ln(x), dv = dx → v = x, du = dx/x",
        "  Result: x ln(x) − ∫ dx = x ln(x) − x + C",
        "",
        "Tabular method works well when one factor is a polynomial.",
        "Common pitfalls: forgetting +C, and choosing wrong u/dv pairing.",
    ]
    y = h - 110
    for line in lines:
        c.drawString(72, y, line)
        y -= 18
    c.showPage()
    c.save()


# ---------------------------------------------------------------------------
# Gemini helper
# ---------------------------------------------------------------------------
async def gemini_extract_deadlines(pdf_path: str) -> dict:
    """Extract deadline events from a syllabus PDF and return strict JSON."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType

    system = (
        "You are an academic scheduling assistant. Extract every deadline / important "
        "date / exam from the supplied syllabus PDF. "
        "Return ONLY valid JSON (no markdown, no commentary) matching this schema: "
        "{\"course\": {\"code\": str, \"title\": str, \"term\": str|null}, "
        "\"events\": [ {\"title\": str, \"type\": one of "
        "[\"assignment\",\"quiz\",\"midterm\",\"final\",\"project\",\"reading\",\"other\"], "
        "\"dueDateISO\": str (YYYY-MM-DD), \"notes\": str|null} ] }"
    )

    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id="poc-deadlines", system_message=system)
        .with_model("gemini", "gemini-2.5-pro")
    )
    file_attach = FileContentWithMimeType(file_path=pdf_path, mime_type="application/pdf")
    msg = UserMessage(
        text="Extract all deadlines from this syllabus and return strict JSON.",
        file_contents=[file_attach],
    )
    raw = await chat.send_message(msg)
    print("[debug deadlines raw]", repr(raw)[:400])
    return _parse_json(raw)


async def gemini_generate_quiz(material_path: str, num_q: int = 5) -> dict:
    """Generate a multiple-choice quiz JSON from study material."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType

    system = (
        "You are a tutor that creates short multiple-choice quizzes from study material. "
        f"Generate exactly {num_q} questions. Return ONLY valid JSON (no markdown). "
        "Schema: { \"course\": str|null, \"topic\": str, "
        "\"questions\": [ { \"q\": str, \"choices\": [str, str, str, str], "
        "\"answerIndex\": int, \"explanation\": str, \"difficulty\": "
        "one of [\"easy\",\"medium\",\"hard\"] } ] }"
    )
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id="poc-quiz", system_message=system)
        .with_model("gemini", "gemini-2.5-pro")
    )
    file_attach = FileContentWithMimeType(file_path=material_path, mime_type="application/pdf")
    msg = UserMessage(
        text=f"Create a {num_q}-question multiple-choice quiz from this material. JSON only.",
        file_contents=[file_attach],
    )
    raw = await chat.send_message(msg)
    print("[debug quiz raw]", repr(raw)[:400])
    return _parse_json(raw)


def _parse_json(raw: str) -> dict:
    """Robust JSON extraction (handles fenced code blocks)."""
    import re
    s = raw.strip()
    # Strip fenced code blocks
    m = re.search(r"```(?:json)?\s*(.+?)\s*```", s, re.DOTALL)
    if m:
        s = m.group(1).strip()
    # Fall back: extract first `{` to last `}`
    if not s.startswith("{"):
        l = s.find("{")
        r = s.rfind("}")
        if l != -1 and r != -1:
            s = s[l : r + 1]
    return json.loads(s)


# ---------------------------------------------------------------------------
# Vapi helper
# ---------------------------------------------------------------------------
async def vapi_list_numbers() -> list:
    import httpx
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            "https://api.vapi.ai/phone-number",
            headers={"Authorization": f"Bearer {VAPI_API_KEY}"},
        )
        r.raise_for_status()
        return r.json()


async def vapi_place_call(phone_number_id: str, customer_phone: str, quiz: dict) -> dict:
    import httpx

    questions = quiz.get("questions", [])[:3]
    quiz_block = "\n".join([f"Q{i+1}: {q['q']}" for i, q in enumerate(questions)])
    system_prompt = (
        "You are a friendly tutor calling a student to quiz them on Calculus II "
        "(Integration by Parts). Ask questions one at a time, wait for the answer, "
        "give brief feedback, then move on. Keep replies short.\n\n"
        f"Quiz:\n{quiz_block}\n\n"
        "After all questions, thank the student and end the call."
    )

    payload = {
        "phoneNumberId": phone_number_id,
        "customer": {"number": customer_phone, "numberE164CheckEnabled": True},
        "assistant": {
            "model": {
                "provider": "openai",
                "model": "gpt-4o-mini",
                "temperature": 0.4,
                "messages": [{"role": "system", "content": system_prompt}],
            },
            "voice": {"provider": "vapi", "voiceId": "Elliot"},
            "firstMessage": "Hey! It's your study buddy. Ready for a quick quiz on integration by parts?",
            "firstMessageMode": "assistant-speaks-first",
            "endCallMessage": "Great work — talk soon!",
            "transcriber": {"provider": "deepgram", "model": "nova-2", "language": "en"},
        },
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            "https://api.vapi.ai/call/phone",
            headers={
                "Authorization": f"Bearer {VAPI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if r.status_code >= 400:
            print("Vapi error:", r.status_code, r.text)
            r.raise_for_status()
        return r.json()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def main():
    results = {"deadlines": False, "quiz": False, "vapi_list": False, "vapi_call": "skipped"}

    tmp = Path(tempfile.mkdtemp(prefix="poc_"))
    syllabus_pdf = tmp / "syllabus.pdf"
    material_pdf = tmp / "material.pdf"
    make_sample_syllabus_pdf(str(syllabus_pdf))
    make_sample_study_material(str(material_pdf))
    print(f"[setup] sample syllabus  → {syllabus_pdf}")
    print(f"[setup] sample material  → {material_pdf}")
    print()

    # --- Test 1: deadlines extraction --------------------------------------
    print("─" * 70)
    print(" TEST 1 — Gemini: extract deadlines from syllabus PDF")
    print("─" * 70)
    try:
        data = await gemini_extract_deadlines(str(syllabus_pdf))
        print(json.dumps(data, indent=2)[:1200])
        events = data.get("events", [])
        assert isinstance(events, list) and len(events) >= 5, "need ≥5 events"
        for ev in events:
            assert "title" in ev and "dueDateISO" in ev and "type" in ev
        print(f"PASS — extracted {len(events)} events")
        results["deadlines"] = True
    except Exception as e:
        print("FAIL —", e)

    # --- Test 2: quiz generation -------------------------------------------
    print()
    print("─" * 70)
    print(" TEST 2 — Gemini: generate quiz JSON from study material")
    print("─" * 70)
    quiz = None
    try:
        quiz = await gemini_generate_quiz(str(material_pdf), num_q=5)
        print(json.dumps(quiz, indent=2)[:1200])
        qs = quiz.get("questions", [])
        assert len(qs) == 5, f"expected 5 questions, got {len(qs)}"
        for q in qs:
            assert "q" in q and len(q.get("choices", [])) == 4
            assert isinstance(q.get("answerIndex"), int) and 0 <= q["answerIndex"] < 4
        print(f"PASS — quiz with {len(qs)} valid questions")
        results["quiz"] = True
    except Exception as e:
        print("FAIL —", e)

    # --- Test 3: Vapi list numbers -----------------------------------------
    print()
    print("─" * 70)
    print(" TEST 3 — Vapi: list phone numbers, find phoneNumberId")
    print("─" * 70)
    phone_number_id = None
    try:
        nums = await vapi_list_numbers()
        print(f"Found {len(nums)} phone number(s)")
        for n in nums:
            print(f"  - id={n.get('id')}  number={n.get('number')}  status={n.get('status')}")
        if nums:
            # Match by VAPI_DEFAULT_PHONE if possible
            for n in nums:
                if (n.get("number") or "").replace(" ", "") == VAPI_DEFAULT_PHONE.replace(" ", ""):
                    phone_number_id = n.get("id")
                    break
            phone_number_id = phone_number_id or nums[0].get("id")
            print(f"Selected phoneNumberId: {phone_number_id}")
            results["vapi_list"] = True
        else:
            print("FAIL — no phone numbers returned")
    except Exception as e:
        print("FAIL —", e)

    # --- Test 4: Vapi place call (only if TEST_CALLEE_PHONE provided) ------
    print()
    print("─" * 70)
    print(" TEST 4 — Vapi: place outbound call (optional)")
    print("─" * 70)
    if not TEST_CALLEE_PHONE:
        print("SKIP — set TEST_CALLEE_PHONE=+1XXXXXXXXXX to actually place a call")
    elif not phone_number_id or not quiz:
        print("SKIP — phoneNumberId or quiz unavailable")
    else:
        try:
            call = await vapi_place_call(phone_number_id, TEST_CALLEE_PHONE, quiz)
            print(f"Call created: id={call.get('id')}  status={call.get('status')}")
            results["vapi_call"] = "PASS"
        except Exception as e:
            print("FAIL —", e)
            results["vapi_call"] = "FAIL"

    # --- Summary -----------------------------------------------------------
    print()
    print("=" * 70)
    print(" SUMMARY")
    print("=" * 70)
    for k, v in results.items():
        print(f"  {k:14s} → {v}")
    must_pass = results["deadlines"] and results["quiz"] and results["vapi_list"]
    print()
    print("OVERALL:", "✅ READY" if must_pass else "❌ NOT READY")
    sys.exit(0 if must_pass else 1)


if __name__ == "__main__":
    asyncio.run(main())
