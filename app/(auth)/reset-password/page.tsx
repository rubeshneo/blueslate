'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

type Phase = 'checking' | 'ready' | 'invalid' | 'done'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [phase, setPhase] = useState<Phase>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // The OAuth callback exchanges the recovery code and sets a session before
  // sending the user here. Confirm that session exists; if not, the link is
  // invalid or expired.
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setPhase(data.session ? 'ready' : 'invalid')
    })
    return () => { active = false }
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setPhase('done')
    setLoading(false)
    setTimeout(() => { router.push('/'); router.refresh() }, 1800)
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

        {phase === 'checking' && (
          <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)' }}>Verifying your reset link…</p>
        )}

        {phase === 'invalid' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <AlertCircle size={18} style={{ color: 'var(--danger)' }} />
              <h2 className="font-display font-bold uppercase" style={{ fontSize: '15px', letterSpacing: '0.06em', color: 'var(--text-1)' }}>Link invalid or expired</h2>
            </div>
            <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.6, marginBottom: '20px' }}>
              This password reset link is no longer valid. Request a fresh one and try again.
            </p>
            <Link href="/forgot-password" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', textDecoration: 'none' }}>
              Request a new link
            </Link>
          </div>
        )}

        {phase === 'done' && (
          <div style={{ animation: 'fade-up 0.3s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <CheckCircle2 size={18} style={{ color: 'var(--live)' }} />
              <h2 className="font-display font-bold uppercase" style={{ fontSize: '15px', letterSpacing: '0.06em', color: 'var(--text-1)' }}>Password updated</h2>
            </div>
            <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.6 }}>
              Your password has been changed. Taking you to your dashboard…
            </p>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <h2 className="font-display font-bold uppercase" style={{ fontSize: '16px', letterSpacing: '0.06em', color: 'var(--text-1)', marginBottom: '4px' }}>Set a new password</h2>
            <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '24px' }}>Choose a strong password you don&apos;t use elsewhere.</p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="font-display font-bold uppercase" style={{ display: 'block', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)', marginBottom: '7px' }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" className="input-field" style={{ paddingRight: '40px' }} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 0 }}>
                    {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="font-display font-bold uppercase" style={{ display: 'block', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)', marginBottom: '7px' }}>Confirm Password</label>
                <input type={showPass ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Re-enter password" className="input-field" />
              </div>

              {error && (
                <div className="font-body" style={{ fontSize: '11px', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '9px 12px' }}>{error}</div>
              )}

              <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px 16px' }}>
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
