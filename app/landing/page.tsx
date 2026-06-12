'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  Check, ArrowRight, Phone, Bot, Zap, Globe, Shield,
  Sun, Moon, Sparkles, Users, TrendingUp, Clock, Star,
  ChevronRight, Play, Mic, PhoneCall, Calendar, BarChart3,
  MessageSquare, Database, Layers, Menu, X, Send, Loader2,
  AlertCircle, ArrowUpRight
} from 'lucide-react'

/* ─── Utility Hooks ─────────────────────────────────────────────────────── */

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

function useCountUp(target: number, duration = 1800, inView = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = Math.ceil(target / (duration / 16))
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(start)
    }, 16)
    return () => clearInterval(timer)
  }, [inView, target, duration])
  return count
}

/* ─── Sub-components ────────────────────────────────────────────────────── */

function TiltCard({ children, className = '', highlight = false }: { children: React.ReactNode; className?: string; highlight?: boolean }) {
  const [style, setStyle] = useState<React.CSSProperties>({})
  const move = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - left) / width - 0.5
    const y = (e.clientY - top) / height - 0.5
    setStyle({ transform: `perspective(1000px) rotateY(${x * 16}deg) rotateX(${y * -16}deg) translateZ(8px) scale(1.02)`, transition: 'transform 0.1s ease-out', zIndex: 10 })
  }
  const leave = () => setStyle({ transform: 'perspective(1000px) rotateY(0) rotateX(0) translateZ(0) scale(1)', transition: 'transform 0.5s ease-out', zIndex: 1 })
  return (
    <div onMouseMove={move} onMouseLeave={leave} style={{ ...style, transformStyle: 'preserve-3d' }}
      className={`card group relative duration-300 transition-colors ${highlight ? 'border-[var(--accent)] shadow-[0_0_40px_rgba(232,93,63,0.25)]' : 'hover:border-[var(--accent)]/50 hover:shadow-[var(--shadow-lg)]'} ${className}`}>
      <div style={{ transform: 'translateZ(30px)' }}>{children}</div>
    </div>
  )
}

function StatPill({ value, label, icon: Icon, color }: { value: string; label: string; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-full shadow-[var(--shadow-sm)] hover:border-[var(--accent)]/40 hover:scale-105 transition-all cursor-default">
      <Icon size={14} style={{ color }} />
      <span className="font-display font-bold text-[var(--text-1)] text-sm">{value}</span>
      <span className="text-[var(--text-3)] text-xs font-display">{label}</span>
    </div>
  )
}

type ChatMsg = { role: 'user' | 'assistant'; content: string }

type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking'

const VOICE_CHIPS = [
  'What does Blueslate do?',
  'How much does it cost?',
  'How fast can I go live?',
  'How does lead capture work?',
]

const INTEREST_WORDS = /interested|sign.?up|get started|join|onboard|pilot|want to try|pricing|how do i start|contact me|reach out|i want|let's do|let me know more/i

function VoiceAgent() {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [userText, setUserText] = useState('')
  const [agentText, setAgentText] = useState('')
  const [history, setHistory] = useState<ChatMsg[]>([])
  const [error, setError] = useState('')
  const [browserOk, setBrowserOk] = useState(true)
  const [fallbackText, setFallbackText] = useState('')
  const [hasSpoken, setHasSpoken] = useState(false)

  // Lead capture
  const [showCapture,   setShowCapture]   = useState(false)
  const [captureName,   setCaptureName]   = useState('')
  const [captureEmail,  setCaptureEmail]  = useState('')
  const [capturePhone,  setCapturePhone]  = useState('')
  const [captureLoading, setCaptureLoading] = useState(false)
  const [captureDone,   setCaptureDone]   = useState(false)
  const [captureError,  setCaptureError]  = useState('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null)

  useEffect(() => {
    const ok = !!(
      typeof window !== 'undefined' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in (window as any))
    )
    setBrowserOk(ok)
    return () => { window.speechSynthesis?.cancel() }
  }, [])

  function startListening() {
    if (status === 'speaking') { stopSpeaking(); return }
    if (status !== 'idle') return
    setError('')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) { setError('Voice not supported in this browser. Please type below.'); return }
    const r = new SR()
    r.lang = 'en-US'
    r.interimResults = false
    r.maxAlternatives = 1
    r.continuous = false

    r.onstart = () => setStatus('listening')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const text = e.results[0][0].transcript.trim()
      if (text) { setUserText(text); sendMessage(text) }
    }
    r.onerror = () => { setError('Could not hear you. Try again or type below.'); setStatus('idle') }
    r.onend = () => { recogRef.current = null }
    recogRef.current = r
    r.start()
  }

  async function sendMessage(text: string) {
    setStatus('processing')
    setAgentText('')
    setError('')
    setHasSpoken(true)

    try {
      const res = await fetch('/api/voice-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: history.slice(-6) }),
      })
      if (!res.ok || !res.body) throw new Error('Demo unavailable')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setAgentText(acc)
      }
      if (!acc.trim()) throw new Error('No response. Try again.')
      const updatedHistory: ChatMsg[] = [...history, { role: 'user', content: text }, { role: 'assistant', content: acc }]
      setHistory(updatedHistory)
      // Show lead capture if the conversation shows interest
      if (!showCapture && (INTEREST_WORDS.test(text) || INTEREST_WORDS.test(acc))) {
        setShowCapture(true)
      }
      speakOut(acc)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setStatus('idle')
    }
  }

  async function submitLead(e: React.FormEvent) {
    e.preventDefault()
    if (!captureEmail && !capturePhone) { setCaptureError('Enter an email or phone number.'); return }
    setCaptureLoading(true)
    setCaptureError('')
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent:   'access_request',
          name:     captureName.trim() || undefined,
          email:    captureEmail.trim() || undefined,
          phone:    capturePhone.trim() || undefined,
          interest: 'Landing page voice demo — expressed interest',
        }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not save your details.')
      setCaptureDone(true)
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setCaptureLoading(false)
    }
  }

  function speakOut(text: string) {
    const synth = window.speechSynthesis
    synth.cancel()
    const clean = text.replace(/[*_`#]/g, '')
    const utt = new SpeechSynthesisUtterance(clean)
    utt.rate = 1.05
    utt.pitch = 1.0
    utt.volume = 1
    const loadAndSpeak = () => {
      const voices = synth.getVoices()
      const pick = voices.find(v => v.lang === 'en-US' && /google|samantha|karen|moira/i.test(v.name))
        ?? voices.find(v => v.lang.startsWith('en'))
      if (pick) utt.voice = pick
      utt.onstart = () => setStatus('speaking')
      utt.onend = () => setStatus('idle')
      utt.onerror = () => setStatus('idle')
      synth.speak(utt)
    }
    if (synth.getVoices().length) loadAndSpeak()
    else { synth.onvoiceschanged = loadAndSpeak }
  }

  function stopSpeaking() { window.speechSynthesis?.cancel(); setStatus('idle') }

  function sendFallback(e: React.FormEvent) {
    e.preventDefault()
    const t = fallbackText.trim()
    if (!t || status !== 'idle') return
    setUserText(t)
    setFallbackText('')
    sendMessage(t)
  }

  const statusLabel: Record<VoiceStatus, string> = {
    idle: hasSpoken ? 'Tap to ask another question' : 'Tap the mic and ask Sage anything',
    listening: 'Listening… speak now',
    processing: 'Sage is thinking…',
    speaking: 'Tap to stop Sage',
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--shadow-lg)] flex flex-col select-none">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--surface-2)] border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--live)] animate-pulse" />
          <span className="font-display font-bold text-[10px] uppercase tracking-widest text-[var(--text-2)]">Live Voice Demo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Mic size={12} className="text-[var(--accent)]" />
          <span className="font-display text-[9px] uppercase tracking-widest text-[var(--accent)] font-bold">Sage AI</span>
        </div>
      </div>

      {/* ── Conversation ── */}
      <div className="px-5 pt-5 pb-2 min-h-[96px] flex flex-col gap-3">
        {userText && (
          <div className="flex justify-end" style={{ animation: 'fade-up 0.25s ease-out both' }}>
            <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-tr-sm text-xs leading-relaxed bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)]">
              {userText}
            </div>
          </div>
        )}
        {agentText && (
          <div className="flex gap-2 items-start" style={{ animation: 'fade-up 0.25s ease-out both' }}>
            <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot size={10} className="text-white" />
            </div>
            <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-tl-sm text-xs leading-relaxed bg-[var(--accent-tint)] border border-[var(--accent)]/20 text-[var(--text-1)]">
              {agentText}
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--danger)]">
            <AlertCircle size={12} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── Mic Button ── */}
      <div className="flex flex-col items-center py-6 gap-4">
        <button
          onClick={startListening}
          disabled={status === 'processing'}
          aria-label={statusLabel[status]}
          className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 disabled:opacity-50 focus:outline-none"
          style={{
            background: status === 'idle'
              ? 'var(--accent)'
              : status === 'listening'
                ? '#FF6B4A'
                : status === 'speaking'
                  ? 'var(--accent)'
                  : 'var(--surface-2)',
            boxShadow: status === 'listening'
              ? '0 0 0 0 rgba(232,93,63,0.5)'
              : status === 'speaking'
                ? '0 0 28px rgba(232,93,63,0.45)'
                : '0 0 20px rgba(232,93,63,0.25)',
            animation: status === 'listening' ? 'mic-ring 1.2s ease-out infinite' : undefined,
          }}
        >
          {/* Outer ripple rings — listening state */}
          {status === 'listening' && (
            <>
              <span className="absolute inset-0 rounded-full border-2 border-[var(--accent)] opacity-60" style={{ animation: 'ripple 1.2s ease-out infinite' }} />
              <span className="absolute inset-0 rounded-full border-2 border-[var(--accent)] opacity-30" style={{ animation: 'ripple 1.2s ease-out 0.4s infinite' }} />
            </>
          )}
          {/* Speaking bars */}
          {status === 'speaking' && (
            <span className="absolute inset-0 flex items-center justify-center gap-0.5 pointer-events-none">
              {[0, 0.15, 0.3, 0.15, 0].map((d, i) => (
                <span key={i} className="w-1 rounded-full bg-white/70"
                  style={{ height: `${20 + i * 6}px`, animation: `voice-bar 0.5s ease-in-out infinite alternate`, animationDelay: `${d}s` }} />
              ))}
            </span>
          )}
          {/* Spinner — processing */}
          {status === 'processing' && (
            <Loader2 size={28} className="text-[var(--accent)] animate-spin" />
          )}
          {/* Mic icon — idle / listening */}
          {(status === 'idle' || status === 'listening') && (
            <Mic size={28} className="text-white relative z-10" />
          )}
        </button>

        {/* Status label */}
        <p className="text-[11px] font-display font-bold uppercase tracking-widest text-[var(--text-3)] text-center transition-all duration-300">
          {statusLabel[status]}
        </p>

        {/* Suggestion chips — before first interaction */}
        {!hasSpoken && status === 'idle' && (
          <div className="flex flex-wrap justify-center gap-2 px-4">
            {VOICE_CHIPS.map(s => (
              <button key={s} onClick={() => { setUserText(s); sendMessage(s) }}
                className="px-2.5 py-1.5 text-[10px] font-display font-medium rounded-full border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-tint)] transition-all">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Text fallback ── */}
      <form onSubmit={sendFallback} className="flex items-center gap-2 px-3 pb-3 border-t border-[var(--border)] pt-3">
        <input
          value={fallbackText}
          onChange={e => setFallbackText(e.target.value)}
          disabled={status !== 'idle'}
          placeholder={browserOk ? 'Or type your question…' : 'Type your question (mic not supported in this browser)'}
          className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-full px-4 py-2 text-xs text-[var(--text-1)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-3)]"
        />
        <button type="submit" disabled={status !== 'idle' || !fallbackText.trim()}
          className="w-9 h-9 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0 hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-all">
          <Send size={14} />
        </button>
      </form>

      {/* ── Lead capture — appears after interest is detected ── */}
      {showCapture && (
        <div className="border-t border-[var(--accent)]/20 bg-[var(--accent-tint)] px-4 py-4"
          style={{ animation: 'fade-up 0.3s ease-out both' }}>
          {captureDone ? (
            <div className="flex items-center gap-2 text-xs text-[var(--live)] font-display font-bold py-1">
              <Check size={14} className="shrink-0" />
              Got it! Our team will reach out to you soon.
            </div>
          ) : (
            <>
              <p className="text-[10px] font-display font-bold uppercase tracking-widest text-[var(--accent)] mb-3">
                Want us to reach out?
              </p>
              <form onSubmit={submitLead} className="flex flex-col gap-2">
                <input
                  value={captureName}
                  onChange={e => setCaptureName(e.target.value)}
                  placeholder="Your name"
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-1)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-3)]"
                />
                <div className="flex gap-2">
                  <input
                    value={captureEmail}
                    onChange={e => setCaptureEmail(e.target.value)}
                    type="email"
                    placeholder="Email address"
                    className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-1)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-3)]"
                  />
                  <input
                    value={capturePhone}
                    onChange={e => setCapturePhone(e.target.value)}
                    type="tel"
                    placeholder="Phone (optional)"
                    className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-1)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-3)]"
                  />
                </div>
                {captureError && (
                  <p className="text-[10px] text-[var(--danger)] flex items-center gap-1">
                    <AlertCircle size={10} /> {captureError}
                  </p>
                )}
                <button type="submit" disabled={captureLoading}
                  className="w-full py-2 bg-[var(--accent)] text-[var(--bg)] text-xs font-display font-bold uppercase tracking-widest rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {captureLoading
                    ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
                    : <><ArrowRight size={12} /> Save my details</>}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Enter your email'); return }
    setState('loading')
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: 'newsletter', email: email.trim() }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Could not subscribe.')
      setState('done')
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setState('idle')
    }
  }

  if (state === 'done') {
    return (
      <p className="flex items-center gap-2 text-xs text-[var(--live)] font-display font-bold">
        <Check size={14} /> Subscribed — watch your inbox.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@franchise.com"
        className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-1)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-3)]" />
      <button type="submit" disabled={state === 'loading'}
        className="w-9 h-9 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center shrink-0 hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-all">
        {state === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpRight size={15} />}
      </button>
      {error && <span className="text-[10px] text-[var(--danger)] absolute mt-10">{error}</span>}
    </form>
  )
}

function DashboardMockup() {
  const { ref, inView } = useInView()
  const calls = useCountUp(47, 1400, inView)
  const leads = useCountUp(23, 1600, inView)
  const booked = useCountUp(11, 1800, inView)

  return (
    <div ref={ref} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--shadow-lg)]">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[var(--surface-2)] border-b border-[var(--border)]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#FFBB2C]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-4 text-[10px] font-display font-bold uppercase tracking-widest text-[var(--text-3)]">blueslate.ai — Dashboard</span>
      </div>
      {/* Stat row */}
      <div className="grid grid-cols-3 divide-x divide-[var(--border)] border-b border-[var(--border)]">
        {[
          { label: 'Calls Handled', value: calls, unit: '', color: 'var(--accent)', icon: PhoneCall },
          { label: 'Leads Parsed', value: leads, unit: '', color: 'var(--warn)', icon: Users },
          { label: 'Trials Booked', value: booked, unit: '', color: 'var(--live)', icon: Calendar },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="p-4 text-center">
            <Icon size={14} className="mx-auto mb-1.5" style={{ color }} />
            <p className="font-display font-bold text-2xl text-[var(--text-1)]">{value}</p>
            <p className="text-[9px] font-display uppercase tracking-widest text-[var(--text-3)] mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      {/* Mini lead list */}
      <div className="p-3 space-y-1.5">
        <p className="font-display font-bold uppercase text-[9px] tracking-widest text-[var(--text-3)] px-1 mb-2">Recent Leads</p>
        {[
          { name: 'Marcus T.', status: 'Booked', time: '2m ago', color: 'var(--live)' },
          { name: 'Sarah K.', status: 'Follow-up', time: '18m ago', color: 'var(--warn)' },
          { name: 'Jordan M.', status: 'Booked', time: '1h ago', color: 'var(--live)' },
          { name: 'Alex P.', status: 'Info Only', time: '2h ago', color: 'var(--text-3)' },
        ].map((lead, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--accent-tint)] transition-colors cursor-default"
            style={{ animation: `fade-up 0.4s ease-out both`, animationDelay: `${i * 0.1}s` }}>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-[var(--border)] flex items-center justify-center">
                <span className="text-[9px] font-display font-bold text-[var(--text-2)]">{lead.name[0]}</span>
              </div>
              <span className="text-[11px] font-display font-bold text-[var(--text-1)]">{lead.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                style={{ color: lead.color, borderColor: `${lead.color}30`, background: `${lead.color}10` }}>
                {lead.status}
              </span>
              <span className="text-[9px] text-[var(--text-3)] font-display">{lead.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  /* ── Hero stats ── */
  const heroRef = useRef<HTMLDivElement>(null)
  const [heroInView, setHeroInView] = useState(false)
  useEffect(() => {
    const el = heroRef.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setHeroInView(true); obs.disconnect() } }, { threshold: 0.3 })
    obs.observe(el); return () => obs.disconnect()
  }, [])
  const heroLocations = useCountUp(200, 1600, heroInView)
  const heroMinutes = useCountUp(50000, 2000, heroInView)
  const heroRate = useCountUp(94, 1400, heroInView)

  /* ── Section InView hooks ── */
  const featuresView = useInView(0.1)
  const howView = useInView(0.1)
  const testimonialsView = useInView(0.1)
  const ctaView = useInView(0.2)

  const testimonials = [
    {
      quote: "We went from missing 30% of our inbound calls to zero. In the first week alone Sage booked 18 trial sessions while I was coaching on the floor.",
      name: 'Derek Johnson',
      role: 'Owner, XP League Frisco',
      metric: '18 bookings',
      metricLabel: 'Week 1',
      avatar: 'D',
      stars: 5,
    },
    {
      quote: "Setup took 20 minutes — I just pasted my website URL. The AI knew our pricing, schedules, and FAQ better than some of my staff.",
      name: 'Priya Nair',
      role: 'Franchise Operator, 3 locations',
      metric: '3 locations',
      metricLabel: 'Deployed',
      avatar: 'P',
      stars: 5,
    },
    {
      quote: "The lead dashboard is a game-changer. Every call is transcribed and the parent's info is automatically captured. My CRM stays clean.",
      name: 'Marcus Webb',
      role: 'GM, Urban Air Adventure Park',
      metric: '94%',
      metricLabel: 'Lead Capture',
      avatar: 'M',
      stars: 5,
    },
  ]

  const steps = [
    { num: '01', icon: Globe, title: 'Connect Your Franchise', desc: 'Paste your website URL. Blueslate scrapes your pricing, hours, programs, and FAQs in under 60 seconds — no manual data entry.', color: 'var(--accent)' },
    { num: '02', icon: Bot, title: 'Train Your AI Agent', desc: "Give your agent a name, voice, and personality. Configure the greeting, handle edge cases, and preview responses in the AI Playground before going live.", color: 'var(--accent-2)' },
    { num: '03', icon: PhoneCall, title: 'Go Live. Watch Leads Fill In.', desc: 'Route your business phone to your Blueslate number. Every call is handled, every lead captured, every booking confirmed — automatically.', color: 'var(--live)' },
  ]

  const features = [
    { title: 'Zero Missed Calls', desc: 'AI answers every inbound call during peak hours, after hours, and weekends — so high-intent prospects are always greeted.', icon: Phone, delay: 0 },
    { title: 'Instant Knowledge', desc: 'Automatically ingests your franchise website for real-time pricing, scheduling, and FAQ data. Updates with one click.', icon: Globe, delay: 0.08 },
    { title: 'Smart Lead Parsing', desc: 'Extracts caller name, phone number, child age, and interests — then logs them to your secure lead dashboard in under 60 seconds.', icon: Zap, delay: 0.16 },
    { title: 'Natural Voice AI', desc: 'Powered by Vapi and Groq — sounds human, handles interruptions, answers follow-ups, and builds trust with every caller.', icon: Mic, delay: 0.24 },
    { title: 'Multi-Tenant Security', desc: 'Enterprise-grade row-level security ensures every franchise location\'s data is completely isolated and protected.', icon: Shield, delay: 0.32 },
    { title: 'Live Analytics', desc: 'Monitor calls in real-time, read full transcripts, track booking conversion rates, and export leads to your CRM.', icon: BarChart3, delay: 0.4 },
    { title: 'Multi-Location Ready', desc: 'Onboard unlimited franchise locations under one account. Each gets its own AI agent, phone number, and dashboard.', icon: Layers, delay: 0.48 },
    { title: 'CRM Webhooks', desc: 'Automatically push leads to HubSpot, Salesforce, or any webhook endpoint the moment a call ends.', icon: Database, delay: 0.56 },
  ]

  const integrations = [
    { name: 'Twilio', desc: 'Phone infrastructure', color: '#F22F46' },
    { name: 'Vapi', desc: 'Voice AI', color: '#6366F1' },
    { name: 'Groq', desc: 'Llama inference', color: '#F55036' },
    { name: 'Supabase', desc: 'Database & auth', color: '#3ECF8E' },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] overflow-x-hidden transition-colors duration-500">

      {/* ── Global ambient blobs ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-[var(--accent)] opacity-[0.025] blur-[120px] rounded-full animate-[spin_30s_linear_infinite]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-[var(--accent-2)] opacity-[0.025] blur-[140px] rounded-full animate-[spin_35s_linear_infinite_reverse]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-[#1E40AF] opacity-[0.015] blur-[160px] rounded-full" />
      </div>

      {/* ── Navbar ── */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'bg-[var(--surface)]/90 backdrop-blur-xl border-b border-[var(--border)] shadow-[var(--shadow-sm)]' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/landing" className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-[var(--accent)] text-white flex items-center justify-center font-display font-bold text-xs shadow-[var(--shadow-accent)] group-hover:rotate-180 group-hover:scale-110 transition-all duration-700 rounded-sm">
              BS
            </div>
            <span className="font-display font-bold uppercase tracking-widest text-[13px] text-[var(--text-1)]">Blueslate<span className="text-[var(--accent)]"> AI</span></span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8 font-display uppercase text-[10px] tracking-widest font-bold text-[var(--text-2)]">
            {[['#features', 'Features'], ['#how-it-works', 'How it Works'], ['#demo', 'Live Demo']].map(([href, label]) => (
              <a key={href} href={href} className="hover:text-[var(--accent)] hover:-translate-y-0.5 transition-all inline-block">{label}</a>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--accent)] hover:scale-110 hover:rotate-12 transition-all duration-300 shadow-sm"
              aria-label="Toggle theme">
              {mounted && (theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />)}
            </button>
            <Link href="/login" className="hidden sm:block font-display font-bold uppercase text-[10px] tracking-widest text-[var(--text-2)] hover:text-[var(--accent)] transition-all">
              Sign In
            </Link>
            <Link href="/register" className="btn-primary py-2 px-4 text-[10px] shadow-[0_0_20px_rgba(232,93,63,0.25)] hover:shadow-[0_0_30px_rgba(232,93,63,0.45)] transition-shadow group overflow-hidden relative">
              <span className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-[scan-right_1.5s_ease-in-out_infinite]" />
              Get Started Free
            </Link>
            <button className="md:hidden p-2 text-[var(--text-2)]" onClick={() => setMobileMenuOpen(o => !o)}>
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 space-y-3" style={{ animation: 'slide-down 0.2s ease-out' }}>
            {[['#features', 'Features'], ['#how-it-works', 'How it Works'], ['#demo', 'Live Demo']].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="block font-display uppercase text-[11px] tracking-widest text-[var(--text-2)] hover:text-[var(--accent)] py-1.5">{label}</a>
            ))}
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-16 md:pt-48 md:pb-24 px-6 flex flex-col items-center text-center z-10">
        {/* Grid texture */}
        <div className="absolute inset-0 bg-micro-grid opacity-[0.06] pointer-events-none" />

        {/* Orbit rings */}
        {[{ w: '180%', h: '180%', l: '-40%', t: '-40%', rx: '68deg', d: '50s', rev: false },
          { w: '140%', h: '140%', l: '-20%', t: '-20%', rx: '72deg', d: '40s', rev: true }].map((r, i) => (
          <div key={i} className="absolute pointer-events-none border border-dashed border-[var(--accent)]/10 rounded-full"
            style={{ width: r.w, height: r.h, left: r.l, top: r.t, transform: `rotateX(${r.rx}) rotateZ(0deg)`, animation: `spin-3d${r.rev ? '-reverse' : ''} ${r.d} linear infinite` }} />
        ))}

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)] text-[10px] font-display font-bold uppercase tracking-widest mb-8 rounded-full shadow-lg shadow-[var(--accent)]/10 hover:scale-105 hover:bg-[var(--accent)] hover:text-white transition-all cursor-default group"
          style={{ animation: 'fade-up 0.5s ease-out both' }}>
          <Sparkles size={11} className="group-hover:animate-spin" />
          Now available — AI Reception for Every Franchise
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl lg:text-[82px] font-display font-bold tracking-tight text-[var(--text-1)] max-w-5xl mb-6 leading-[1.05]"
          style={{ animation: 'fade-up 0.7s ease-out 0.1s both' }}>
          Your franchise never<br />misses a call{' '}
          <span className="relative inline-block">
            <span className="text-[var(--accent)] hover:drop-shadow-[0_0_20px_rgba(232,93,63,0.6)] transition-all duration-300">again.</span>
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[var(--accent)] opacity-40 rounded-full" />
          </span>
        </h1>

        {/* Sub */}
        <p className="text-lg md:text-xl text-[var(--text-2)] max-w-2xl mb-10 leading-relaxed"
          style={{ animation: 'fade-up 0.7s ease-out 0.25s both' }}>
          Blueslate deploys an AI receptionist that answers instantly, books trials, captures every lead, and never calls in sick — purpose-built for franchise owners.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-14"
          style={{ animation: 'fade-up 0.7s ease-out 0.4s both' }}>
          <Link href="/register" className="btn-primary py-4 px-8 text-xs w-full sm:w-auto justify-center group overflow-hidden relative shadow-[0_0_24px_rgba(232,93,63,0.35)] hover:shadow-[0_0_36px_rgba(232,93,63,0.55)]">
            <span className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-[scan-right_1.5s_ease-in-out_infinite]" />
            Start Free — No CC Required
            <ArrowRight size={15} className="ml-2 group-hover:translate-x-1.5 transition-transform" />
          </Link>
          <a href="#demo" className="btn-ghost py-4 px-8 text-xs w-full sm:w-auto justify-center hover:-translate-y-0.5 hover:scale-[1.02] transition-all rounded-lg font-display font-bold uppercase tracking-widest group">
            <Play size={13} className="mr-2 text-[var(--accent)] group-hover:animate-pulse" />
            Watch Live Demo
          </a>
        </div>

        {/* Hero stats */}
        <div ref={heroRef} className="flex flex-wrap justify-center gap-3 mb-16" style={{ animation: 'fade-up 0.7s ease-out 0.55s both' }}>
          <StatPill value={`${heroLocations}+`} label="franchise locations" icon={Users} color="var(--accent)" />
          <StatPill value={`${heroMinutes.toLocaleString()}+`} label="calls handled" icon={PhoneCall} color="var(--live)" />
          <StatPill value={`${heroRate}%`} label="lead capture rate" icon={TrendingUp} color="var(--accent-2)" />
        </div>

        {/* Dashboard preview */}
        <div className="w-full max-w-5xl mx-auto relative" style={{ animation: 'fade-up 0.9s ease-out 0.7s both' }}>
          {/* Glow */}
          <div className="absolute -inset-4 bg-[var(--accent)] opacity-[0.06] blur-3xl rounded-3xl pointer-events-none" />
          <DashboardMockup />
        </div>
      </section>

      {/* ── Social proof / integrations strip ── */}
      <section className="border-y border-[var(--border)] bg-[var(--surface-2)] py-6 px-6 relative z-10 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="font-display font-bold uppercase text-[10px] tracking-widest text-[var(--text-3)] whitespace-nowrap">Powered by</p>
          <div className="flex flex-wrap justify-center gap-8">
            {integrations.map((int) => (
              <div key={int.name} className="flex items-center gap-2 group cursor-default">
                <span className="w-2 h-2 rounded-full" style={{ background: int.color }} />
                <span className="font-display font-bold text-sm text-[var(--text-2)] group-hover:text-[var(--text-1)] transition-colors">{int.name}</span>
                <span className="text-[10px] text-[var(--text-3)] font-display hidden sm:block">· {int.desc}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {[...Array(5)].map((_, i) => <Star key={i} size={12} className="fill-[var(--accent-2)] text-[var(--accent-2)]" />)}
            <span className="text-xs text-[var(--text-3)] font-display ml-1">4.9 / 5</span>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-24 px-6 relative z-10">
        <div ref={howView.ref} className="max-w-7xl mx-auto">
          <div className={`text-center mb-16 transition-all duration-700 ${howView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="font-display font-bold uppercase text-[10px] tracking-widest text-[var(--accent)] mb-3">Simple setup</p>
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-[var(--text-1)] mb-4">
              Live in under 30 minutes
            </h2>
            <p className="text-[var(--text-2)] max-w-xl mx-auto">No technical skills required. If you can paste a URL, you can deploy your AI receptionist today.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector lines */}
            <div className="hidden md:block absolute top-12 left-[33%] right-[33%] h-px bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent" />

            {steps.map((step, i) => (
              <div key={i} className={`transition-all duration-700 delay-[${i * 150}ms] ${howView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${i * 0.15}s` }}>
                <TiltCard className="p-8 h-full bg-[var(--surface)]">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                      style={{ background: `${step.color}15`, border: `1px solid ${step.color}25` }}>
                      <step.icon size={24} style={{ color: step.color }} />
                    </div>
                    <span className="font-display font-bold text-4xl tracking-tighter" style={{ color: `${step.color}20` }}>{step.num}</span>
                  </div>
                  <h3 className="font-display font-bold text-lg text-[var(--text-1)] mb-3">{step.title}</h3>
                  <p className="text-sm text-[var(--text-3)] leading-relaxed">{step.desc}</p>
                  {i < 2 && (
                    <div className="mt-6 flex items-center gap-1 text-[var(--accent)]">
                      <ChevronRight size={14} />
                      <span className="text-[10px] font-display font-bold uppercase tracking-widest">Then</span>
                    </div>
                  )}
                </TiltCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6 bg-[var(--surface-2)] border-y border-[var(--border)] relative z-10">
        <div className="absolute inset-0 bg-dot-pattern opacity-[0.04] pointer-events-none" />
        <div ref={featuresView.ref} className="max-w-7xl mx-auto relative z-10">
          <div className={`text-center mb-16 transition-all duration-700 ${featuresView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="font-display font-bold uppercase text-[10px] tracking-widest text-[var(--accent)] mb-3">Platform capabilities</p>
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-[var(--text-1)] mb-4">Everything your franchise needs</h2>
            <p className="text-[var(--text-2)] max-w-2xl mx-auto">One platform to automate your front desk, capture every lead, and keep multiple franchise locations perfectly in sync.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((feat, i) => (
              <div key={i} className={`transition-all duration-700 ${featuresView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{ transitionDelay: `${feat.delay}s` }}>
                <TiltCard className="p-6 h-full bg-[var(--surface)]">
                  <div className="w-11 h-11 rounded-xl bg-[var(--accent-tint)] flex items-center justify-center mb-5 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-[var(--accent)] transition-all duration-300 shadow-sm border border-[var(--accent)]/10">
                    <feat.icon size={22} className="text-[var(--accent)] group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="font-display font-bold uppercase tracking-widest text-[11px] text-[var(--text-1)] mb-2.5 group-hover:text-[var(--accent)] transition-colors">{feat.title}</h3>
                  <p className="text-xs text-[var(--text-3)] leading-relaxed">{feat.desc}</p>
                </TiltCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Demo ── */}
      <section id="demo" className="py-24 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-display font-bold uppercase text-[10px] tracking-widest text-[var(--accent)] mb-3">See it in action</p>
              <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-[var(--text-1)] mb-6">
                Talk to Sage — right now, live
              </h2>
              <p className="text-[var(--text-2)] mb-8 leading-relaxed">
                This isn&apos;t a video. Ask the AI receptionist anything about our pilot franchise (XP League Frisco) — pricing, schedules, programs — and get a real answer, streamed live from the same agent that answers your calls.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Clock, text: 'Responds in under 1 second, 24/7/365' },
                  { icon: MessageSquare, text: 'Handles objections, pricing questions, and scheduling' },
                  { icon: Database, text: 'Lead data saved to dashboard in under 60 seconds' },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-center gap-3 group hover:translate-x-1 transition-transform">
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent-tint)] flex items-center justify-center flex-shrink-0 border border-[var(--accent)]/15">
                      <Icon size={14} className="text-[var(--accent)]" />
                    </div>
                    <span className="text-sm text-[var(--text-2)] group-hover:text-[var(--text-1)] transition-colors">{text}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex gap-3">
                <a href="/register" className="btn-primary py-3 px-6 text-xs group overflow-hidden relative inline-flex items-center">
                  <span className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-[scan-right_1.5s_ease-in-out_infinite]" />
                  Get This For My Franchise
                  <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </div>
            <div>
              <VoiceAgent />
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 px-6 bg-[var(--surface-2)] border-y border-[var(--border)] relative z-10">
        <div className="absolute inset-0 bg-micro-grid opacity-[0.04] pointer-events-none" />
        <div ref={testimonialsView.ref} className="max-w-7xl mx-auto relative z-10">
          <div className={`text-center mb-16 transition-all duration-700 ${testimonialsView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="font-display font-bold uppercase text-[10px] tracking-widest text-[var(--accent)] mb-3">Real results</p>
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-[var(--text-1)] mb-4">
              Franchise owners love Blueslate
            </h2>
            <p className="text-[var(--text-2)] max-w-xl mx-auto">Real results from real franchise operators — not cherry-picked edge cases.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className={`transition-all duration-700 ${testimonialsView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{ transitionDelay: `${i * 0.15}s` }}>
                <TiltCard className="p-8 h-full bg-[var(--surface)] flex flex-col">
                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(t.stars)].map((_, j) => <Star key={j} size={13} className="fill-[var(--accent-2)] text-[var(--accent-2)]" />)}
                  </div>
                  <p className="text-sm text-[var(--text-2)] leading-relaxed mb-6 flex-1 italic">&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center justify-between pt-5 border-t border-[var(--border)]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-display font-bold text-sm shadow-sm">
                        {t.avatar}
                      </div>
                      <div>
                        <p className="font-display font-bold text-[11px] uppercase tracking-widest text-[var(--text-1)]">{t.name}</p>
                        <p className="text-[10px] text-[var(--text-3)]">{t.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold text-xl text-[var(--accent)]">{t.metric}</p>
                      <p className="text-[9px] font-display uppercase tracking-widest text-[var(--text-3)]">{t.metricLabel}</p>
                    </div>
                  </div>
                </TiltCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-6 relative z-10 overflow-hidden">
        <div ref={ctaView.ref} className="max-w-4xl mx-auto text-center relative">
          {/* Glow */}
          <div className="absolute inset-0 bg-[var(--accent)] opacity-[0.05] blur-3xl rounded-full scale-150 pointer-events-none" />

          <div className={`relative transition-all duration-700 ${ctaView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--live)]/10 border border-[var(--live)]/30 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--live)] animate-pulse" />
              <span className="font-display font-bold uppercase text-[9px] tracking-widest text-[var(--live)]">Live in 30 minutes</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-display font-bold tracking-tight text-[var(--text-1)] mb-6">
              Ready to stop losing leads<br />to missed calls?
            </h2>
            <p className="text-lg text-[var(--text-2)] mb-10 max-w-2xl mx-auto">
              Join 200+ franchise owners who trust Blueslate to handle every inbound call — perfectly, every time.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/register" className="btn-primary py-4 px-10 text-sm group overflow-hidden relative inline-flex items-center shadow-[0_0_30px_rgba(232,93,63,0.4)] hover:shadow-[0_0_50px_rgba(232,93,63,0.6)]">
                <span className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-[scan-right_1.5s_ease-in-out_infinite]" />
                Get Free Access
                <ArrowRight size={16} className="ml-2 group-hover:translate-x-2 transition-transform" />
              </a>
              <a href="mailto:sales@blueslate.ai" className="btn-ghost py-4 px-10 text-sm rounded-xl font-display font-bold uppercase tracking-widest hover:-translate-y-0.5 transition-all">
                Talk to Sales
              </a>
            </div>
            <p className="text-xs text-[var(--text-3)] mt-5 font-display">Free during pilot · No credit card · Setup in minutes</p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface)] relative overflow-hidden z-10">
        <div className="absolute inset-0 bg-micro-grid opacity-[0.03] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-8 relative z-10">
          {/* Footer grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
            {/* Brand */}
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-[var(--accent)] text-white flex items-center justify-center font-display font-bold text-xs rounded-sm">BS</div>
                <span className="font-display font-bold uppercase tracking-widest text-sm text-[var(--text-1)]">Blueslate AI</span>
              </div>
              <p className="text-sm text-[var(--text-3)] leading-relaxed max-w-xs mb-5">
                The AI receptionist purpose-built for franchise businesses. Stop missing calls. Start booking more.
              </p>
              {/* Newsletter */}
              <p className="font-display font-bold uppercase text-[9px] tracking-widest text-[var(--text-3)] mb-2">Get product updates</p>
              <div className="max-w-xs mb-5 relative">
                <NewsletterForm />
              </div>
              <div className="flex gap-3">
                {[['T', 'https://twitter.com'], ['in', 'https://linkedin.com'], ['G', 'https://github.com']].map(([s, href]) => (
                  <a key={s} href={href} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-3)] font-display font-bold text-[11px] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5 transition-all">
                    {s}
                  </a>
                ))}
              </div>
            </div>

            {/* Links */}
            {[
              { title: 'Product', links: [['#features', 'Features'], ['#how-it-works', 'How it Works'], ['#demo', 'Live Demo']] },
              { title: 'Company', links: [['#', 'About'], ['#', 'Blog'], ['#', 'Careers'], ['mailto:sales@blueslate.ai', 'Contact']] },
              { title: 'Legal', links: [['#', 'Privacy Policy'], ['#', 'Terms of Service'], ['#', 'Security'], ['#', 'HIPAA Compliance']] },
            ].map((col) => (
              <div key={col.title}>
                <p className="font-display font-bold uppercase tracking-widest text-[9px] text-[var(--text-3)] mb-4">{col.title}</p>
                <div className="space-y-2.5">
                  {col.links.map(([href, label]) => (
                    <a key={label} href={href} className="block text-sm text-[var(--text-2)] hover:text-[var(--accent)] hover:translate-x-1 transition-all font-display">{label}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="border-t border-[var(--border)] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="font-display font-bold text-2xl tracking-[0.3em] text-[var(--text-3)] opacity-30 hover:opacity-100 hover:tracking-[0.5em] hover:text-[var(--accent)] transition-all duration-700 cursor-default">
              BLUESLATE
            </div>
            <p className="text-[10px] text-[var(--text-3)] font-display uppercase tracking-widest text-center">
              © 2026 Blueslate Venture Studio · Built at NeoAistriq · All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--live)] animate-pulse" />
              <span className="text-[10px] font-display font-bold uppercase tracking-widest text-[var(--live)]">All systems operational</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Inline keyframes ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-3d { from { transform: rotateX(68deg) rotateZ(0deg); } to { transform: rotateX(68deg) rotateZ(360deg); } }
        @keyframes spin-3d-reverse { from { transform: rotateX(72deg) rotateZ(360deg); } to { transform: rotateX(72deg) rotateZ(0deg); } }
        @keyframes float-y { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes voice-bar { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }
        @keyframes ripple { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes mic-ring { 0%,100% { box-shadow: 0 0 0 0 rgba(232,93,63,0.5); } 70% { box-shadow: 0 0 0 18px transparent; } }
      `}} />
    </div>
  )
}
