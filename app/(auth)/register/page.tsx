'use client'

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, CheckCircle2, ArrowLeft, Mail, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

// ── OTP input — 6 individual boxes that auto-advance ─────────────────────────
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const digits  = value.padEnd(6, '').split('').slice(0, 6)

  function focus(i: number) {
    inputs.current[Math.max(0, Math.min(5, i))]?.focus()
  }

  function handleChange(i: number, char: string) {
    const d = char.replace(/\D/g, '').slice(-1)
    const next = digits.slice()
    next[i] = d
    const joined = next.join('')
    onChange(joined)
    if (d && i < 5) focus(i + 1)
  }

  function handleKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = digits.slice()
        next[i] = ''
        onChange(next.join(''))
      } else {
        focus(i - 1)
      }
    } else if (e.key === 'ArrowLeft') {
      focus(i - 1)
    } else if (e.key === 'ArrowRight') {
      focus(i + 1)
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted.padEnd(6, '').slice(0, 6))
    focus(Math.min(5, pasted.length))
  }

  useEffect(() => { focus(0) }, [])

  return (
    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] ?? ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          style={{
            width: '44px',
            height: '52px',
            textAlign: 'center',
            fontSize: '20px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            color: 'var(--text-1)',
            background: 'var(--surface-2)',
            border: `1.5px solid ${digits[i] ? 'var(--accent)' : 'var(--border)'}`,
            outline: 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            caretColor: 'var(--accent)',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={e => {
            if (!digits[i]) e.currentTarget.style.borderColor = 'var(--border)'
          }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const [step,        setStep]        = useState<'form' | 'otp'>('form')
  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [otp,         setOtp]         = useState('')
  const [loading,     setLoading]     = useState(false)
  const [otpLoading,  setOtpLoading]  = useState(false)
  const [resending,   setResending]   = useState(false)
  const [error,       setError]       = useState('')
  const [oauthLoading, setOauthLoading] = useState(false)
  const [resent,      setResent]      = useState(false)

  const router = useRouter()
  const supabase = createClient()

  // ── Step 1: Register → Supabase sends OTP email ───────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Supabase returns identities: [] when the email is already registered
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setError('This email is already registered. Sign in instead.')
      setLoading(false)
      return
    }

    // If Supabase auto-confirmed the session (email confirmations off), go straight to onboarding
    if (data.session) {
      sendWelcomeNotification(data.user?.id)
      const plan = new URLSearchParams(window.location.search).get('plan')
      router.push(plan ? `/onboarding?plan=${plan}` : '/onboarding')
      router.refresh()
      return
    }

    // Email confirmation required — show OTP input
    setStep('otp')
    setLoading(false)
  }

  // ── Step 2: Verify the 6-digit OTP ───────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (otp.replace(/\D/g, '').length < 6) {
      setError('Enter the full 6-digit code.')
      return
    }
    setOtpLoading(true)
    setError('')

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp.replace(/\D/g, ''),
      type:  'signup',
    })

    if (verifyError) {
      setError('Invalid or expired code. Try again or resend.')
      setOtpLoading(false)
      return
    }

    sendWelcomeNotification(data.user?.id)
    const plan = new URLSearchParams(window.location.search).get('plan')
    router.push(plan ? `/onboarding?plan=${plan}` : '/onboarding')
    router.refresh()
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────
  async function handleResend() {
    setResending(true)
    setError('')
    setResent(false)
    // Re-trigger signUp — Supabase resends the confirmation email
    await supabase.auth.resend({ type: 'signup', email })
    setResent(true)
    setOtp('')
    setResending(false)
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogle() {
    setOauthLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    })
    if (error) { setError(error.message); setOauthLoading(false) }
  }

  function sendWelcomeNotification(userId?: string) {
    if (!userId) return
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        title: 'Welcome to Blueslate!',
        message: 'Your account is set up. Explore the dashboard to get started.',
        type: 'success',
      }),
    }).catch(() => {})
  }

  // ── Shared card wrapper ───────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    boxShadow: '4px 4px 0 0 var(--border-strong)',
    padding: '36px 32px',
    width: '100%',
    maxWidth: '400px',
    animation: 'fade-up 0.4s ease both',
  }

  const Logo = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
      <div
        className="font-display font-bold flex items-center justify-center"
        style={{ width: '36px', height: '36px', background: 'var(--accent)', color: 'var(--bg)', fontSize: '12px', letterSpacing: '-0.02em', boxShadow: 'var(--shadow-accent)', flexShrink: 0 }}
      >
        BS
      </div>
      <div>
        <p className="font-display font-bold uppercase leading-none" style={{ fontSize: '13px', letterSpacing: '0.1em', color: 'var(--text-1)' }}>Blueslate</p>
        <p className="font-body leading-none mt-1" style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)', textTransform: 'uppercase' }}>AI Platform</p>
      </div>
    </div>
  )

  const ErrorBox = ({ msg }: { msg: string }) => (
    <div className="font-body" style={{ fontSize: '11px', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '9px 12px' }}>
      {msg}
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // OTP STEP
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 'otp') {
    return (
      <div style={{ width: '100%', maxWidth: '400px', animation: 'fade-up 0.35s ease both' }}>
        <div style={cardStyle}>
          <Logo />

          {/* Back button */}
          <button
            onClick={() => { setStep('form'); setOtp(''); setError('') }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, marginBottom: '20px', fontSize: '10px', letterSpacing: '0.14em', fontFamily: 'var(--font-display)', fontWeight: 700, textTransform: 'uppercase' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-1)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'}
          >
            <ArrowLeft size={12} /> Back
          </button>

          {/* Icon + heading */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ width: '52px', height: '52px', background: 'var(--accent-tint)', border: '1px solid var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Mail size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <h2 className="font-display font-bold uppercase" style={{ fontSize: '15px', letterSpacing: '0.06em', color: 'var(--text-1)', marginBottom: '6px' }}>
              Check your email
            </h2>
            <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.6 }}>
              We sent a 6-digit code to<br />
              <strong style={{ color: 'var(--text-1)' }}>{email}</strong>
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <OtpInput value={otp} onChange={setOtp} />

            {resent && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', fontSize: '11px', color: 'var(--live)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                <CheckCircle2 size={13} /> Code resent — check your inbox.
              </div>
            )}

            {error && <ErrorBox msg={error} />}

            <button
              type="submit"
              disabled={otpLoading || otp.replace(/\D/g, '').length < 6}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', opacity: otp.replace(/\D/g, '').length < 6 ? 0.5 : 1 }}
            >
              {otpLoading
                ? <><Loader2 size={14} className="animate-spin" style={{ marginRight: '6px' }} /> Verifying…</>
                : 'Verify & Create Account'}
            </button>
          </form>

          {/* Resend */}
          <p className="font-body" style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-3)', marginTop: '18px' }}>
            Didn&apos;t receive it?{' '}
            <button
              onClick={handleResend}
              disabled={resending}
              style={{ background: 'none', border: 'none', cursor: resending ? 'default' : 'pointer', color: 'var(--accent)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: resending ? 0.5 : 1 }}
            >
              {resending ? 'Sending…' : 'Resend code'}
            </button>
          </p>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // REGISTRATION FORM STEP
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ width: '100%', maxWidth: '400px', animation: 'fade-up 0.4s ease both' }}>
      <div style={cardStyle}>
        <Logo />

        <h2 className="font-display font-bold uppercase" style={{ fontSize: '16px', letterSpacing: '0.06em', color: 'var(--text-1)', marginBottom: '4px' }}>
          Create Account
        </h2>
        <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '24px' }}>
          Free to get started — no card required
        </p>

        {/* Google SSO */}
        <button
          onClick={handleGoogle}
          disabled={oauthLoading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '11px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)', cursor: oauthLoading ? 'not-allowed' : 'pointer', opacity: oauthLoading ? 0.6 : 1, fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', transition: 'border-color 0.15s', marginBottom: '20px' }}
          onMouseEnter={e => !oauthLoading && ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
        >
          {oauthLoading ? (
            <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Sign up with Google
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span className="font-display uppercase" style={{ fontSize: '9px', letterSpacing: '0.18em', color: 'var(--text-3)' }}>or email</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        {/* Form */}
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="font-display font-bold uppercase" style={{ display: 'block', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)', marginBottom: '7px' }}>
              Full Name
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Rubesh Kumar" className="input-field" />
          </div>

          <div>
            <label className="font-display font-bold uppercase" style={{ display: 'block', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)', marginBottom: '7px' }}>
              Email Address
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" className="input-field" />
          </div>

          <div>
            <label className="font-display font-bold uppercase" style={{ display: 'block', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)', marginBottom: '7px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min 6 characters"
                className="input-field"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 0, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'}
              >
                {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          {error && <ErrorBox msg={error} />}

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px 16px' }}>
            {loading
              ? <><Loader2 size={14} className="animate-spin" style={{ marginRight: '6px' }} /> Sending code…</>
              : 'Continue →'}
          </button>
        </form>

        <p className="font-body" style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-3)', marginTop: '20px' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-display font-bold uppercase" style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'var(--accent)', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
