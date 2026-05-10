"""
StudySpark Backend Test Suite — Phase 3 + Phase 4 + AWS Integration
Tests AWS Cognito auth, S3 storage, Vapi webhook, Gemini scoring, and scheduling.
"""
import requests
import sys
import time
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Import PDF generator from existing tests
sys.path.insert(0, "/app/tests")
from poc_integrations import make_sample_syllabus_pdf, make_sample_study_material

BASE_URL = "https://deadline-dash-120.preview.emergentagent.com/api"

class TestRunner:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failed_tests = []
        self.demo_token = None
        self.cognito_token = None
        self.cognito_email = None
        self.test_user_id = None
        self.quiz_id = None
        self.scheduled_call_id = None
        self.syllabus_id = None

    def test(self, name, fn):
        """Run a single test"""
        self.tests_run += 1
        print(f"\n{'='*70}")
        print(f"TEST {self.tests_run}: {name}")
        print('='*70)
        try:
            fn()
            self.tests_passed += 1
            print(f"✅ PASS")
            return True
        except AssertionError as e:
            self.tests_failed += 1
            self.failed_tests.append({"test": name, "error": str(e)})
            print(f"❌ FAIL: {e}")
            return False
        except Exception as e:
            self.tests_failed += 1
            self.failed_tests.append({"test": name, "error": f"Exception: {e}"})
            print(f"❌ FAIL (Exception): {e}")
            return False

    def summary(self):
        """Print test summary"""
        print(f"\n{'='*70}")
        print("TEST SUMMARY")
        print('='*70)
        print(f"Total:  {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_failed}")
        if self.failed_tests:
            print("\nFailed tests:")
            for ft in self.failed_tests:
                print(f"  - {ft['test']}: {ft['error']}")
        print('='*70)
        return self.tests_failed == 0


def main():
    runner = TestRunner()
    print("="*70)
    print(" StudySpark Backend Test Suite — AWS Integration")
    print("="*70)
    print(f"Base URL: {BASE_URL}\n")

    # ========================================================================
    # TEST 1: Health check shows AWS integration
    # ========================================================================
    def test_health():
        r = requests.get(f"{BASE_URL}/health", timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        print(f"Health response: {json.dumps(data, indent=2)}")
        assert data.get("ok") is True, "Health check should return ok=true"
        aws = data.get("aws", {})
        assert aws.get("using_cognito") is True, "Should show using_cognito=true"
        assert aws.get("using_s3") is True, "Should show using_s3=true"
        assert aws.get("cognito_pool") == "us-east-1_Wc8g1HeDt", "Wrong Cognito pool"
        assert aws.get("s3_bucket") == "gryph-os", "Wrong S3 bucket"
        print(f"✓ AWS Cognito pool: {aws.get('cognito_pool')}")
        print(f"✓ AWS S3 bucket: {aws.get('s3_bucket')}")

    runner.test("Health check shows AWS integration", test_health)

    # ========================================================================
    # TEST 2: Demo bypass still works (local JWT)
    # ========================================================================
    def test_demo_bypass():
        r = requests.post(f"{BASE_URL}/auth/demo", timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        print(f"Demo response keys: {list(data.keys())}")
        assert "token" in data, "Should return token"
        assert data.get("user", {}).get("auth_source") == "local-demo", "Should be local-demo"
        runner.demo_token = data["token"]
        print(f"✓ Demo token obtained (auth_source=local-demo)")

    runner.test("Demo bypass returns local JWT", test_demo_bypass)

    # ========================================================================
    # TEST 3: Cognito signup creates user
    # ========================================================================
    def test_cognito_signup():
        timestamp = int(time.time())
        email = f"aws_test_{timestamp}@studyspark.app"
        password = "TestPass123!"
        r = requests.post(
            f"{BASE_URL}/auth/signup",
            json={"email": email, "password": password, "name": "AWS Test User"},
            timeout=20
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        print(f"Signup response keys: {list(data.keys())}")
        assert "token" in data, "Should return token (ID token)"
        assert "refresh_token" in data, "Should return refresh_token"
        assert data.get("user", {}).get("auth_source") == "cognito", "Should be cognito"
        assert data.get("user", {}).get("email") == email, "Email mismatch"
        runner.cognito_token = data["token"]
        runner.cognito_email = email
        runner.test_user_id = data.get("user", {}).get("id")
        print(f"✓ Cognito user created: {email}")
        print(f"✓ User ID: {runner.test_user_id}")

    runner.test("Cognito signup creates user", test_cognito_signup)

    # ========================================================================
    # TEST 4: Duplicate Cognito signup returns 409
    # ========================================================================
    def test_duplicate_signup():
        if not runner.cognito_email:
            raise AssertionError("No cognito_email from previous test")
        r = requests.post(
            f"{BASE_URL}/auth/signup",
            json={"email": runner.cognito_email, "password": "TestPass123!", "name": "Duplicate"},
            timeout=20
        )
        assert r.status_code == 409, f"Expected 409 for duplicate, got {r.status_code}"
        print(f"✓ Duplicate signup correctly rejected with 409")

    runner.test("Duplicate Cognito signup returns 409", test_duplicate_signup)

    # ========================================================================
    # TEST 5: Weak password returns 4xx or 500 with descriptive message
    # ========================================================================
    def test_weak_password():
        timestamp = int(time.time())
        email = f"weak_test_{timestamp}@studyspark.app"
        r = requests.post(
            f"{BASE_URL}/auth/signup",
            json={"email": email, "password": "short", "name": "Weak"},
            timeout=20
        )
        # Accept 422 (validation) or 500 (Cognito policy error with message)
        assert r.status_code in (400, 422, 500), f"Expected 4xx or 500, got {r.status_code}"
        print(f"✓ Weak password rejected with status {r.status_code}")
        if r.status_code == 500:
            # Should have descriptive message
            detail = r.json().get("detail", "")
            assert len(detail) > 0, "500 should include error detail"
            print(f"✓ Error message: {detail[:100]}")

    runner.test("Weak password validation", test_weak_password)

    # ========================================================================
    # TEST 6: Cognito login works
    # ========================================================================
    def test_cognito_login():
        if not runner.cognito_email:
            raise AssertionError("No cognito_email from signup test")
        r = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": runner.cognito_email, "password": "TestPass123!"},
            timeout=20
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        print(f"Login response keys: {list(data.keys())}")
        assert "token" in data, "Should return token"
        assert data.get("user", {}).get("auth_source") == "cognito", "Should be cognito"
        print(f"✓ Cognito login successful")

    runner.test("Cognito login works", test_cognito_login)

    # ========================================================================
    # TEST 7: Cognito login with bad password returns 401
    # ========================================================================
    def test_bad_password():
        if not runner.cognito_email:
            raise AssertionError("No cognito_email")
        r = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": runner.cognito_email, "password": "WrongPass123!"},
            timeout=20
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print(f"✓ Bad password correctly rejected with 401")

    runner.test("Bad password returns 401", test_bad_password)

    # ========================================================================
    # TEST 8: GET /auth/me validates Cognito token via JWKS
    # ========================================================================
    def test_auth_me_cognito():
        if not runner.cognito_token:
            raise AssertionError("No cognito_token")
        r = requests.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {runner.cognito_token}"},
            timeout=10
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        print(f"/auth/me response: {json.dumps(data, indent=2)}")
        assert data.get("auth_source") == "cognito", "Should be cognito"
        assert data.get("email") == runner.cognito_email, "Email mismatch"
        print(f"✓ Cognito token validated via JWKS")

    runner.test("GET /auth/me validates Cognito token", test_auth_me_cognito)

    # ========================================================================
    # TEST 9: GET /auth/me with garbage token returns 401
    # ========================================================================
    def test_auth_me_invalid():
        r = requests.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": "Bearer garbage_token_12345"},
            timeout=10
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print(f"✓ Invalid token rejected with 401")

    runner.test("Invalid token returns 401", test_auth_me_invalid)

    # ========================================================================
    # TEST 10: PUT /auth/me updates name and phone
    # ========================================================================
    def test_update_profile():
        if not runner.cognito_token:
            raise AssertionError("No cognito_token")
        r = requests.put(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {runner.cognito_token}"},
            json={"name": "Updated Name", "phone": "+15555551234"},
            timeout=10
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        print(f"Updated profile: {json.dumps(data, indent=2)}")
        assert data.get("name") == "Updated Name", "Name not updated"
        assert data.get("phone") == "+15555551234", "Phone not updated"
        print(f"✓ Profile updated successfully")

    runner.test("PUT /auth/me updates profile", test_update_profile)

    # ========================================================================
    # TEST 11: Syllabus upload to S3
    # ========================================================================
    def test_syllabus_upload():
        if not runner.cognito_token:
            raise AssertionError("No cognito_token")
        
        # Create sample PDF
        import tempfile
        tmp = Path(tempfile.mkdtemp())
        pdf_path = tmp / "test_syllabus.pdf"
        make_sample_syllabus_pdf(str(pdf_path))
        
        with open(pdf_path, "rb") as f:
            r = requests.post(
                f"{BASE_URL}/syllabi/upload",
                headers={"Authorization": f"Bearer {runner.cognito_token}"},
                files={"file": ("syllabus.pdf", f, "application/pdf")},
                timeout=45
            )
        
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        print(f"Upload response keys: {list(data.keys())}")
        
        # Check S3 info
        s3_info = data.get("s3", {})
        assert s3_info.get("bucket") == "gryph-os", "Wrong S3 bucket"
        assert s3_info.get("key", "").startswith(f"syllabi/{runner.test_user_id}/"), "Wrong S3 key prefix"
        print(f"✓ S3 bucket: {s3_info.get('bucket')}")
        print(f"✓ S3 key: {s3_info.get('key')}")
        
        # Check events extracted
        events = data.get("events", [])
        assert len(events) > 0, "Should extract at least one event"
        print(f"✓ Extracted {len(events)} events")
        
        pdf_path.unlink()

    runner.test("Syllabus upload stores to S3", test_syllabus_upload)

    # ========================================================================
    # TEST 12: GET /syllabi lists uploaded syllabi with s3_key
    # ========================================================================
    def test_list_syllabi():
        if not runner.cognito_token:
            raise AssertionError("No cognito_token")
        r = requests.get(
            f"{BASE_URL}/syllabi",
            headers={"Authorization": f"Bearer {runner.cognito_token}"},
            timeout=10
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        print(f"Syllabi count: {len(data)}")
        assert len(data) > 0, "Should have at least one syllabus"
        assert "s3_key" in data[0], "Should have s3_key field"
        # Store syllabus_id for next test
        if len(data) > 0:
            runner.syllabus_id = data[0].get("id")
            print(f"✓ Stored syllabus_id: {runner.syllabus_id}")
        print(f"✓ Found {len(data)} syllabi with s3_key")

    runner.test("GET /syllabi lists syllabi", test_list_syllabi)

    # ========================================================================
    # TEST 13: GET /syllabi/{id}/download returns presigned URL
    # ========================================================================
    def test_syllabus_download():
        if not runner.cognito_token or not runner.syllabus_id:
            raise AssertionError("No cognito_token or syllabus_id")
        r = requests.get(
            f"{BASE_URL}/syllabi/{runner.syllabus_id}/download",
            headers={"Authorization": f"Bearer {runner.cognito_token}"},
            timeout=10
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        print(f"Download response keys: {list(data.keys())}")
        assert "url" in data, "Should return presigned URL"
        assert "gryph-os" in data["url"], "URL should reference S3 bucket"
        print(f"✓ Presigned URL generated for S3")

    runner.test("Syllabus download presigned URL", test_syllabus_download)

    # ========================================================================
    # TEST 14: Quiz generation stores file to S3
    # ========================================================================
    def test_quiz_generation():
        if not runner.cognito_token:
            raise AssertionError("No cognito_token")
        
        # Create sample PDF
        import tempfile
        tmp = Path(tempfile.mkdtemp())
        pdf_path = tmp / "material.pdf"
        make_sample_study_material(str(pdf_path))
        
        with open(pdf_path, "rb") as f:
            r = requests.post(
                f"{BASE_URL}/quiz/generate",
                headers={"Authorization": f"Bearer {runner.cognito_token}"},
                files={"file": ("material.pdf", f, "application/pdf")},
                data={
                    "title": "Test Quiz",
                    "topic": "Integration",
                    "num_questions": 3,
                    "difficulty": "medium"
                },
                timeout=60
            )
        
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        print(f"Quiz response keys: {list(data.keys())}")
        
        # Check S3 key
        s3_key = data.get("s3_key")
        assert s3_key is not None, "Should have s3_key"
        assert s3_key.startswith(f"materials/{runner.test_user_id}/"), "Wrong S3 key prefix"
        print(f"✓ S3 key: {s3_key}")
        
        # Check questions
        questions = data.get("questions", [])
        assert len(questions) >= 3, f"Should have at least 3 questions, got {len(questions)}"
        print(f"✓ Generated {len(questions)} questions")
        
        runner.quiz_id = data.get("id")
        pdf_path.unlink()

    runner.test("Quiz generation stores to S3", test_quiz_generation)

    # ========================================================================
    # TEST 15: Schedule call with valid future timestamp
    # ========================================================================
    def test_schedule_call():
        if not runner.cognito_token or not runner.quiz_id:
            raise AssertionError("No cognito_token or quiz_id")
        
        # Schedule 10 minutes in the future
        future = datetime.now(timezone.utc) + timedelta(minutes=10)
        when_iso = future.isoformat()
        
        r = requests.post(
            f"{BASE_URL}/schedule",
            headers={"Authorization": f"Bearer {runner.cognito_token}"},
            json={
                "quiz_id": runner.quiz_id,
                "phone": "+15555550100",
                "when_iso": when_iso,
                "note": "Test scheduled call"
            },
            timeout=10
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        print(f"Schedule response: {json.dumps(data, indent=2)}")
        assert data.get("status") == "scheduled", "Should be scheduled"
        assert data.get("quiz_id") == runner.quiz_id, "Quiz ID mismatch"
        runner.scheduled_call_id = data.get("id")
        print(f"✓ Call scheduled: {runner.scheduled_call_id}")

    runner.test("Schedule call with future timestamp", test_schedule_call)

    # ========================================================================
    # TEST 16: Schedule call with past timestamp returns 400
    # ========================================================================
    def test_schedule_past():
        if not runner.cognito_token or not runner.quiz_id:
            raise AssertionError("No cognito_token or quiz_id")
        
        # Past timestamp
        past = datetime.now(timezone.utc) - timedelta(hours=1)
        when_iso = past.isoformat()
        
        r = requests.post(
            f"{BASE_URL}/schedule",
            headers={"Authorization": f"Bearer {runner.cognito_token}"},
            json={
                "quiz_id": runner.quiz_id,
                "phone": "+15555550100",
                "when_iso": when_iso
            },
            timeout=10
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"
        print(f"✓ Past timestamp rejected with 400")

    runner.test("Schedule with past timestamp returns 400", test_schedule_past)

    # ========================================================================
    # TEST 17: GET /schedule lists scheduled calls
    # ========================================================================
    def test_list_schedule():
        if not runner.cognito_token:
            raise AssertionError("No cognito_token")
        r = requests.get(
            f"{BASE_URL}/schedule",
            headers={"Authorization": f"Bearer {runner.cognito_token}"},
            timeout=10
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        print(f"Schedule list count: {len(data)}")
        assert len(data) > 0, "Should have at least one scheduled call"
        print(f"✓ Found {len(data)} scheduled calls")

    runner.test("GET /schedule lists calls", test_list_schedule)

    # ========================================================================
    # TEST 18: DELETE /schedule/{id} cancels call
    # ========================================================================
    def test_cancel_schedule():
        if not runner.cognito_token or not runner.scheduled_call_id:
            raise AssertionError("No cognito_token or scheduled_call_id")
        r = requests.delete(
            f"{BASE_URL}/schedule/{runner.scheduled_call_id}",
            headers={"Authorization": f"Bearer {runner.cognito_token}"},
            timeout=10
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        print(f"✓ Scheduled call canceled")

    runner.test("DELETE /schedule cancels call", test_cancel_schedule)

    # ========================================================================
    # TEST 19: POST /calls/{session_id}/score requires transcript (400 guard)
    # ========================================================================
    def test_score_no_transcript():
        if not runner.cognito_token:
            raise AssertionError("No cognito_token")
        
        # Use a fake session_id that doesn't exist
        r = requests.post(
            f"{BASE_URL}/calls/fake-session-id/score",
            headers={"Authorization": f"Bearer {runner.cognito_token}"},
            timeout=10
        )
        # Should return 404 (not found) or 400 (no transcript)
        assert r.status_code in (400, 404), f"Expected 400 or 404, got {r.status_code}"
        print(f"✓ Score endpoint guards against missing transcript (status {r.status_code})")

    runner.test("Score endpoint requires transcript", test_score_no_transcript)

    # ========================================================================
    # TEST 20: POST /webhooks/vapi accepts synthetic payload
    # ========================================================================
    def test_vapi_webhook():
        # No auth required for webhook
        payload = {
            "message": {
                "type": "end-of-call-report",
                "call": {
                    "id": "test-call-123",
                    "status": "ended"
                },
                "artifact": {
                    "transcript": "Test transcript"
                },
                "analysis": {
                    "summary": "Test summary"
                }
            }
        }
        r = requests.post(
            f"{BASE_URL}/webhooks/vapi",
            json=payload,
            timeout=10
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get("ok") is True, "Should return ok=true"
        print(f"✓ Webhook accepted synthetic payload")

    runner.test("Vapi webhook accepts payload", test_vapi_webhook)

    # ========================================================================
    # TEST 21: Vapi webhook handles missing fields gracefully
    # ========================================================================
    def test_vapi_webhook_missing_fields():
        payload = {"message": {"type": "unknown"}}
        r = requests.post(
            f"{BASE_URL}/webhooks/vapi",
            json=payload,
            timeout=10
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        print(f"✓ Webhook handles missing fields without crash")

    runner.test("Vapi webhook handles missing fields", test_vapi_webhook_missing_fields)

    # ========================================================================
    # SUMMARY
    # ========================================================================
    success = runner.summary()
    
    print(f"\n{'='*70}")
    print("BACKEND TEST COMPLETE")
    print('='*70)
    print(f"Success rate: {(runner.tests_passed/runner.tests_run*100):.1f}%")
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
