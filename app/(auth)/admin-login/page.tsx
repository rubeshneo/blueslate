'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 1. Authenticate
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    // 2. Verify admin privileges server-side (the admin API 403s non-admins)
    const res = await fetch('/api/admin/stats')
    if (res.status === 403) {
      await supabase.auth.signOut()
      setError('This account does not have admin access.')
      setLoading(false)
      return
    }
    if (!res.ok) {
      setError('Could not verify admin access. Please try again.')
      setLoading(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <div style={{ width: '100%', maxWidth: '400px', animation: 'fade-up 0.4s ease both' }}>
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderTop: '3px solid var(--accent)',
          boxShadow: '4px 4px 0 0 var(--border-strong)',
          padding: '36px 32px',
        }}
      >
        {/* Logo + admin badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <div
            className="font-display font-bold flex items-center justify-center"
            style={{
              width: '36px', height: '36px',
              background: 'var(--accent)', color: 'var(--bg)',
              fontSize: '12px', letterSpacing: '-0.02em',
              boxShadow: 'var(--shadow-accent)', flexShrink: 0,
            }}
          >
            BS
          </div>
          <div>
            <p className="font-display font-bold uppercase leading-none" style={{ fontSize: '13px', letterSpacing: '0.1em', color: 'var(--text-1)' }}>
              Blueslate
            </p>
            <p className="font-body leading-none mt-1" style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
              Control Panel
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Shield size={15} style={{ color: 'var(--accent)' }} />
          <h2 className="font-display font-bold uppercase" style={{ fontSize: '16px', letterSpacing: '0.06em', color: 'var(--text-1)' }}>
            Admin Access
          </h2>
        </div>
        <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '24px' }}>
          Restricted area — authorized operators only.
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="font-display font-bold uppercase" style={{ display: 'block', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)', marginBottom: '7px' }}>
              Admin Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@neoaistriq.com"
              className="input-field"
            />
          </div>

          <div>
            <label className="font-display font-bold uppercase" style={{ display: 'block', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)', marginBottom: '7px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="input-field"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: '10px', top: '50%',
                  transform: 'translateY(-50%)', background: 'transparent',
                  border: 'none', cursor: 'pointer', color: 'var(--text-3)',
                  display: 'flex', padding: 0, transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'}
              >
                {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="font-body" style={{ fontSize: '11px', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '9px 12px' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px 16px' }}>
            {loading ? (
              <>
                <span style={{ display: 'inline-block', width: '4px', height: '10px', background: 'var(--bg)', animation: 'blink-cursor 0.7s 0s steps(1) infinite' }} />
                <span style={{ display: 'inline-block', width: '4px', height: '10px', background: 'var(--bg)', animation: 'blink-cursor 0.7s 0.2s steps(1) infinite' }} />
                <span style={{ display: 'inline-block', width: '4px', height: '10px', background: 'var(--bg)', animation: 'blink-cursor 0.7s 0.4s steps(1) infinite' }} />
                Verifying
              </>
            ) : 'Sign In to Admin'}
          </button>
        </form>

        <p className="font-body" style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-3)', marginTop: '20px' }}>
          Not an operator?{' '}
          <a
            href="/login"
            className="font-display font-bold uppercase"
            style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'var(--accent)', textDecoration: 'none' }}
          >
            Franchise Login
          </a>
        </p>
      </div>
    </div>
  )
}
