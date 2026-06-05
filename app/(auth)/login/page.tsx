'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  const handleGoogle = async () => {
    setOauthLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setOauthLoading(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '400px', animation: 'fade-up 0.4s ease both' }}>
      {/* Card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '4px 4px 0 0 var(--border-strong)',
          padding: '36px 32px',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <div
            className="font-display font-bold flex items-center justify-center"
            style={{
              width: '36px',
              height: '36px',
              background: 'var(--accent)',
              color: 'var(--bg)',
              fontSize: '12px',
              letterSpacing: '-0.02em',
              boxShadow: 'var(--shadow-accent)',
              flexShrink: 0,
            }}
          >
            BS
          </div>
          <div>
            <p
              className="font-display font-bold uppercase leading-none"
              style={{ fontSize: '13px', letterSpacing: '0.1em', color: 'var(--text-1)' }}
            >
              Blueslate
            </p>
            <p
              className="font-body leading-none mt-1"
              style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)', textTransform: 'uppercase' }}
            >
              AI Platform
            </p>
          </div>
        </div>

        <h2
          className="font-display font-bold uppercase"
          style={{ fontSize: '16px', letterSpacing: '0.06em', color: 'var(--text-1)', marginBottom: '4px' }}
        >
          Welcome back
        </h2>
        <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '24px' }}>
          Sign in to your account to continue
        </p>

        {/* Google SSO */}
        <button
          onClick={handleGoogle}
          disabled={oauthLoading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '11px 16px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-1)',
            cursor: oauthLoading ? 'not-allowed' : 'pointer',
            opacity: oauthLoading ? 0.6 : 1,
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            transition: 'border-color 0.15s',
            marginBottom: '20px',
          }}
          onMouseEnter={e => !oauthLoading && ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
        >
          {oauthLoading ? (
            <>
              <span style={{ width: '5px', height: '5px', background: 'var(--accent)', animation: 'blink-cursor 0.6s 0s steps(1) infinite' }} />
              <span style={{ width: '5px', height: '5px', background: 'var(--accent)', animation: 'blink-cursor 0.6s 0.2s steps(1) infinite' }} />
              <span style={{ width: '5px', height: '5px', background: 'var(--accent)', animation: 'blink-cursor 0.6s 0.4s steps(1) infinite' }} />
            </>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span className="font-display uppercase" style={{ fontSize: '9px', letterSpacing: '0.18em', color: 'var(--text-3)' }}>
            or email
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              className="font-display font-bold uppercase"
              style={{ display: 'block', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)', marginBottom: '7px' }}
            >
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="input-field"
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
              <label
                className="font-display font-bold uppercase"
                style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)' }}
              >
                Password
              </label>
              <a
                href="#"
                className="font-display uppercase"
                style={{ fontSize: '8px', letterSpacing: '0.14em', color: 'var(--accent)', textDecoration: 'none', transition: 'opacity 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              >
                Forgot?
              </a>
            </div>
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
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-3)',
                  display: 'flex',
                  padding: 0,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'}
              >
                {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="font-body"
              style={{
                fontSize: '11px',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                padding: '9px 12px',
              }}
            >
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px 16px' }}>
            {loading ? (
              <>
                <span style={{ display: 'inline-block', width: '4px', height: '10px', background: 'var(--bg)', animation: 'blink-cursor 0.7s 0s steps(1) infinite' }} />
                <span style={{ display: 'inline-block', width: '4px', height: '10px', background: 'var(--bg)', animation: 'blink-cursor 0.7s 0.2s steps(1) infinite' }} />
                <span style={{ display: 'inline-block', width: '4px', height: '10px', background: 'var(--bg)', animation: 'blink-cursor 0.7s 0.4s steps(1) infinite' }} />
                Signing in
              </>
            ) : 'Sign In'}
          </button>
        </form>

        <p className="font-body" style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-3)', marginTop: '20px' }}>
          No account?{' '}
          <Link
            href="/register"
            className="font-display font-bold uppercase"
            style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'var(--accent)', textDecoration: 'none', transition: 'opacity 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.opacity = '1'}
          >
            Create One
          </Link>
        </p>
      </div>
    </div>
  )
}
