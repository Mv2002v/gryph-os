# Study Assistant — Development Plan (14h demo)

## 1) Objectives
- Prove the **core workflow** works with real services: **Gemini PDF→deadlines**, **Gemini study material→quiz JSON**, **Vapi outbound call**.
- Build a **V1 web app** (React + FastAPI + MongoDB) around the proven core: upload → extract → calendar → quiz gen → call → results.
- Add **email/password auth** with a **test bypass** after core UX is stable.
- Ship a **bright, unique, bug-free UI** with a cool theme + dark mode toggle for demo.

---

## 2) Implementation Steps

### Phase 1 — Core POC (Isolation; do not proceed until green)
**Goal:** 1 Python script that validates the 3 failure-prone integrations end-to-end.

**User stories (POC):**
1. As a builder, I can send a syllabus PDF and get back **strict JSON deadlines**.
2. As a builder, I can upload study material and get back a **strict JSON quiz**.
3. As a builder, I can trigger a **real outbound voice call** via Vapi.
4. As a builder, I can run the script repeatedly with consistent outputs.
5. As a builder, I can see clear logs/errors when something fails.

**Steps:**
1. Web-search quick integration notes: Gemini PDF parsing via Emergent key; Vapi outbound call + how to list phone numbers and obtain `phoneNumberId` for `+1 (774) 334 9020`.
2. Create `poc_integrations.py`:
   - Input: `SYLLABUS_PDF_PATH`, `STUDY_MATERIAL_PATH` (pdf/txt), `TEST_PHONE`.
   - Gemini call #1: extract events as JSON schema: `{course, title, dueDateISO, type, confidence, sourcePage}`.
   - Gemini call #2: generate quiz JSON schema: `{course, questions:[{q, choices[], answerIndex, explanation, difficulty, topic}]}`.
   - Vapi: using provided key, list numbers → map to `phoneNumberId`; place outbound call to `TEST_PHONE` with a minimal quiz script.
3. Iterate prompts/JSON validation until:
   - Deadlines parse is robust across 2-3 sample syllabi.
   - Quiz generator returns valid JSON and good question quality.
   - Vapi call successfully initiates and logs call id + status.

**Exit criteria:** POC script returns (a) valid deadlines JSON, (b) valid quiz JSON, (c) successful Vapi call initiation + status retrieval.

---

### Phase 2 — V1 App Development (Core UX, no auth yet)
**Goal:** Fast MVP UI + API wiring using the already-working integration code from Phase 1.

**User stories (V1 core):**
1. As a student, I can drag+drop 1–5 syllabus PDFs and see “Found X deadlines across Y courses”.
2. As a student, I can view all extracted deadlines on a **calendar** color-coded by course.
3. As a student, I can upload separate study material and generate a quiz for a selected course.
4. As a student, I can click “Call me” and receive an AI phone quiz.
5. As a student, I can see quiz/call results summarized on the dashboard.

**Backend (FastAPI):**
- Models (Mongo): User (optional later), Course, SyllabusUpload, DeadlineEvent, StudyMaterial, Quiz, CallSession/Result.
- Endpoints:
  - `POST /api/syllabi/upload` (multi PDF) → store file → Gemini extract → save events.
  - `GET /api/events` → list events grouped by course.
  - `POST /api/material/upload` → store material.
  - `POST /api/quiz/generate` → Gemini quiz JSON → persist.
  - `POST /api/call/start` → Vapi outbound call using stored quiz.
  - `GET /api/results` → latest quiz/call summaries.

**Frontend (React):**
- Bright, unique theme (gradient surfaces + neon accents) + dark mode toggle.
- Pages:
  - Dashboard: syllabus upload, progress states, “Found X deadlines”.
  - Calendar: month/week view, colored event chips by course.
  - Quiz: upload material → generate → preview questions.
  - Call modal: phone input, course/quiz selection, schedule “call now” (MVP: immediate call).
  - Results panel: call status + quiz outcomes.

**Testing checkpoint (end of Phase 2):** 1 full E2E run: upload syllabus → calendar populated → upload study material → quiz generated → place call → result shown.

---

### Phase 3 — Add Auth + Personalization (email/password + test bypass)
**Goal:** Add auth without breaking core.

**User stories (auth):**
1. As a user, I can sign up with email/password.
2. As a user, I can log in and stay logged in (JWT).
3. As a user, I can use a **test/demo bypass** to access the app quickly during demos.
4. As a user, my uploads/events/quizzes are isolated to my account.
5. As a user, I can log out.

**Steps:**
- Backend: JWT auth, password hashing, user-scoped queries.
- Frontend: Auth screens + “Continue as Demo” bypass.
- Migrate existing collections to include `userId`.

**Testing checkpoint:** create 2 users (or demo + real) → confirm data isolation + core flow still works.

---

### Phase 4 — Polish + Reliability + Demo Readiness
**User stories (polish):**
1. As a student, I see urgency banners (e.g., “Midterm in 3 days”) based on event dates.
2. As a student, I get clear error messages for bad PDFs/LLM failures.
3. As a student, I can edit/delete an extracted event if the model made a mistake.
4. As a student, I can re-generate a quiz with difficulty/length controls.
5. As a student, the UI feels fast and visually delightful.

**Steps:**
- UX polish: skeleton loaders, toasts, empty states, responsive layout.
- Add “Edit deadline” + “Delete event”.
- Add quiz controls: #questions, difficulty.
- Hardening: retries, timeouts, JSON schema validation, audit logging.
- Prepare demo dataset + record backup video.

---

## 3) Next Actions (immediate)
1. Run Phase 1 web-search + create `poc_integrations.py`.
2. Use Vapi key to **list phone numbers** and obtain `phoneNumberId` for `+1 (774) 334 9020`.
3. Validate Gemini prompts + strict JSON parsing for (a) deadlines and (b) quiz.
4. Only after Phase 1 is green: scaffold FastAPI + React, then wire endpoints + UI.

---

## 4) Success Criteria
- POC: deadlines JSON + quiz JSON + Vapi outbound call all work reliably from a standalone script.
- V1: end-to-end web flow works with real uploads and live calendar rendering.
- Auth: login/signup + demo bypass works; user data is isolated.
- UI: bright unique theme, responsive, no broken states; demo-ready with backup video.
