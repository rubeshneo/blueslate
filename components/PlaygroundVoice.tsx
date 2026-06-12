'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, Bot, Send, AlertCircle, Loader2 } from 'lucide-react'

type ChatMsg    = { role: 'user' | 'assistant'; content: string }
type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking'

const CHIPS = [
  'What programs do you offer?',
  'How much does it cost?',
  'Can I book a free trial?',
  'What are your hours?',
]

export default function PlaygroundVoice() {
  const [status,       setStatus]       = useState<VoiceStatus>('idle')
  const [userText,     setUserText]     = useState('')
  const [agentText,    setAgentText]    = useState('')
  const [agentName,    setAgentName]    = useState('AI Receptionist')
  const [history,      setHistory]      = useState<ChatMsg[]>([])
  const [error,        setError]        = useState('')
  const [fallbackText, setFallbackText] = useState('')
  const [hasSpoken,    setHasSpoken]    = useState(false)
  const [browserOk,    setBrowserOk]    = useState(true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in (window as any))
    setBrowserOk(ok)
    return () => { window.speechSynthesis?.cancel() }
  }, [])

  function startListening() {
    if (status === 'speaking') { stopSpeaking(); return }
    if (status !== 'idle') return
    setError('')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w  = window as any
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) { setError('Voice not supported in this browser. Please type below.'); return }

    const r = new SR()
    r.lang            = 'en-US'
    r.interimResults  = false
    r.maxAlternatives = 1
    r.continuous      = false

    r.onstart  = () => setStatus('listening')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const text = e.results[0][0].transcript.trim()
      if (text) { setUserText(text); sendMessage(text) }
    }
    r.onerror = () => { setError('Could not hear you. Try again or type below.'); setStatus('idle') }
    r.onend   = () => { recogRef.current = null }

    recogRef.current = r
    r.start()
  }

  async function sendMessage(text: string) {
    setStatus('processing')
    setAgentText('')
    setError('')
    setHasSpoken(true)

    try {
      const res = await fetch('/api/playground', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text, history: history.slice(-6) }),
      })
      if (!res.ok || !res.body) throw new Error('Agent unavailable. Try again.')

      const headerName = res.headers.get('X-Agent-Name')
      if (headerName) setAgentName(headerName)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setAgentText(acc)
      }
      if (!acc.trim()) throw new Error('No response. Try again.')
      setHistory(h => [...h, { role: 'user', content: text }, { role: 'assistant', content: acc }])
      speakOut(acc)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setStatus('idle')
    }
  }

  function speakOut(text: string) {
    const synth = window.speechSynthesis
    synth.cancel()
    const clean = text.replace(/[*_`#]/g, '')
    const utt   = new SpeechSynthesisUtterance(clean)
    utt.rate    = 1.05
    utt.pitch   = 1.0
    utt.volume  = 1

    const loadAndSpeak = () => {
      const voices = synth.getVoices()
      const pick   =
        voices.find(v => v.lang === 'en-US' && /google|samantha|karen|moira/i.test(v.name)) ??
        voices.find(v => v.lang.startsWith('en'))
      if (pick) utt.voice = pick
      utt.onstart = () => setStatus('speaking')
      utt.onend   = () => setStatus('idle')
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
    idle:       hasSpoken ? 'Tap to ask another question' : `Tap the mic and ask ${agentName} anything`,
    listening:  'Listening… speak now',
    processing: `${agentName} is thinking…`,
    speaking:   `Tap to stop ${agentName}`,
  }

  return (
    <div className="card flex flex-col overflow-hidden h-[calc(100vh-9rem)] max-h-[780px] w-full max-w-3xl mx-auto relative z-10 select-none">

      {/* ── Header ── */}
      <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--live)] animate-pulse shadow-[0_0_5px_var(--live)]" />
          <span className="font-display font-bold text-[10px] uppercase tracking-widest text-[var(--text-2)]">
            Live Voice Mode
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Mic size={12} className="text-[var(--accent)]" />
          <span className="font-display text-[9px] uppercase tracking-widest text-[var(--accent)] font-bold">
            {agentName}
          </span>
        </div>
      </div>

      {/* ── Simulation banner ── */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-2 bg-[rgba(255,174,0,0.08)] border-b border-[var(--warn)] border-opacity-40">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--warn)] animate-[live-dot_2s_ease-in-out_infinite] shadow-[0_0_5px_var(--warn)] shrink-0" />
        <p className="font-display font-bold uppercase text-[9px] tracking-[0.2em] text-[var(--warn)]">
          Simulation mode — no real calls or SMS are sent
        </p>
      </div>

      {/* ── Conversation bubble (current exchange only) ── */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-2 flex flex-col gap-3 bg-dot-pattern">
        {!hasSpoken && status === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center animate-[fade-up_0.4s_ease_both]">
            <div className="relative flex items-center justify-center w-14 h-14 border border-[var(--border)]">
              <Mic size={22} className="text-[var(--accent-2)]" />
              <span className="absolute top-0 left-0  w-2 h-2 border-t-2 border-l-2 border-[var(--accent-2)]" />
              <span className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[var(--accent-2)]" />
              <span className="absolute bottom-0 left-0  w-2 h-2 border-b-2 border-l-2 border-[var(--accent-2)]" />
              <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--accent-2)]" />
            </div>
            <p className="font-display font-bold uppercase text-[12px] tracking-[0.18em] text-[var(--accent-2)]">
              Ask your AI receptionist
            </p>
            <p className="font-body max-w-xs" style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              Tap the mic below — the AI answers using only your scraped knowledge base.
            </p>
          </div>
        )}

        {userText && (
          <div className="flex justify-end" style={{ animation: 'fade-up 0.25s ease-out both' }}>
            <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-tr-sm text-sm leading-relaxed bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)]">
              {userText}
            </div>
          </div>
        )}

        {(agentText || status === 'processing') && (
          <div className="flex gap-2 items-start" style={{ animation: 'fade-up 0.25s ease-out both' }}>
            <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_0_10px_var(--accent)]">
              <Bot size={12} className="text-white" />
            </div>
            <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-tl-sm text-sm leading-relaxed bg-[var(--accent-tint)] border border-[var(--accent)]/20 text-[var(--text-1)]">
              {status === 'processing' && !agentText
                ? <span className="flex items-end gap-1" style={{ height: '14px' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        display: 'inline-block', width: '6px', height: '10px',
                        background: 'var(--accent)',
                        animation: `blink-cursor 0.9s ${i * 0.25}s steps(1) infinite`,
                      }} />
                    ))}
                  </span>
                : agentText
              }
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--danger)] mt-2">
            <AlertCircle size={12} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── Mic + chips + fallback input ── */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-2)] px-4 pt-5 pb-4 flex flex-col items-center gap-4">

        {/* Mic button */}
        <div className="relative flex items-center justify-center" style={{ width: '88px', height: '88px' }}>
          {status === 'listening' && (
            <>
              <span className="absolute inset-0 rounded-full border-2 border-[var(--accent)] opacity-60"
                style={{ animation: 'ripple 1.2s ease-out infinite' }} />
              <span className="absolute inset-0 rounded-full border-2 border-[var(--accent)] opacity-30"
                style={{ animation: 'ripple 1.2s ease-out 0.4s infinite' }} />
            </>
          )}
          <button
            onClick={startListening}
            disabled={status === 'processing'}
            aria-label={statusLabel[status]}
            className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 disabled:opacity-50 focus:outline-none"
            style={{
              background: status === 'idle'       ? 'var(--accent)'
                        : status === 'listening'  ? '#FF6B4A'
                        : status === 'speaking'   ? 'var(--accent)'
                        : 'var(--surface)',
              boxShadow: status === 'listening' ? '0 0 0 0 rgba(232,93,63,0.5)'
                       : status === 'speaking'  ? '0 0 28px rgba(232,93,63,0.45)'
                       : 'var(--shadow-accent)',
              animation: status === 'listening' ? 'mic-ring 1.2s ease-out infinite' : undefined,
            }}
          >
            {/* Speaking bars */}
            {status === 'speaking' && (
              <span className="absolute inset-0 flex items-center justify-center gap-0.5 pointer-events-none">
                {[0, 0.15, 0.3, 0.15, 0].map((d, i) => (
                  <span key={i} className="w-1 rounded-full bg-white/70"
                    style={{ height: `${20 + i * 6}px`, animation: 'voice-bar 0.5s ease-in-out infinite alternate', animationDelay: `${d}s` }} />
                ))}
              </span>
            )}
            {status === 'processing' && <Loader2 size={28} className="text-[var(--accent)] animate-spin" />}
            {(status === 'idle' || status === 'listening') && <Mic size={28} className="text-white relative z-10" />}
          </button>
        </div>

        {/* Status label */}
        <p className="font-display font-bold uppercase text-center text-[9px] tracking-[0.2em] text-[var(--text-3)] transition-all duration-300">
          {statusLabel[status]}
        </p>

        {/* Suggestion chips — before first interaction */}
        {!hasSpoken && status === 'idle' && (
          <div className="flex flex-wrap justify-center gap-2">
            {CHIPS.map(s => (
              <button key={s}
                onClick={() => { setUserText(s); sendMessage(s) }}
                className="px-2.5 py-1.5 text-[10px] font-display font-medium rounded-full border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-tint)] transition-all">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Text fallback */}
        <form onSubmit={sendFallback} className="flex items-center gap-2 w-full">
          <input
            value={fallbackText}
            onChange={e => setFallbackText(e.target.value)}
            disabled={status !== 'idle'}
            placeholder={browserOk ? 'Or type your question…' : 'Type your question (mic not supported in this browser)'}
            className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-full px-4 py-2 text-xs text-[var(--text-1)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-3)]"
          />
          <button type="submit"
            disabled={status !== 'idle' || !fallbackText.trim()}
            className="w-9 h-9 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0 hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-all">
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  )
}
