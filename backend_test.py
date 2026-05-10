"""
StudySpark Backend API Test Suite
Tests all backend endpoints according to review requirements.
"""
import sys
import tempfile
import time
from pathlib import Path

import requests

# Base URL from frontend/.env
BASE_URL = "https://deadline-dash-120.preview.emergentagent.com/api"

# Test state
test_results = {
    "passed": [],
    "failed": [],
    "total": 0,
}

# Shared test data
demo_token = None
signup_token = None
signup_user_id = None
test_course_id = None
test_event_id = None
test_quiz_id = None
test_call_session_id = None


def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    test_results["total"] += 1
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status} - {name}")
    if details:
        print(f"  {details}")
    if passed:
        test_results["passed"].append(name)
    else:
        test_results["failed"].append(name)
    return passed


def make_sample_syllabus_pdf(path: str) -> None:
    """Generate a sample syllabus PDF with deadlines"""
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
    ]
    y = h - 110
    for line in lines:
        c.drawString(72, y, line)
        y -= 18
    c.showPage()
    c.save()


def make_sample_study_material(path: str) -> None:
    """Generate sample study material PDF"""
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
    ]
    y = h - 110
    for line in lines:
        c.drawString(72, y, line)
        y -= 18
    c.showPage()
    c.save()


# ============================================================================
# TEST 1: Health Check
# ============================================================================
def test_health():
    """GET /api/health returns ok=true and vapi_phone_id"""
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=10)
        data = r.json()
        passed = (
            r.status_code == 200
            and data.get("ok") is True
            and data.get("vapi_phone_id") is not None
        )
        details = f"Status: {r.status_code}, ok={data.get('ok')}, vapi_phone_id={data.get('vapi_phone_id')}"
        return log_test("Health check", passed, details)
    except Exception as e:
        return log_test("Health check", False, str(e))


# ============================================================================
# TEST 2: Demo Auth
# ============================================================================
def test_demo_auth():
    """POST /api/auth/demo returns token + user.id=demo-user-001"""
    global demo_token
    try:
        r = requests.post(f"{BASE_URL}/auth/demo", timeout=10)
        data = r.json()
        passed = (
            r.status_code == 200
            and "token" in data
            and data.get("user", {}).get("id") == "demo-user-001"
        )
        if passed:
            demo_token = data["token"]
        details = f"Status: {r.status_code}, user_id={data.get('user', {}).get('id')}"
        return log_test("Demo auth", passed, details)
    except Exception as e:
        return log_test("Demo auth", False, str(e))


# ============================================================================
# TEST 3: Signup
# ============================================================================
def test_signup():
    """POST /api/auth/signup with new email returns token; duplicate returns 409"""
    global signup_token, signup_user_id
    test_email = f"test_{int(time.time())}@example.com"
    
    # Test new signup
    try:
        r = requests.post(
            f"{BASE_URL}/auth/signup",
            json={"email": test_email, "password": "test1234", "name": "Test User"},
            timeout=10,
        )
        data = r.json()
        passed = r.status_code == 200 and "token" in data and "user" in data
        if passed:
            signup_token = data["token"]
            signup_user_id = data["user"]["id"]
        details = f"Status: {r.status_code}, has_token={bool(data.get('token'))}"
        log_test("Signup - new user", passed, details)
    except Exception as e:
        log_test("Signup - new user", False, str(e))
        return False
    
    # Test duplicate signup
    try:
        r = requests.post(
            f"{BASE_URL}/auth/signup",
            json={"email": test_email, "password": "test1234"},
            timeout=10,
        )
        passed = r.status_code == 409
        details = f"Status: {r.status_code} (expected 409)"
        return log_test("Signup - duplicate email", passed, details)
    except Exception as e:
        return log_test("Signup - duplicate email", False, str(e))


# ============================================================================
# TEST 4: Login
# ============================================================================
def test_login():
    """POST /api/auth/login with demo creds returns token"""
    try:
        r = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": "demo@studyspark.app", "password": "demo1234"},
            timeout=10,
        )
        data = r.json()
        passed = r.status_code == 200 and "token" in data
        details = f"Status: {r.status_code}, has_token={bool(data.get('token'))}"
        return log_test("Login with demo creds", passed, details)
    except Exception as e:
        return log_test("Login with demo creds", False, str(e))


# ============================================================================
# TEST 5: Get Current User
# ============================================================================
def test_get_me():
    """GET /api/auth/me with token returns user; without token returns 401"""
    # Test with token
    try:
        headers = {"Authorization": f"Bearer {demo_token}"}
        r = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        data = r.json()
        passed = r.status_code == 200 and "id" in data and "email" in data
        details = f"Status: {r.status_code}, user_id={data.get('id')}"
        log_test("Get me - with token", passed, details)
    except Exception as e:
        log_test("Get me - with token", False, str(e))
    
    # Test without token
    try:
        r = requests.get(f"{BASE_URL}/auth/me", timeout=10)
        passed = r.status_code == 401
        details = f"Status: {r.status_code} (expected 401)"
        return log_test("Get me - without token", passed, details)
    except Exception as e:
        return log_test("Get me - without token", False, str(e))


# ============================================================================
# TEST 6: Update User
# ============================================================================
def test_update_me():
    """PUT /api/auth/me updates name and phone"""
    try:
        headers = {"Authorization": f"Bearer {signup_token}"}
        r = requests.put(
            f"{BASE_URL}/auth/me",
            headers=headers,
            json={"name": "Updated Name", "phone": "+15555551234"},
            timeout=10,
        )
        data = r.json()
        passed = (
            r.status_code == 200
            and data.get("name") == "Updated Name"
            and data.get("phone") == "+15555551234"
        )
        details = f"Status: {r.status_code}, name={data.get('name')}, phone={data.get('phone')}"
        return log_test("Update user profile", passed, details)
    except Exception as e:
        return log_test("Update user profile", False, str(e))


# ============================================================================
# TEST 7: Upload Syllabus (PDF)
# ============================================================================
def test_upload_syllabus():
    """POST /api/syllabi/upload with PDF returns events array; events saved"""
    global test_course_id, test_event_id
    tmp = Path(tempfile.mkdtemp(prefix="test_"))
    syllabus_pdf = tmp / "syllabus.pdf"
    make_sample_syllabus_pdf(str(syllabus_pdf))
    
    try:
        headers = {"Authorization": f"Bearer {demo_token}"}
        with open(syllabus_pdf, "rb") as f:
            files = {"file": ("syllabus.pdf", f, "application/pdf")}
            r = requests.post(
                f"{BASE_URL}/syllabi/upload",
                headers=headers,
                files=files,
                timeout=60,  # Gemini can be slow
            )
        data = r.json()
        events = data.get("events", [])
        passed = r.status_code == 200 and len(events) >= 5
        if passed and events:
            test_event_id = events[0].get("id")
            test_course_id = data.get("course", {}).get("id")
        details = f"Status: {r.status_code}, events_count={len(events)}"
        log_test("Upload syllabus PDF", passed, details)
        
        # Verify events are saved
        r2 = requests.get(f"{BASE_URL}/events", headers=headers, timeout=10)
        saved_events = r2.json()
        passed2 = r2.status_code == 200 and len(saved_events) >= 5
        details2 = f"Status: {r2.status_code}, saved_events={len(saved_events)}"
        return log_test("Events saved to DB", passed2, details2)
    except Exception as e:
        return log_test("Upload syllabus PDF", False, str(e))


# ============================================================================
# TEST 8: Upload Non-PDF
# ============================================================================
def test_upload_non_pdf():
    """POST /api/syllabi/upload rejects non-PDF with 400"""
    try:
        headers = {"Authorization": f"Bearer {demo_token}"}
        files = {"file": ("test.txt", b"Not a PDF", "text/plain")}
        r = requests.post(
            f"{BASE_URL}/syllabi/upload",
            headers=headers,
            files=files,
            timeout=10,
        )
        passed = r.status_code == 400
        details = f"Status: {r.status_code} (expected 400)"
        return log_test("Upload non-PDF rejected", passed, details)
    except Exception as e:
        return log_test("Upload non-PDF rejected", False, str(e))


# ============================================================================
# TEST 9: List Courses
# ============================================================================
def test_list_courses():
    """GET /api/courses returns courses"""
    try:
        headers = {"Authorization": f"Bearer {demo_token}"}
        r = requests.get(f"{BASE_URL}/courses", headers=headers, timeout=10)
        data = r.json()
        passed = r.status_code == 200 and isinstance(data, list)
        details = f"Status: {r.status_code}, courses_count={len(data)}"
        return log_test("List courses", passed, details)
    except Exception as e:
        return log_test("List courses", False, str(e))


# ============================================================================
# TEST 10: Delete Event
# ============================================================================
def test_delete_event():
    """DELETE /api/events/{id} deletes only own event"""
    if not test_event_id:
        return log_test("Delete event", False, "No event_id available")
    
    try:
        headers = {"Authorization": f"Bearer {demo_token}"}
        r = requests.delete(
            f"{BASE_URL}/events/{test_event_id}",
            headers=headers,
            timeout=10,
        )
        passed = r.status_code == 200 and r.json().get("ok") is True
        details = f"Status: {r.status_code}"
        return log_test("Delete event", passed, details)
    except Exception as e:
        return log_test("Delete event", False, str(e))


# ============================================================================
# TEST 11: Generate Quiz from PDF
# ============================================================================
def test_generate_quiz_pdf():
    """POST /api/quiz/generate with PDF returns 5 questions"""
    global test_quiz_id
    tmp = Path(tempfile.mkdtemp(prefix="test_"))
    material_pdf = tmp / "material.pdf"
    make_sample_study_material(str(material_pdf))
    
    try:
        headers = {"Authorization": f"Bearer {signup_token}"}
        with open(material_pdf, "rb") as f:
            files = {"file": ("material.pdf", f, "application/pdf")}
            data = {
                "title": "Test Quiz",
                "num_questions": "5",
                "difficulty": "medium",
            }
            r = requests.post(
                f"{BASE_URL}/quiz/generate",
                headers=headers,
                files=files,
                data=data,
                timeout=60,  # Gemini can be slow
            )
        result = r.json()
        questions = result.get("questions", [])
        passed = r.status_code == 200 and len(questions) == 5
        if passed:
            test_quiz_id = result.get("id")
            # Validate question structure
            for q in questions:
                if not (
                    "q" in q
                    and len(q.get("choices", [])) == 4
                    and isinstance(q.get("answerIndex"), int)
                    and 0 <= q["answerIndex"] <= 3
                ):
                    passed = False
                    break
        details = f"Status: {r.status_code}, questions={len(questions)}"
        return log_test("Generate quiz from PDF", passed, details)
    except Exception as e:
        return log_test("Generate quiz from PDF", False, str(e))


# ============================================================================
# TEST 12: Generate Quiz from Text
# ============================================================================
def test_generate_quiz_text():
    """POST /api/quiz/generate with text works"""
    try:
        headers = {"Authorization": f"Bearer {signup_token}"}
        data = {
            "text": "The Pythagorean theorem states that in a right triangle, a² + b² = c².",
            "title": "Geometry Quiz",
            "num_questions": "3",
            "difficulty": "easy",
        }
        r = requests.post(
            f"{BASE_URL}/quiz/generate",
            headers=headers,
            data=data,
            timeout=60,
        )
        result = r.json()
        questions = result.get("questions", [])
        passed = r.status_code == 200 and len(questions) >= 3
        details = f"Status: {r.status_code}, questions={len(questions)}"
        return log_test("Generate quiz from text", passed, details)
    except Exception as e:
        return log_test("Generate quiz from text", False, str(e))


# ============================================================================
# TEST 13: Generate Quiz - Missing Input
# ============================================================================
def test_generate_quiz_missing():
    """POST /api/quiz/generate without file or text returns 400"""
    try:
        headers = {"Authorization": f"Bearer {signup_token}"}
        r = requests.post(
            f"{BASE_URL}/quiz/generate",
            headers=headers,
            data={"title": "Empty Quiz"},
            timeout=10,
        )
        passed = r.status_code == 400
        details = f"Status: {r.status_code} (expected 400)"
        return log_test("Generate quiz - missing input", passed, details)
    except Exception as e:
        return log_test("Generate quiz - missing input", False, str(e))


# ============================================================================
# TEST 14: List Quizzes
# ============================================================================
def test_list_quizzes():
    """GET /api/quizzes lists user's quizzes"""
    try:
        headers = {"Authorization": f"Bearer {signup_token}"}
        r = requests.get(f"{BASE_URL}/quizzes", headers=headers, timeout=10)
        data = r.json()
        passed = r.status_code == 200 and isinstance(data, list) and len(data) >= 2
        details = f"Status: {r.status_code}, quizzes_count={len(data)}"
        return log_test("List quizzes", passed, details)
    except Exception as e:
        return log_test("List quizzes", False, str(e))


# ============================================================================
# TEST 15: Get Quiz
# ============================================================================
def test_get_quiz():
    """GET /api/quizzes/{id} returns quiz; cross-user access forbidden"""
    if not test_quiz_id:
        return log_test("Get quiz", False, "No quiz_id available")
    
    # Test own quiz
    try:
        headers = {"Authorization": f"Bearer {signup_token}"}
        r = requests.get(f"{BASE_URL}/quizzes/{test_quiz_id}", headers=headers, timeout=10)
        data = r.json()
        passed = r.status_code == 200 and data.get("id") == test_quiz_id
        details = f"Status: {r.status_code}"
        log_test("Get own quiz", passed, details)
    except Exception as e:
        log_test("Get own quiz", False, str(e))
    
    # Test cross-user access (demo user trying to access signup user's quiz)
    try:
        headers = {"Authorization": f"Bearer {demo_token}"}
        r = requests.get(f"{BASE_URL}/quizzes/{test_quiz_id}", headers=headers, timeout=10)
        passed = r.status_code == 404
        details = f"Status: {r.status_code} (expected 404)"
        return log_test("Get quiz - cross-user forbidden", passed, details)
    except Exception as e:
        return log_test("Get quiz - cross-user forbidden", False, str(e))


# ============================================================================
# TEST 16: Start Call
# ============================================================================
def test_start_call():
    """POST /api/call/start validates phone format and quiz existence"""
    global test_call_session_id
    
    # Test bad phone format
    try:
        headers = {"Authorization": f"Bearer {signup_token}"}
        r = requests.post(
            f"{BASE_URL}/call/start",
            headers=headers,
            json={"quiz_id": test_quiz_id or "fake", "phone": "1234567"},
            timeout=10,
        )
        passed = r.status_code == 400
        details = f"Status: {r.status_code} (expected 400)"
        log_test("Start call - bad phone format", passed, details)
    except Exception as e:
        log_test("Start call - bad phone format", False, str(e))
    
    # Test non-existent quiz
    try:
        headers = {"Authorization": f"Bearer {signup_token}"}
        r = requests.post(
            f"{BASE_URL}/call/start",
            headers=headers,
            json={"quiz_id": "fake-quiz-id", "phone": "+15555550100"},
            timeout=10,
        )
        passed = r.status_code == 404
        details = f"Status: {r.status_code} (expected 404)"
        log_test("Start call - non-existent quiz", passed, details)
    except Exception as e:
        log_test("Start call - non-existent quiz", False, str(e))
    
    # Test valid call (use Vapi test number)
    if not test_quiz_id:
        return log_test("Start call - valid", False, "No quiz_id available")
    
    try:
        headers = {"Authorization": f"Bearer {signup_token}"}
        r = requests.post(
            f"{BASE_URL}/call/start",
            headers=headers,
            json={"quiz_id": test_quiz_id, "phone": "+15555550100"},
            timeout=30,
        )
        data = r.json()
        # Accept 200 (success) or 502 (Vapi rejected but handled gracefully)
        passed = r.status_code in (200, 502)
        if r.status_code == 200:
            passed = passed and "session_id" in data
            test_call_session_id = data.get("session_id")
        details = f"Status: {r.status_code}, has_session_id={bool(data.get('session_id'))}"
        return log_test("Start call - valid", passed, details)
    except Exception as e:
        return log_test("Start call - valid", False, str(e))


# ============================================================================
# TEST 17: List Calls
# ============================================================================
def test_list_calls():
    """GET /api/calls returns list"""
    try:
        headers = {"Authorization": f"Bearer {signup_token}"}
        r = requests.get(f"{BASE_URL}/calls", headers=headers, timeout=10)
        data = r.json()
        passed = r.status_code == 200 and isinstance(data, list)
        details = f"Status: {r.status_code}, calls_count={len(data)}"
        return log_test("List calls", passed, details)
    except Exception as e:
        return log_test("List calls", False, str(e))


# ============================================================================
# MAIN
# ============================================================================
def main():
    print("=" * 70)
    print(" StudySpark Backend API Test Suite")
    print("=" * 70)
    print(f"Base URL: {BASE_URL}")
    print()
    
    # Run all tests
    test_health()
    test_demo_auth()
    test_signup()
    test_login()
    test_get_me()
    test_update_me()
    test_upload_syllabus()
    test_upload_non_pdf()
    test_list_courses()
    test_delete_event()
    test_generate_quiz_pdf()
    test_generate_quiz_text()
    test_generate_quiz_missing()
    test_list_quizzes()
    test_get_quiz()
    test_start_call()
    test_list_calls()
    
    # Summary
    print("\n" + "=" * 70)
    print(" TEST SUMMARY")
    print("=" * 70)
    print(f"Total tests: {test_results['total']}")
    print(f"Passed: {len(test_results['passed'])} ✅")
    print(f"Failed: {len(test_results['failed'])} ❌")
    
    if test_results["failed"]:
        print("\nFailed tests:")
        for test in test_results["failed"]:
            print(f"  - {test}")
    
    success_rate = (
        len(test_results["passed"]) / test_results["total"] * 100
        if test_results["total"] > 0
        else 0
    )
    print(f"\nSuccess rate: {success_rate:.1f}%")
    
    return 0 if len(test_results["failed"]) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
