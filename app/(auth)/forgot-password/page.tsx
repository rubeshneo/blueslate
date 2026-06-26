'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    // Send the recovery link through our OAuth callback, which exchanges the
    // code for a (recovery) session and then lands the user on /reset-password.
    const redirectTo = `${window.location.origin}/api/auth/callback?next=/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
  }

  return (
    <div style={{ width: '100%', maxWidth: '400px', animation: 'fade-up 0.4s ease both' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '4px 4px 0 0 var(--border-strong)', padding: '36px 32px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <div className="font-display font-bold flex items-center justify-center"
            style={{ width: '36px', height: '36px', background: 'var(--accent)', color: 'var(--bg)', fontSize: '12px', letterSpacing: '-0.02em', boxShadow: 'var(--shadow-accent)', flexShrink: 0 }}>
            BS
          </div>
          <div>
            <p className="font-display font-bold uppercase leading-none" style={{ fontSize: '13px', letterSpacing: '0.1em', color: 'var(--text-1)' }}>Blueslate</p>
            <p className="font-body leading-none mt-1" style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)', textTransform: 'uppercase' }}>AI Platform</p>
          </div>
        </div>

        {sent ? (
          <div style={{ animation: 'fade-up 0.3s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <CheckCircle2 size={18} style={{ color: 'var(--live)' }} />
              <h2 className="font-display font-bold uppercase" style={{ fontSize: '15px', letterSpacing: '0.06em', color: 'var(--text-1)' }}>Check your email</h2>
            </div>
            <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.6 }}>
              If an account exists for <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{email}</span>, we&apos;ve sent a link to reset your password. It expires in 1 hour.
            </p>
            <p className="font-body" style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '16px' }}>
              Didn&apos;t get it? Check spam, or{' '}
              <button onClick={() => { setSent(false); setError('') }}
                className="font-display font-bold uppercase"
                style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                try again
              </button>.
            </p>
          </div>
        ) : (
          <>
            <h2 className="font-display font-bold uppercase" style={{ fontSize: '16px', letterSpacing: '0.06em', color: 'var(--text-1)', marginBottom: '4px' }}>Reset your password</h2>
            <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '24px' }}>
              Enter your email and we&apos;ll send you a secure link to set a new password.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="font-display font-bold uppercase" style={{ display: 'block', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)', marginBottom: '7px' }}>Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="input-field" />
              </div>

              {error && (
                <div className="font-body" style={{ fontSize: '11px', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '9px 12px' }}>{error}</div>
              )}

              <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px 16px' }}>
                {loading ? (
                  <>
                    <span style={{ display: 'inline-block', width: '4px', height: '10px', background: 'var(--bg)', animation: 'blink-cursor 0.7s 0s steps(1) infinite' }} />
                    <span style={{ display: 'inline-block', width: '4px', height: '10px', background: 'var(--bg)', animation: 'blink-cursor 0.7s 0.2s steps(1) infinite' }} />
                    <span style={{ display: 'inline-block', width: '4px', height: '10px', background: 'var(--bg)', animation: 'blink-cursor 0.7s 0.4s steps(1) infinite' }} />
                    Sending
                  </>
                ) : <><Mail size={14} style={{ marginRight: '6px' }} /> Send reset link</>}
              </button>
            </form>
          </>
        )}

        <Link href="/login" className="font-display font-bold uppercase"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text-3)', textDecoration: 'none', marginTop: '22px' }}>
          <ArrowLeft size={12} /> Back to sign in
        </Link>
      </div>
    </div>
  )
}
