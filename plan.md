# Study Assistant (StudySpark) — Development Plan (14h demo)

## 1) Objectives
- ✅ Prove the **core workflow** works with real services: **Gemini PDF→deadlines**, **Gemini study material→quiz JSON**, **Vapi outbound call**.
- ✅ Build a **V1 web app** (React + FastAPI + MongoDB) around the proven core: upload → extract → calendar → quiz gen → call → results.
- ✅ Add **email/password auth** with a **demo bypass** (JWT + `/me` + profile update).
- ✅ Ship a **bright, unique, bug-free UI** with a cool theme (Space Grotesk + Figtree, course color palette, cinematic call moment).
- 🔜 Prepare **Phase 3+** enhancements for reliability + demo wow: webhook-based call completion, transcript scoring, reminders/notifications, extra polish.

---

## 2) Implementation Steps

### Phase 1 — Core POC (Isolation; do not proceed until green) ✅ COMPLETE
**Goal:** 1 Python script that validates the 3 failure-prone integrations end-to-end.

**User stories (POC):**
1. ✅ As a builder, I can send a syllabus PDF and get back **strict JSON deadlines**.
2. ✅ As a builder, I can upload study material and get back a **strict JSON quiz**.
3. ✅ As a builder, I can trigger a **real outbound voice call** via Vapi.
4. ✅ As a builder, I can run the script repeatedly with consistent outputs.
5. ✅ As a builder, I can see clear logs/errors when something fails.

**What was built / proven:**
- `tests/poc_integrations.py`:
  - Gemini (**gemini-2.5-pro**) extracts structured deadline JSON from PDF.
  - Gemini (**gemini-2.5-pro**) generates strict quiz JSON from study material.
  - Vapi lists phone numbers and resolves `phoneNumberId` for **+1 (774) 334-9020**.

**Phase 1 results:**
- ✅ Gemini extracted **9 deadlines** from a sample syllabus PDF.
- ✅ Gemini generated a valid **5-question** quiz from study material.
- ✅ Vapi number resolved: **+17743349020 → phoneNumberId `c8c7fcf1-46cf-424d-9878-ef9e239e155c`**.

**Exit criteria:** ✅ Met.

---

### Phase 2 — V1 App Development (Core UX + Auth + UI) ✅ COMPLETE
**Goal:** Build a full V1 web experience around the working integrations with a bright, demo-ready UI.

**User stories (V1 core):**
1. ✅ Student can sign up / log in / demo bypass.
2. ✅ Student can upload a syllabus PDF and see “Found X deadlines…”
3. ✅ Student can view all deadlines on a **calendar** color-coded by course.
4. ✅ Student can upload separate study material and generate a quiz.
5. ✅ Student can click “Call me” and receive an AI phone quiz.
6. ✅ Student can see call status + transcript and call history.

**Backend (FastAPI + MongoDB):**
- ✅ Auth:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `POST /api/auth/demo`
  - `GET /api/auth/me`
  - `PUT /api/auth/me`
  - JWT stored client-side.
- ✅ Syllabus extraction:
  - `POST /api/syllabi/upload` → store file → Gemini extract → create Course + Events.
  - `GET /api/courses`, `GET /api/events`
  - `DELETE /api/events/{id}`, `DELETE /api/courses/{course_id}`
- ✅ Quiz generation (separate study material):
  - `POST /api/quiz/generate` supports file **or** pasted text; supports topic, difficulty, #questions.
  - `GET /api/quizzes`, `GET /api/quizzes/{id}`, `DELETE /api/quizzes/{id}`
- ✅ Vapi calling:
  - `POST /api/call/start` (E.164 validation) → creates call session + starts polling.
  - `GET /api/calls`, `GET /api/calls/{session_id}`
  - Polling-based transcript/status updates (webhook planned for Phase 3).

**Frontend (React + Tailwind + shadcn/ui + framer-motion):**
- ✅ Pages:
  - `/auth` (Login / Signup tabs + **Continue as demo**)
  - `/` Dashboard (bento layout: upload + urgency + stats)
  - `/calendar` Month calendar with event chips; event dialog + delete
  - `/quiz` Quiz Studio (upload/text → generate; preview + library)
  - `/calls` Call Center (quiz picker + phone normalization + cinematic active call modal)
  - `/settings` Profile updates (name + phone)
- ✅ UI/Theme:
  - Bright unique theme with subtle gradient blobs (≤20% viewport) and solid cards.
  - Typography: **Space Grotesk** headings, **Figtree** body.
  - Course palette: **sky/lime/sun/pink/teal/violet/orange** chips and dots.
  - Animations: framer-motion page transitions; `animate-callPulse` + `animate-ringWiggle` for the call wow moment.

**Testing checkpoint (end of Phase 2):** ✅ Passed.
- ✅ Automated testing: **23/23 backend tests passed** + all key frontend flows validated.

---

### Phase 3 — Reliability + Voice Call Completion + Results (Post-V1) 🔜 NEXT
**Goal:** Improve call reliability, reduce polling, and produce meaningful “results” (scoring + summaries) from calls.

**User stories (Phase 3):**
1. As a student, I see **final call results** quickly without waiting for polling.
2. As a student, I receive a **score breakdown** after the call.
3. As a student, my quiz performance is tracked over time.
4. As a builder, I can scale call flow with fewer background jobs.
5. As a builder, I can debug call outcomes reliably.

**Implementation steps:**
- Webhook-based end-of-call completion:
  - Add `POST /api/webhooks/vapi` endpoint.
  - Configure assistant `server.url` + `serverMessages` to send `end-of-call-report` and transcript.
  - Verify authenticity (Vapi credential-based webhook auth) and persist artifacts.
- Score extraction from transcript:
  - Post-process transcript with Gemini to compute:
    - per-question correctness
    - confidence/quality notes
    - total score and study recommendations
  - Store `score`, `breakdown`, and `recommendations` in `CallSession`.
- Replace/augment polling:
  - Keep polling as fallback; prefer webhook updates.
- Hardening:
  - retries/timeouts for external calls
  - JSON schema validation for LLM outputs
  - audit logs for uploads/calls

**Testing checkpoint:**
- Webhook event updates DB within seconds of call completion.
- Score generation stable across 3 transcripts.

---

### Phase 4 — Polish + Demo Readiness + Growth Features 🔜 OPTIONAL
**Goal:** Ship extra wow + student retention features.

**User stories (polish):**
1. As a student, I get **reminders** before deadlines.
2. As a student, I can schedule a call “tonight at 7pm.”
3. As a student, I can edit incorrect extracted deadlines.
4. As a student, I have a clean mobile experience.
5. As a student, the UI feels premium and delightful.

**Implementation steps:**
- Notifications/reminders:
  - Email reminders (SendGrid) or cron-based backend reminders.
  - Optional push notifications.
- Call scheduling:
  - Allow scheduling times; store planned call time.
- Editing events:
  - UI + API to edit event title/date/type.
- UI enhancements:
  - skeleton loaders for AI steps
  - optional confetti/Lottie for “Found X deadlines”
  - responsive refinements (mobile-first layouts)

---

## 3) Next Actions (immediate)
1. ✅ Completed: POC + V1 build + full testing.
2. 🔜 Add Vapi webhook endpoint and switch from polling-first to webhook-first.
3. 🔜 Add transcript scoring + results breakdown using Gemini.
4. 🔜 Add reminders + scheduling (optional depending on demo goals).

---

## 4) Success Criteria
- ✅ POC: deadlines JSON + quiz JSON + Vapi number resolution works reliably.
- ✅ V1: end-to-end web flow works: auth → upload syllabus → calendar → quiz gen → call request → transcript/history.
- ✅ UI: bright unique theme, responsive layout, cinematic call panel.
- 🔜 Phase 3+: webhook-based completion and meaningful scored results.
- 🔜 Phase 4+: reminders, scheduling, mobile refinements, additional polish.
