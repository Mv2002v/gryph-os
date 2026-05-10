import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

import { GryphLogo } from '@/components/ui/GryphLogo'
import { Ambient } from '@/components/ui/Ambient'
import { HudFrame } from '@/components/ui/HudFrame'
import { Typed } from '@/components/ui/Typed'
import { Orb } from '@/components/ui/Orb'
import { FlowControls } from '@/components/ui/FlowControls'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'
import VoiceOnboarding from '@/pages/VoiceOnboarding'

const MONO = "'JetBrains Mono', ui-monospace, monospace"
const HEAD = "'Space Grotesk', ui-sans-serif, system-ui"

const SCENE_LIST = ['boot', 'hero', 'auth', 'voice', 'dashboard']

const transition = { duration: 0.35, ease: [0.16, 1, 0.3, 1] }

// ─── spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
      style={{ animation: 'spin 0.7s linear infinite', display: 'inline-block' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="7" cy="7" r="5" stroke="rgba(10,19,48,0.3)" strokeWidth="2" />
      <path d="M7 2 A5 5 0 0 1 12 7" stroke="#0a1330" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE 1 — BOOT
// ═══════════════════════════════════════════════════════════════════════════════
const BOOT_LINES = [
  { t: 'GRYPH-OS // BOOTSTRAP',            d: 0 },
  { t: '> mounting kernel…',               d: 250 },
  { t: '> loading neural runtime…',        d: 600 },
  { t: '> connecting to syllabus.fs…',     d: 950 },
  { t: '> calibrating semester index…',    d: 1250 },
  { t: '> ready',                          d: 1700, cls: 'ok' },
]

function SceneBoot({ onAdvance }) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const timers = BOOT_LINES.map((l, i) => setTimeout(() => setShown(i + 1), l.d))
    const finish = setTimeout(() => onAdvance('hero'), 3400)
    return () => { timers.forEach(clearTimeout); clearTimeout(finish) }
  }, [onAdvance])

  return (
    <div className="scene">
      <div className="boot-wrap">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <GryphLogo size="lg" />
        </div>
        {BOOT_LINES.slice(0, shown).map((l, i) => (
          <div key={i} className="boot-line">
            <span className={l.cls || ''}>{l.t}</span>
          </div>
        ))}
        <div className="boot-bar">
          <div style={{ width: (shown / BOOT_LINES.length * 100) + '%', transition: 'width 400ms ease' }} />
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE 2 — HERO
// ═══════════════════════════════════════════════════════════════════════════════
function SceneHero({ onAdvance }) {
  return (
    <div className="scene">
      <Ambient />
      <HudFrame status="ENTRYPOINT" version="01" />

      <header style={{ position: 'absolute', top: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
        <GryphLogo />
      </header>

      <div className="hero">
        <div>
          <div className="eyebrow hero-eyebrow" style={{ animation: 'fadeUp 0.5s ease forwards' }}>
            <span className="pulse" />The semester operating system
          </div>
          <h1 className="h-display" style={{ margin: '0 0 22px', animation: 'fadeUp 0.5s 0.1s ease both' }}>
            Your semester,<br />
            <span className="em">decoded.</span>
          </h1>
          <p className="lead" style={{ marginBottom: 36, animation: 'fadeUp 0.5s 0.2s ease both' }}>
            Drop in your course outlines. Gryph-OS reads them, extracts every deadline, and arranges your semester into a calendar that runs itself.
          </p>
          <div className="hero-cta" style={{ animation: 'fadeUp 0.5s 0.3s ease both' }}>
            <button className="btn btn-primary" onClick={() => onAdvance('auth')}>
              Get Started <span className="btn-arrow">→</span>
            </button>
            <button className="btn btn-ghost" onClick={() => onAdvance('auth')}>Sign In</button>
          </div>
          <dl className="hero-meta" style={{ animation: 'fadeUp 0.5s 0.4s ease both' }}>
            <div>
              <dt>Outlines parsed</dt>
              <dd>2,143<span className="unit">/sem</span></dd>
            </div>
            <div>
              <dt>Avg. deadlines found</dt>
              <dd>27<span className="unit">/student</span></dd>
            </div>
            <div>
              <dt>Hours saved</dt>
              <dd>9.4<span className="unit">/wk</span></dd>
            </div>
          </dl>
        </div>

        <div className="hero-preview" style={{ animation: 'fadeUp 0.5s 0.2s ease both' }}>
          <div className="hpv hpv-1">
            <h4>NEXT 72 HOURS</h4>
            <div className="row" style={{ display: 'flex' }}>
              <span>CIS 2120 · Lab 04</span>
              <span className="chip" style={{ background: 'rgba(34,211,238,0.15)', color: 'var(--c-cs)' }}>14h</span>
            </div>
            <div className="row" style={{ display: 'flex' }}>
              <span>MATH 1200 · A2</span>
              <span className="chip" style={{ background: 'rgba(167,139,250,0.15)', color: 'var(--c-math)' }}>1d</span>
            </div>
            <div className="row" style={{ display: 'flex' }}>
              <span>PHYS 1080 · Quiz</span>
              <span className="chip" style={{ background: 'rgba(251,191,36,0.15)', color: 'var(--c-phys)' }}>2d</span>
            </div>
            <div className="row" style={{ display: 'flex' }}>
              <span>ENG 1500 · Essay</span>
              <span className="chip" style={{ background: 'rgba(236,72,153,0.15)', color: 'var(--c-eng)' }}>3d</span>
            </div>
          </div>

          <div className="hpv hpv-2">
            <h4>EXTRACTING…</h4>
            <div style={{ fontSize: 10, color: 'var(--gos-cyan)', marginBottom: 8 }}>cis2120_outline.pdf</div>
            <div style={{ height: 3, background: 'rgba(34,211,238,0.5)', width: '80%', borderRadius: 2 }} />
            <div style={{ height: 3, background: 'rgba(167,139,250,0.4)', width: '60%', borderRadius: 2, marginTop: 4 }} />
            <div style={{ height: 3, background: 'rgba(236,72,153,0.4)', width: '40%', borderRadius: 2, marginTop: 4 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 10 }}>
              <span style={{ color: 'var(--gos-muted)' }}>Found</span>
              <span style={{ color: 'var(--gos-cyan)' }}>9 deadlines</span>
            </div>
          </div>

          <div className="hpv hpv-3">
            <h4>WEEK 12 · NOV</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, fontSize: 10 }}>
              {Array.from({ length: 14 }).map((_, i) => {
                const accent = [3, 6, 9, 11].includes(i)
                const c = i === 3 ? 'var(--c-cs)' : i === 6 ? 'var(--c-math)' : i === 9 ? 'var(--c-phys)' : i === 11 ? 'var(--c-eng)' : 'transparent'
                return (
                  <div key={i} style={{ aspectRatio: '1/1', borderRadius: 4, background: 'rgba(20,40,90,0.04)', padding: 3, color: 'var(--gos-muted)', fontSize: 8, position: 'relative' }}>
                    {i + 10}
                    {accent && <div style={{ position: 'absolute', bottom: 3, left: 3, right: 3, height: 3, background: c, borderRadius: 2, boxShadow: '0 0 6px ' + c }} />}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE 3 — AUTH
// ═══════════════════════════════════════════════════════════════════════════════
function SceneAuth({ onAdvance, setFlowState }) {
  const [tab, setTab] = useState('signup')
  const [busy, setBusy] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const { login, signup } = useAuth()

  const { register, handleSubmit, formState: { errors }, reset } = useForm()

  const switchTab = (next) => { setTab(next); setFormKey(k => k + 1); reset() }

  const onSubmit = async (data) => {
    setBusy(true)
    try {
      let user
      if (tab === 'login') {
        user = await login(data.email, data.password)
        toast.success('Welcome back.')
      } else {
        user = await signup(data.email, data.password, data.name || '')
        toast.success('Account created.')
      }
      setFlowState(prev => ({ ...prev, user }))
      onAdvance('voice')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  const errMsg = { fontFamily: MONO, fontSize: 10, color: '#f87171', marginTop: 5, letterSpacing: '0.1em' }

  return (
    <div className="scene">
      <Ambient />
      <HudFrame status="AUTHENTICATE" version="02" />

      <header style={{ position: 'absolute', top: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
        <GryphLogo />
      </header>

      <div className="glass auth-card" style={{ animation: 'fadeUp 0.5s ease forwards' }}>
        <h2>Welcome back.</h2>
        <p className="sub">Continue to your semester dashboard.</p>

        <div className="auth-tabs">
          {['login', 'signup'].map(t => (
            <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => switchTab(t)}>
              {t === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form key={formKey} onSubmit={handleSubmit(onSubmit)} noValidate className="auth-fields">
          {tab === 'signup' && (
            <div className="field">
              <label className="field-label">Full Name</label>
              <input className="field-input" type="text" placeholder="Alex Patel" {...register('name')} />
            </div>
          )}
          <div className="field">
            <label className="field-label">Email</label>
            <input className="field-input" type="email" placeholder="alex@uoguelph.ca"
              {...register('email', { required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' } })} />
            {errors.email && <span style={errMsg}>{errors.email.message}</span>}
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <input className="field-input" type="password"
              placeholder={tab === 'signup' ? 'Min. 8 characters' : '••••••••••'}
              {...register('password', { required: 'Password is required', minLength: tab === 'signup' ? { value: 8, message: 'At least 8 characters' } : undefined })} />
            {errors.password && <span style={errMsg}>{errors.password.message}</span>}
          </div>
          <button type="submit" disabled={busy} className="btn btn-primary" style={{ justifyContent: 'center' }}>
            {busy && <Spinner />}
            {busy ? 'Authenticating…' : tab === 'login' ? 'Authenticate' : 'Create & Continue'}
            {!busy && <span className="btn-arrow">→</span>}
          </button>
        </form>

        <div className="auth-foot">
          {tab === 'login'
            ? <>New here? <a onClick={() => switchTab('signup')}>Create an account</a></>
            : <>Already have one? <a onClick={() => switchTab('login')}>Sign in</a></>}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE 4 — PROFILE
// ═══════════════════════════════════════════════════════════════════════════════
function SceneProfile({ onAdvance }) {
  const { updateMe } = useAuth()
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit } = useForm()

  const onSubmit = async (data) => {
    setBusy(true)
    try {
      const patch = {}
      if (data.university) patch.university = data.university
      if (data.degree) patch.degree = data.degree
      if (data.target_gpa) patch.target_gpa = parseFloat(data.target_gpa)
      if (data.current_semester) patch.current_semester = data.current_semester
      await updateMe(patch)
      toast.success('Profile saved.')
    } catch {
      toast.error('Could not save profile — continuing anyway.')
    } finally {
      setBusy(false)
      onAdvance('upload')
    }
  }

  return (
    <div className="scene">
      <Ambient />
      <HudFrame status="ONBOARD" version="03" />

      <div className="onb-shell">
        <div className="onb-left">
          <div className="onb-step" style={{ animation: 'fadeUp 0.5s ease forwards' }}>PHASE 03 / PROFILE</div>
          <h2 className="onb-title" style={{ animation: 'fadeUp 0.5s 0.1s ease both' }}>
            Tell me <span style={{ color: 'var(--gos-cyan)' }}>where you study.</span>
          </h2>
          <div className="onb-orb-row" style={{ animation: 'fadeUp 0.5s 0.2s ease both' }}>
            <Orb size={64} state="speaking" />
            <div className="ai-bubble">
              <Typed
                text="Welcome. To plan your semester, I need four things: where you study, what you study, where you are now, and where you're aiming."
                speed={22}
              />
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', color: 'var(--gos-muted)', textTransform: 'uppercase', animation: 'fadeUp 0.5s 0.4s ease both' }}>
            ↳ Estimated time · 30 seconds
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="glass onb-form" style={{ animation: 'fadeUp 0.5s 0.3s ease both' }}>
          <div className="field">
            <label className="field-label">University</label>
            <input className="field-input" placeholder="University of Guelph" {...register('university')} />
          </div>
          <div className="field">
            <label className="field-label">Degree / Program</label>
            <input className="field-input" placeholder="Bachelor of Computing" {...register('degree')} />
          </div>
          <div className="onb-form-row">
            <div className="field">
              <label className="field-label">Current Semester</label>
              <input className="field-input" placeholder="2" {...register('current_semester')} />
            </div>
            <div className="field">
              <label className="field-label">Target GPA</label>
              <input className="field-input" type="number" placeholder="3.8" min="0" max="4" step="0.1" {...register('target_gpa')} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button type="submit" disabled={busy} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              {busy && <Spinner />}
              Save Details <span className="btn-arrow">→</span>
            </button>
            <button type="button" onClick={() => onAdvance('upload')} className="btn btn-ghost">Skip</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE 5 — UPLOAD
// ═══════════════════════════════════════════════════════════════════════════════
function SceneUpload({ onExtract }) {
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const addFiles = (incoming) => {
    const pdfs = Array.from(incoming).filter(f => f.type === 'application/pdf')
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name))
      return [...prev, ...pdfs.filter(f => !names.has(f.name))]
    })
  }

  return (
    <div className="scene">
      <Ambient />
      <HudFrame status="INGEST" version="04" />

      <div className="onb-shell">
        <div className="onb-left">
          <div className="onb-step" style={{ animation: 'fadeUp 0.5s ease forwards' }}>PHASE 04 / OUTLINES</div>
          <h2 className="onb-title" style={{ animation: 'fadeUp 0.5s 0.1s ease both' }}>
            Upload your <span style={{ color: 'var(--gos-cyan)' }}>course outlines.</span>
          </h2>
          <div className="onb-orb-row" style={{ animation: 'fadeUp 0.5s 0.2s ease both' }}>
            <Orb size={64} state="speaking" />
            <div className="ai-bubble">
              <Typed
                text="Drop in every syllabus PDF for this semester. I'll read them, extract the dates, and arrange your calendar around them."
                speed={20}
              />
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', color: 'var(--gos-muted)', textTransform: 'uppercase', marginTop: 4, animation: 'fadeUp 0.5s 0.5s ease both' }}>
            <span style={{ color: 'var(--gos-cyan)' }}>{files.length}</span> / — outlines staged
          </div>
        </div>

        <div className="glass onb-form" style={{ animation: 'fadeUp 0.5s 0.3s ease both' }}>
          <div
            className={`upload-zone${dragging ? ' drag' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
          >
            <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
            <div className="icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3v5h5" /><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2z" /><path d="M12 11v6" /><path d="M9 14l3-3 3 3" />
              </svg>
            </div>
            <h3>{dragging ? 'Release to add…' : 'Drop course outline PDFs here'}</h3>
            <p className="hint">PDF files only · up to 12 MB each</p>
          </div>

          {files.length > 0 && (
            <div className="uploaded-list">
              {files.map((f, i) => (
                <div key={i} className="upd-card">
                  <div className="pdf-icon" />
                  <div className="name">{f.name.replace(/\.pdf$/i, '')}</div>
                  <div className="meta">{(f.size / 1024).toFixed(0)} KB · staged</div>
                </div>
              ))}
            </div>
          )}

          <button
            className="btn btn-primary"
            disabled={files.length === 0}
            onClick={() => onExtract(files)}
            style={{ justifyContent: 'center', opacity: files.length === 0 ? 0.5 : 1 }}
          >
            Read Files <span className="btn-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE 6 — EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

const COURSE_COLORS = ['--c-cs', '--c-math', '--c-phys', '--c-eng', '--c-bus']

const MOCK_DEADLINES = [
  { day: 4,  course: 0, label: 'Lab 02' },
  { day: 7,  course: 1, label: 'A1' },
  { day: 10, course: 2, label: 'Quiz' },
  { day: 12, course: 3, label: 'Reading' },
  { day: 14, course: 0, label: 'A2' },
  { day: 17, course: 1, label: 'Midterm' },
  { day: 19, course: 3, label: 'Essay 1' },
  { day: 21, course: 2, label: 'Lab 03' },
  { day: 23, course: 0, label: 'Project' },
  { day: 25, course: 3, label: 'Group' },
  { day: 27, course: 1, label: 'A3' },
  { day: 29, course: 2, label: 'Final' },
]

function buildCells(year, monthIdx) {
  const first = new Date(year, monthIdx, 1)
  const startDay = first.getDay()
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startDay; i++) cells.push({ day: null })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d })
  while (cells.length % 7 !== 0) cells.push({ day: null })
  return cells
}

function SceneExtraction({ extractionData, extractionError, onAdvance }) {
  const navigate = useNavigate()
  const { updateMe } = useAuth()
  const [statusText, setStatusText] = useState('Reading syllabus…')
  const [revealed, setRevealed] = useState([])
  const [done, setDone] = useState(false)
  const calendarCells = useMemo(() => buildCells(2025, 9), [])

  const displayDeadlines = useMemo(() => {
    if (extractionData?.events?.length) {
      return extractionData.events.slice(0, 12).map((ev, i) => ({
        day: ev.day || MOCK_DEADLINES[i % MOCK_DEADLINES.length].day,
        course: i % COURSE_COLORS.length,
        label: ev.label || ev.title || MOCK_DEADLINES[i % MOCK_DEADLINES.length].label,
      }))
    }
    return MOCK_DEADLINES
  }, [extractionData])

  useEffect(() => {
    const t1 = setTimeout(() => setStatusText('Cross-referencing…'), 3000)
    const t2 = setTimeout(() => setStatusText('Extraction complete'), 6000)
    const t3 = setTimeout(() => setDone(true), 9000)

    const revealTimers = displayDeadlines.map((_, i) =>
      setTimeout(() => setRevealed(prev => [...prev, i]), 600 + i * 550)
    )

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
      revealTimers.forEach(clearTimeout)
    }
  }, [displayDeadlines])

  useEffect(() => {
    if (extractionData && revealed.length >= displayDeadlines.length) setDone(true)
  }, [extractionData, revealed, displayDeadlines])

  const handleGoToDashboard = useCallback(async () => {
    try {
      await updateMe({ onboarded: true })
    } catch {
      // non-critical — proceed anyway
    }
    navigate('/', { replace: true })
  }, [updateMe, navigate])

  return (
    <div className="scene" style={{ display: 'block' }}>
      <Ambient />
      <HudFrame status="EXTRACTING" version="05" />

      <div className="extract-stage">
        <div className="extract-head">
          <div className="extract-status" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gos-muted)' }}>
            STATUS · {extractionError
              ? <span style={{ color: '#f87171' }}>EXTRACTION FAILED</span>
              : done
                ? <span style={{ color: 'var(--gos-emerald)' }}>EXTRACTION COMPLETE</span>
                : <span style={{ color: 'var(--gos-cyan)' }}>{statusText.toUpperCase()}</span>}
          </div>
          <div className="extract-stats" style={{ display: 'flex', gap: 28, fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', color: 'var(--gos-muted)', textTransform: 'uppercase' }}>
            <div><span style={{ fontFamily: HEAD, fontSize: 22, color: 'var(--gos-text)', fontWeight: 600, marginRight: 5 }}>{revealed.length}</span>deadlines</div>
            <div><span style={{ fontFamily: HEAD, fontSize: 22, color: 'var(--gos-text)', fontWeight: 600, marginRight: 5 }}>4</span>courses</div>
            <div><span style={{ fontFamily: HEAD, fontSize: 22, color: 'var(--gos-text)', fontWeight: 600, marginRight: 5 }}>{Math.round((revealed.length / MOCK_DEADLINES.length) * 100)}<span style={{ fontSize: 14 }}>%</span></span>parsed</div>
          </div>
        </div>

        <div className="extract-main" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'start' }}>
          {/* PDF deck + orb */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 32 }}>
            <Orb size={72} state="thinking" />
            <div style={{ position: 'relative', width: 220, height: 280 }}>
              {[
                { top: 16, left: 16, delay: '0s', zIndex: 1 },
                { top: 8,  left: 8,  delay: '0.3s', zIndex: 2 },
                { top: 0,  left: 0,  delay: '0.6s', zIndex: 3 },
              ].map((p, i) => (
                <div key={i} style={{
                  position: 'absolute', top: p.top, left: p.left,
                  width: 200, height: 260,
                  background: 'rgba(255,255,255,0.92)',
                  border: '1px solid rgba(34,211,238,0.25)',
                  borderRadius: 10, zIndex: p.zIndex, padding: 14,
                  boxShadow: '0 8px 32px rgba(20,40,90,0.1)',
                  overflow: 'hidden',
                  animation: `pdfFly 3s ${p.delay} ease-in-out infinite`,
                }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--gos-cyan), transparent)', opacity: 0.6, animation: 'scanY 2.5s linear infinite' }} />
                  <div style={{ height: 6, background: 'rgba(34,211,238,0.4)', borderRadius: 3, marginBottom: 8 }} />
                  <div style={{ height: 4, background: 'rgba(20,40,90,0.08)', borderRadius: 2, marginBottom: 5, width: '75%' }} />
                  <div style={{ height: 4, background: 'rgba(20,40,90,0.06)', borderRadius: 2, marginBottom: 5, width: '55%' }} />
                  <div style={{ height: 4, background: 'rgba(167,139,250,0.4)', borderRadius: 2, marginBottom: 5 }} />
                  <div style={{ height: 4, background: 'rgba(20,40,90,0.06)', borderRadius: 2, marginBottom: 5, width: '65%' }} />
                  <div style={{ height: 4, background: 'rgba(236,72,153,0.35)', borderRadius: 2, marginBottom: 5, width: '45%' }} />
                  <div style={{ height: 4, background: 'rgba(20,40,90,0.06)', borderRadius: 2, marginBottom: 5 }} />
                  <div style={{ height: 4, background: 'rgba(34,211,238,0.35)', borderRadius: 2, marginBottom: 5, width: '80%' }} />
                </div>
              ))}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: done ? 'var(--gos-emerald)' : 'var(--gos-cyan)', textAlign: 'center', transition: 'color 400ms' }}>
              {extractionError ? <span style={{ color: '#f87171' }}>{extractionError}</span> : statusText}
            </div>
          </div>

          {/* Calendar grid */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <span style={{ fontFamily: HEAD, fontSize: 18, fontWeight: 600, color: 'var(--gos-text)' }}>October 2025</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--gos-muted)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Semester 02 · Week 06</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                <div key={d} style={{ fontFamily: MONO, fontSize: 9, color: 'var(--gos-muted)', letterSpacing: '0.12em', textAlign: 'center', textTransform: 'uppercase' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {calendarCells.map((cell, i) => {
                const eventsForDay = cell.day ? displayDeadlines.filter((d, di) => d.day === cell.day && revealed.includes(di)) : []
                return (
                  <div key={i} style={{ minHeight: 44, borderRadius: 6, background: cell.day ? 'rgba(255,255,255,0.6)' : 'transparent', border: cell.day ? '1px solid rgba(20,40,90,0.06)' : 'none', padding: '4px 3px', overflow: 'hidden' }}>
                    {cell.day && <div style={{ fontFamily: MONO, fontSize: 9, color: 'var(--gos-muted)', textAlign: 'right', marginBottom: 2, paddingRight: 2 }}>{cell.day}</div>}
                    {eventsForDay.map((ev, ei) => (
                      <div key={ei} style={{
                        fontSize: 8, fontFamily: MONO,
                        color: `var(${COURSE_COLORS[ev.course]})`,
                        background: ['rgba(34,211,238,0.15)', 'rgba(167,139,250,0.15)', 'rgba(251,191,36,0.15)', 'rgba(236,72,153,0.15)', 'rgba(52,211,153,0.15)'][ev.course] || 'rgba(34,211,238,0.15)',
                        borderRadius: 3, padding: '1px 3px', marginBottom: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        animation: `eventDrop 0.6s ${ei * 150}ms forwards`, opacity: 0,
                      }}>
                        {ev.label}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
              {['CIS 2120', 'MATH 1200', 'PHYS 1080', 'ENGG 1500', 'Other'].map((name, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 9, color: 'var(--gos-muted)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: `var(${COURSE_COLORS[i]})`, boxShadow: `0 0 6px var(${COURSE_COLORS[i]})`, display: 'inline-block', flexShrink: 0 }} />
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {done && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, animation: 'fadeUp 0.5s ease forwards' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 12, color: 'var(--gos-emerald)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gos-emerald)', boxShadow: '0 0 10px var(--gos-emerald)', display: 'inline-block' }} />
              Calendar built · {revealed.length} deadlines indexed
            </div>
            <button onClick={handleGoToDashboard} className="btn btn-primary" style={{ padding: '12px 36px' }}>
              → Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ONBOARDING FLOW
// ═══════════════════════════════════════════════════════════════════════════════
export default function OnboardingFlow() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (user?.onboarded === true) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  const [scene, setScene] = useState('boot')
  const [direction, setDirection] = useState(1)

  const [flowState, setFlowState] = useState({
    user: null,
    uploadedFiles: [],
    extractionData: null,
  })
  const [extractionData, setExtractionData] = useState(null)
  const [extractionError, setExtractionError] = useState(null)

  const sceneIdx = SCENE_LIST.indexOf(scene)

  const advanceTo = useCallback((next) => {
    const nextIdx = SCENE_LIST.indexOf(next)
    if (next === 'dashboard') {
      navigate('/', { replace: true })
      return
    }
    setDirection(nextIdx > sceneIdx ? 1 : -1)
    setScene(next)
  }, [sceneIdx, navigate])

  const handleExtract = useCallback(async (files) => {
    setFlowState(prev => ({ ...prev, uploadedFiles: files }))
    advanceTo('extraction')

    const allEvents = []
    let lastError = null

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const { data } = await api.post('/syllabi/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        if (data?.events) allEvents.push(...data.events)
      } catch (err) {
        const detail = err?.response?.data?.detail || err?.message || 'Unknown error'
        lastError = `Failed on ${file.name}: ${detail}`
      }
    }

    if (allEvents.length > 0) {
      const merged = { events: allEvents }
      setExtractionData(merged)
      setFlowState(prev => ({ ...prev, extractionData: merged }))
    } else {
      setExtractionError(lastError || 'Extraction failed — check that the backend is running and your Gemini API key is valid.')
    }
  }, [advanceTo])

  const motionVariants = {
    enter: { opacity: 0, x: direction * 40 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: direction * -40 },
  }

  return (
    <div className="stage">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={scene}
          variants={motionVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={transition}
          style={{ position: 'absolute', inset: 0 }}
        >
          {scene === 'boot' && <SceneBoot onAdvance={advanceTo} />}
          {scene === 'hero' && <SceneHero onAdvance={advanceTo} />}
          {scene === 'auth' && <SceneAuth onAdvance={advanceTo} setFlowState={setFlowState} />}
          {scene === 'voice' && <VoiceOnboarding />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
