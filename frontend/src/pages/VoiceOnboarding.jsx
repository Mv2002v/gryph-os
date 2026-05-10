/**
 * VoiceOnboarding — Gryph talks you through setup.
 * Uses Web Speech API (TTS always works; STT Chrome-only with text fallback).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Orb } from '@/components/ui/Orb'
import { GryphLogo } from '@/components/ui/GryphLogo'
import { Ambient } from '@/components/ui/Ambient'
import { HudFrame } from '@/components/ui/HudFrame'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'
import { toast } from 'sonner'

const MONO = "'JetBrains Mono', ui-monospace, monospace"
const HEAD = "'Space Grotesk', ui-sans-serif, system-ui"

// ─── Utilities ────────────────────────────────────────────────────────────────
const NUM_WORDS = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10 }

function parseNumber(text) {
  const t = text.toLowerCase().trim()
  if (NUM_WORDS[t]) return NUM_WORDS[t]
  const n = parseInt((t.match(/\d+/) || [])[0] ?? '')
  return isNaN(n) ? null : Math.min(Math.max(n, 1), 10)
}

function parseCourse(text) {
  const clean = text.trim()
  const m = clean.match(/^([A-Za-z]{2,8})\s*(\d{3,4})/i)
  if (m) {
    const code = `${m[1].toUpperCase()} ${m[2]}`
    const rest = clean.slice(m[0].length).replace(/^[\s,\-–]+/, '').trim()
    return { code, title: rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : '' }
  }
  const words = clean.split(/\s+/)
  return { code: words.slice(0, 2).join(' ').toUpperCase(), title: words.slice(2).join(' ') }
}

// ─── TTS wrapper ─────────────────────────────────────────────────────────────
function makeSpeaker() {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
  if (!synth) return { speak: (_t, cb) => cb?.(), cancel: () => {} }

  const getVoice = () => {
    const voices = synth.getVoices()
    return (
      voices.find(v => /Google.*EN|Samantha|Alex/i.test(v.name) && v.lang.startsWith('en')) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0]
    )
  }

  const trySpeak = (text, cb) => {
    synth.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 0.92; utt.pitch = 1.05
    const v = getVoice()
    if (v) utt.voice = v
    utt.onend = () => cb?.()
    utt.onerror = () => cb?.()
    synth.speak(utt)
  }

  return {
    speak(text, cb) {
      if (synth.getVoices().length > 0) { trySpeak(text, cb); return }
      const onReady = () => trySpeak(text, cb)
      synth.addEventListener('voiceschanged', onReady, { once: true })
      // Fallback if event never fires
      setTimeout(() => { synth.removeEventListener('voiceschanged', onReady); cb?.() }, text.length * 55 + 500)
    },
    cancel() { synth.cancel() },
  }
}

// ─── Mic button ───────────────────────────────────────────────────────────────
function MicBtn({ active, onClick }) {
  return (
    <button onClick={onClick} title={active ? 'Stop' : 'Speak'} style={{
      width: 46, height: 46, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
      background: active ? 'var(--gos-cyan)' : 'rgba(34,211,238,0.10)',
      color: active ? '#0a1330' : 'var(--gos-cyan)',
      boxShadow: active ? '0 0 22px rgba(34,211,238,0.55)' : 'none',
      transition: 'all 220ms', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function VoiceOnboarding() {
  const navigate = useNavigate()
  const { updateMe } = useAuth()

  // ── conversation state ──────────────────────────────────────────────────
  const [step, setStep]         = useState('start') // start|university|degree|semester|num_courses|course_name|course_upload|saving
  const [profile, setProfile]   = useState({ university: '', degree: '', current_semester: '' })
  const [numCourses, setNumCourses] = useState(0)
  const [courseIdx, setCourseIdx]   = useState(0)
  const [courses, setCourses]       = useState([])   // [{code,title,done}]

  // ── UI state ────────────────────────────────────────────────────────────
  const [orbState, setOrbState]   = useState('idle')
  const [gryphMsg, setGryphMsg]   = useState('')
  const [log, setLog]             = useState([])
  const [inputVal, setInputVal]   = useState('')
  const [isListening, setIsListening] = useState(false)
  const [showDrop, setShowDrop]   = useState(false)
  const [dragging, setDragging]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [hasMic]                  = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition))

  // ── refs (for stable callbacks) ─────────────────────────────────────────
  const speakerRef   = useRef(null)
  const recogRef     = useRef(null)
  const fileInputRef = useRef(null)
  const inputRef     = useRef(null)
  const logRef       = useRef(null)

  // Keep mutable copies for use inside speech callbacks
  const stepR        = useRef(step)
  const coursesR     = useRef(courses)
  const courseIdxR   = useRef(courseIdx)
  const numCoursesR  = useRef(numCourses)
  const profileR     = useRef(profile)

  useEffect(() => { stepR.current = step },             [step])
  useEffect(() => { coursesR.current = courses },        [courses])
  useEffect(() => { courseIdxR.current = courseIdx },    [courseIdx])
  useEffect(() => { numCoursesR.current = numCourses },  [numCourses])
  useEffect(() => { profileR.current = profile },        [profile])

  // scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  const addLog = useCallback((role, text) =>
    setLog(prev => [...prev.slice(-14), { role, text }]), [])

  // ── TTS: Gryph speaks ──────────────────────────────────────────────────
  const gryphSay = useCallback((msg, nextStep) => {
    setGryphMsg(msg)
    setOrbState('speaking')
    addLog('gryph', msg)
    speakerRef.current?.speak(msg, () => {
      setOrbState(nextStep === 'course_upload' ? 'idle' : 'listening')
      if (nextStep) setStep(nextStep)
      if (nextStep && nextStep !== 'course_upload' && nextStep !== 'saving') {
        startListeningNow()
      }
    })
  }, [addLog]) // eslint-disable-line

  // ── STT: user speaks ───────────────────────────────────────────────────
  const startListeningNow = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { inputRef.current?.focus(); return }
    recogRef.current?.abort()
    const r = new SR()
    r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1
    r.onstart = () => setIsListening(true)
    r.onresult = (e) => {
      const text = e.results[0][0].transcript
      setInputVal(text)
      dispatchInput(text)
    }
    r.onerror = () => { setIsListening(false); inputRef.current?.focus() }
    r.onend   = () => setIsListening(false)
    r.start()
    recogRef.current = r
    setIsListening(true)
  }, []) // eslint-disable-line

  // ── Advance course loop ────────────────────────────────────────────────
  const advanceToNext = useCallback((prefix = '') => {
    const nextIdx = courseIdxR.current + 1
    setCourseIdx(nextIdx)
    setShowDrop(false)
    setUploading(false)

    if (nextIdx >= numCoursesR.current) {
      // All courses done → save
      setStep('saving')
      setOrbState('thinking')
      const msg = `${prefix} All ${numCoursesR.current} courses loaded. Building your semester now.`
      gryphSay(msg)
      setTimeout(async () => {
        try {
          await updateMe({
            ...profileR.current,
            onboarded: true,
          })
        } catch {}
        setTimeout(() => navigate('/', { replace: true }), 1200)
      }, 2200)
    } else {
      const ords = ['second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth']
      const label = ords[nextIdx - 1] || `course ${nextIdx + 1}`
      gryphSay(`${prefix} ${label} course — go.`, 'course_name')
    }
  }, [gryphSay, navigate, updateMe])

  // ── File upload ────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file?.name.toLowerCase().endsWith('.pdf')) {
      toast.error('PDF only'); return
    }
    const cur = coursesR.current[coursesR.current.length - 1]
    if (!cur) return

    setShowDrop(false)
    setUploading(true)
    setOrbState('thinking')
    gryphSay(`Reading ${cur.code}…`)

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('course_code', cur.code)
      if (cur.title) fd.append('course_title', cur.title)
      const { data } = await api.post('/syllabi/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const ev = data.events?.length ?? data.counts?.events ?? 0
      setCourses(prev => prev.map((c, i) => i === prev.length - 1 ? { ...c, done: true } : c))
      setUploading(false)
      advanceToNext(`Found ${ev} deadline${ev !== 1 ? 's' : ''}.`)
    } catch (err) {
      setUploading(false)
      toast.error(err?.response?.data?.detail || 'Upload failed')
      advanceToNext(`Couldn't read that, but I've added ${cur.code}.`)
    }
  }, [gryphSay, advanceToNext])

  const handleSkip = useCallback(async () => {
    const cur = coursesR.current[coursesR.current.length - 1]
    if (cur) {
      try { await api.post('/courses', { code: cur.code, title: cur.title || undefined }) } catch {}
      setCourses(prev => prev.map((c, i) => i === prev.length - 1 ? { ...c, done: true } : c))
    }
    advanceToNext('Got it.')
  }, [advanceToNext])

  // ── Central input dispatcher ───────────────────────────────────────────
  const dispatchInput = useCallback((raw) => {
    const text = (raw ?? '').trim()
    if (!text) return
    recogRef.current?.abort()
    setIsListening(false)
    setInputVal('')
    addLog('user', text)

    const s = stepR.current

    if (s === 'university') {
      setProfile(p => ({ ...p, university: text }))
      gryphSay(`${text.split(' ')[0]} — nice. What are you studying?`, 'degree')
    } else if (s === 'degree') {
      setProfile(p => ({ ...p, degree: text }))
      gryphSay(`${text}. What semester are you in?`, 'semester')
    } else if (s === 'semester') {
      setProfile(p => ({ ...p, current_semester: text }))
      gryphSay(`Semester ${text}. How many courses this semester?`, 'num_courses')
    } else if (s === 'num_courses') {
      const n = parseNumber(text)
      if (!n) { gryphSay("I didn't catch that — say a number, like three or four."); startListeningNow(); return }
      setNumCourses(n)
      setCourseIdx(0)
      gryphSay(
        `${n} course${n > 1 ? 's' : ''}. Tell me the first one — code and name. Like "CIS 2120 computing systems".`,
        'course_name'
      )
    } else if (s === 'course_name') {
      const { code, title } = parseCourse(text)
      setCourses(prev => [...prev, { code, title, done: false }])
      setShowDrop(true)
      setStep('course_upload')
      gryphSay(`${code}${title ? ' — ' + title : ''}. Drop the outline PDF, or say skip.`)
      // Don't auto-listen during upload step
    } else if (s === 'course_upload') {
      if (/skip/i.test(text)) handleSkip()
    }
  }, [addLog, gryphSay, startListeningNow, handleSkip])

  // ── Init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    speakerRef.current = makeSpeaker()
    const timer = setTimeout(() => {
      gryphSay(
        "Hey. I'm Gryph — your semester OS. What university are you at?",
        'university'
      )
    }, 700)
    return () => {
      clearTimeout(timer)
      speakerRef.current?.cancel()
      recogRef.current?.abort()
    }
  }, []) // eslint-disable-line

  // ── Step label ─────────────────────────────────────────────────────────
  const stepLabel = {
    start: 'INIT', university: 'PROFILE', degree: 'PROFILE', semester: 'PROFILE',
    num_courses: 'COURSES',
    course_name: `COURSE ${courseIdx + 1}/${numCourses || '?'}`,
    course_upload: `COURSE ${courseIdx + 1}/${numCourses || '?'} · UPLOAD`,
    saving: 'SAVING',
  }[step] || 'INIT'

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="scene" style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 24px', gap: 0,
    }}>
      <Ambient />
      <HudFrame status={stepLabel} version="02" />

      {/* Logo */}
      <div style={{ position: 'absolute', top: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
        <GryphLogo />
      </div>

      {/* ── Orb ── */}
      <div style={{ position: 'relative', marginBottom: 28 }}>
        <Orb size={120} state={orbState} />
        {isListening && (
          <>
            <div style={{
              position: 'absolute', inset: -14, borderRadius: '50%',
              border: '2px solid rgba(34,211,238,0.5)',
              animation: 'vo-ping 1.1s cubic-bezier(0,0,.2,1) infinite',
            }}/>
            <div style={{
              position: 'absolute', inset: -28, borderRadius: '50%',
              border: '1px solid rgba(34,211,238,0.2)',
              animation: 'vo-ping 1.1s 0.35s cubic-bezier(0,0,.2,1) infinite',
            }}/>
          </>
        )}
      </div>

      {/* ── Gryph message ── */}
      <div style={{
        fontFamily: HEAD, fontSize: 19, fontWeight: 600,
        color: 'var(--gos-text)', textAlign: 'center',
        maxWidth: 500, lineHeight: 1.45, marginBottom: 20, minHeight: 54,
      }}>
        {gryphMsg}
        {orbState === 'speaking' && (
          <span style={{ color: 'var(--gos-cyan)', animation: 'vo-blink 0.9s infinite', display: 'inline-block', marginLeft: 3 }}>▌</span>
        )}
      </div>

      {/* ── Conversation log ── */}
      <div ref={logRef} style={{
        width: '100%', maxWidth: 460, maxHeight: 112,
        overflowY: 'auto', marginBottom: 18,
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>
        {log.slice(-7).map((l, i, arr) => (
          <div key={i} style={{
            fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.1em',
            color: l.role === 'gryph' ? 'rgba(34,211,238,0.65)' : 'rgba(255,255,255,0.45)',
            textAlign: l.role === 'user' ? 'right' : 'left',
            opacity: 0.3 + (i / arr.length) * 0.7,
            transition: 'opacity 300ms',
          }}>
            {l.role === 'gryph'
              ? <><span style={{ opacity: 0.5 }}>GRYPH</span> {l.text}</>
              : <><span style={{ opacity: 0.5 }}>YOU</span> {l.text.toUpperCase()}</>
            }
          </div>
        ))}
      </div>

      {/* ── Drop zone ── */}
      {showDrop && !uploading && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer?.files?.[0]) }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%', maxWidth: 420, marginBottom: 18,
            border: `2px dashed ${dragging ? 'var(--gos-cyan)' : 'rgba(34,211,238,0.28)'}`,
            borderRadius: 14, padding: '22px 20px', textAlign: 'center',
            background: dragging ? 'rgba(34,211,238,0.07)' : 'rgba(20,40,90,0.03)',
            cursor: 'pointer', transition: 'all 200ms',
            animation: 'vo-fadeup 0.4s ease forwards',
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em',
            color: 'var(--gos-cyan)', textTransform: 'uppercase', marginBottom: 6 }}>
            {dragging ? '↓ Release to upload' : '↑ Drop outline PDF here'}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: 'var(--gos-muted)', letterSpacing: '0.12em' }}>
            or click to browse · PDF only
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      )}

      {/* ── Uploading indicator ── */}
      {uploading && (
        <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--gos-cyan)',
          letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 18,
          animation: 'vo-pulse 1.2s ease infinite',
        }}>
          READING PDF…
        </div>
      )}

      {/* ── Input row ── */}
      {step !== 'saving' && (
        <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 420, alignItems: 'center' }}>
          {hasMic && (
            <MicBtn
              active={isListening}
              onClick={() => isListening ? recogRef.current?.abort() : startListeningNow()}
            />
          )}
          <input
            ref={inputRef}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && inputVal.trim() && dispatchInput(inputVal)}
            placeholder={
              isListening ? 'listening…'
              : step === 'course_upload' ? 'say "skip" or drop the PDF above'
              : 'or type your answer…'
            }
            style={{
              flex: 1, background: 'rgba(20,40,90,0.06)',
              border: `1px solid ${isListening ? 'rgba(34,211,238,0.5)' : 'rgba(20,40,90,0.14)'}`,
              borderRadius: 10, padding: '11px 14px',
              fontFamily: MONO, fontSize: 12, color: 'var(--gos-text)',
              outline: 'none', letterSpacing: '0.06em', transition: 'border-color 200ms',
            }}
          />
          <button
            onClick={() => inputVal.trim() && dispatchInput(inputVal)}
            disabled={!inputVal.trim()}
            style={{
              width: 44, height: 44, borderRadius: 10, border: 'none',
              background: inputVal.trim() ? 'var(--gos-cyan)' : 'rgba(20,40,90,0.07)',
              color: inputVal.trim() ? '#0a1330' : 'var(--gos-muted)',
              cursor: inputVal.trim() ? 'pointer' : 'default',
              fontFamily: MONO, fontSize: 15, fontWeight: 700,
              flexShrink: 0, transition: 'all 200ms',
            }}
          >→</button>
        </div>
      )}

      {/* ── Status: mic hint ── */}
      {!hasMic && step !== 'saving' && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: 'var(--gos-muted)',
          letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 10 }}>
          Voice input requires Chrome · type to continue
        </div>
      )}
      {hasMic && !isListening && step !== 'saving' && step !== 'course_upload' && step !== 'start' && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(34,211,238,0.4)',
          letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 10 }}>
          press mic to speak or type below
        </div>
      )}

      {/* ── Course progress pills ── */}
      {courses.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          {courses.map((c, i) => (
            <div key={i} style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em',
              padding: '3px 11px', borderRadius: 999, textTransform: 'uppercase',
              background: c.done ? 'rgba(52,211,153,0.10)' : 'rgba(34,211,238,0.08)',
              border: `1px solid ${c.done ? 'rgba(52,211,153,0.35)' : 'rgba(34,211,238,0.28)'}`,
              color: c.done ? 'var(--gos-emerald)' : 'var(--gos-cyan)',
              transition: 'all 400ms',
            }}>
              {c.done ? '✓ ' : ''}{c.code}
            </div>
          ))}
        </div>
      )}

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes vo-ping   { 75%,100%{transform:scale(2);opacity:0} }
        @keyframes vo-blink  { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes vo-pulse  { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes vo-fadeup { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
