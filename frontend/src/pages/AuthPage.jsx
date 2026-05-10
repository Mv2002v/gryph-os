import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import { GryphLogo } from '@/components/ui/GryphLogo'
import { Ambient } from '@/components/ui/Ambient'
import { HudFrame } from '@/components/ui/HudFrame'

/* ── inject auth-specific keyframes once ── */
function useAuthKeyframes() {
  useState(() => {
    const id = 'gryph-auth-kf'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes authFadeUp {
        0%   { opacity: 0; transform: translateY(18px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes authTabFade {
        0%   { opacity: 0; }
        100% { opacity: 1; }
      }
    `
    document.head.appendChild(style)
  })
}

/* ── spinner SVG ── */
function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ animation: 'spin 0.7s linear infinite', display: 'inline-block' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="8" cy="8" r="6"
        stroke="rgba(10,19,48,0.35)"
        strokeWidth="2"
      />
      <path
        d="M8 2 A6 6 0 0 1 14 8"
        stroke="#0a1330"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function AuthPage() {
  useAuthKeyframes()

  const [tab, setTab] = useState('login')  // 'login' | 'signup'
  const [busy, setBusy] = useState(false)
  const [formKey, setFormKey] = useState(0) // forces form re-mount on tab switch for clean animation
  const { login, signup } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm()

  const switchTab = (next) => {
    setTab(next)
    setFormKey((k) => k + 1)
    reset()
  }

  const onSubmit = async (data) => {
    setBusy(true)
    try {
      if (tab === 'login') {
        await login(data.email, data.password)
        toast.success('Welcome back.')
        navigate('/', { replace: true })
      } else {
        const result = await signup(data.email, data.password, data.name || '')
        if (result?.auto_login === false) {
          // Account created but auto-login couldn't complete — guide to sign in
          toast.success('Account created! Sign in below to continue.')
          switchTab('login')
        } else {
          toast.success('Account created.')
          navigate('/onboarding', { replace: true })
        }
      }
    } catch (err) {
      const detail = err?.response?.data?.detail
      if (err?.response?.status === 409) {
        toast.error(detail || 'An account with this email already exists.')
        switchTab('login')
      } else {
        toast.error(detail || 'Authentication failed. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  /* ── styles ── */
  const label = {
    display: 'block',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: 'var(--gos-muted)',
    marginBottom: 6,
  }

  const fieldWrap = { display: 'flex', flexDirection: 'column', marginBottom: 18 }

  const errorMsg = {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    color: '#f87171',
    marginTop: 5,
    letterSpacing: '0.1em',
  }

  return (
    <div className="stage">
      <Ambient />
      <HudFrame status="SYS·ONLINE" version="v2.1" />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          overflow: 'auto',
        }}
      >
        {/* Auth card */}
        <div
          className="glass"
          style={{
            width: '100%',
            maxWidth: 440,
            padding: 40,
            borderRadius: 20,
            boxShadow: 'var(--shadow-pop)',
            animation: 'authFadeUp 0.6s cubic-bezier(.16,1,.3,1) forwards',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <GryphLogo size="sm" tagline="your academic co-pilot" />
          </div>

          {/* Tab switcher */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(20,40,90,0.06)',
              borderRadius: 10,
              padding: 4,
              marginBottom: 28,
              gap: 4,
            }}
          >
            {['login', 'signup'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => switchTab(t)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  transition: 'background 200ms, color 200ms, box-shadow 200ms',
                  background: tab === t
                    ? 'var(--gos-cyan)'
                    : 'transparent',
                  color: tab === t
                    ? '#0a1330'
                    : 'var(--gos-muted)',
                  boxShadow: tab === t
                    ? '0 2px 10px rgba(34,211,238,0.3)'
                    : 'none',
                  fontWeight: tab === t ? 600 : 400,
                }}
              >
                {t === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form
            key={formKey}
            onSubmit={handleSubmit(onSubmit)}
            style={{ animation: 'authTabFade 200ms ease forwards' }}
            noValidate
          >
            {/* Name field — signup only */}
            {tab === 'signup' && (
              <div style={fieldWrap}>
                <label style={label} htmlFor="gos-name">Full Name</label>
                <input
                  id="gos-name"
                  className="field-input"
                  type="text"
                  placeholder="Alex Patel"
                  autoComplete="name"
                  data-testid="auth-name-input"
                  {...register('name')}
                />
              </div>
            )}

            {/* Email */}
            <div style={fieldWrap}>
              <label style={label} htmlFor="gos-email">Email</label>
              <input
                id="gos-email"
                className="field-input"
                type="email"
                placeholder="alex@uoguelph.ca"
                autoComplete="email"
                data-testid="auth-email-input"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email',
                  },
                })}
              />
              {errors.email && <span style={errorMsg}>{errors.email.message}</span>}
            </div>

            {/* Password */}
            <div style={{ ...fieldWrap, marginBottom: 24 }}>
              <label style={label} htmlFor="gos-password">Password</label>
              <input
                id="gos-password"
                className="field-input"
                type="password"
                placeholder={tab === 'signup' ? 'Min. 8 characters' : '••••••••••'}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                data-testid="auth-password-input"
                {...register('password', {
                  required: 'Password is required',
                  minLength: tab === 'signup'
                    ? { value: 8, message: 'Password must be at least 8 characters' }
                    : undefined,
                })}
              />
              {errors.password && <span style={errorMsg}>{errors.password.message}</span>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              data-testid="auth-submit-button"
              style={{
                width: '100%',
                padding: 14,
                background: busy
                  ? 'linear-gradient(135deg, rgba(34,211,238,0.6), rgba(14,116,144,0.6))'
                  : 'linear-gradient(135deg, var(--gos-cyan), var(--gos-cyan-deep))',
                color: '#0a1330',
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 12,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontWeight: 600,
                border: 'none',
                borderRadius: 10,
                cursor: busy ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: busy ? 'none' : '0 0 0 1px rgba(34,211,238,0.3), 0 8px 28px rgba(34,211,238,0.3)',
                transition: 'opacity 200ms, box-shadow 200ms',
              }}
            >
              {busy && <Spinner />}
              {busy
                ? 'AUTHENTICATING...'
                : tab === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </button>
          </form>

          {/* Footer */}
          <div
            style={{
              marginTop: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 10,
              color: 'var(--gos-muted)',
              letterSpacing: '0.12em',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--gos-emerald)',
                boxShadow: '0 0 8px var(--gos-emerald)',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            SECURED BY AWS COGNITO
          </div>
        </div>
      </div>
    </div>
  )
}
