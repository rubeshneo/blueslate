'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, RotateCcw, MessageSquare, Mic, MicOff, Volume2 } from 'lucide-react'

// ── Web Speech API types ──────────────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}
interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}
interface SpeechRecognitionAlternative {
  readonly transcript: string
}
interface SpeechRecognitionInstance extends EventTarget {
  lang:            string
  continuous:      boolean
  interimResults:  boolean
  maxAlternatives: number
  start():  void
  stop():   void
  abort():  void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror:  ((e: Event) => void) | null
  onend:    (() => void) | null
}
declare global {
  interface Window {
    SpeechRecognition?:       new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

// Picks the best available en-US voice; waits for voices to load if needed
function speak(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()

  const doSpeak = () => {
    const utt    = new SpeechSynthesisUtterance(text)
    utt.rate     = 1.1
    utt.pitch    = 1
    utt.volume   = 1
    const voices = window.speechSynthesis.getVoices()
    const pref   =
      voices.find((v) => /neural|premium|enhanced/i.test(v.name) && v.lang.startsWith('en')) ||
      voices.find((v) => v.lang === 'en-US' && v.localService) ||
      voices.find((v) => v.lang.startsWith('en') && v.localService) ||
      voices.find((v) => v.lang.startsWith('en'))
    if (pref) utt.voice = pref
    if (onEnd) utt.onend = onEnd
    window.speechSynthesis.speak(utt)
  }

  if (window.speechSynthesis.getVoices().length > 0) {
    doSpeak()
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null
      doSpeak()
    }
  }
}

interface Message {
  role:    'user' | 'assistant'
  content: string
}

// ── Blinking block loader ─────────────────────────────────────────────────────
function BlockLoader() {
  return (
    <div className="flex items-end gap-1" style={{ height: '14px' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: '6px',
            height: '10px',
            background: 'var(--accent)',
            animation: `blink-cursor 0.9s ${i * 0.25}s steps(1) infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ── Waveform bars ─────────────────────────────────────────────────────────────
function WaveformBars() {
  const heights = [40, 75, 100, 55, 85, 45, 70]
  return (
    <div className="flex items-end gap-0.5" style={{ height: '18px' }}>
      {heights.map((h, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: '3px',
            background: 'var(--accent)',
            height: `${h}%`,
            transformOrigin: 'bottom',
            animation: `voice-bar ${0.35 + i * 0.04}s ${i * 0.06}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </div>
  )
}

export default function PlaygroundChat() {
  const [messages,        setMessages]        = useState<Message[]>([])
  const [input,           setInput]           = useState('')
  const [interimText,     setInterimText]     = useState('')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [agentName,       setAgentName]       = useState('AI Receptionist')
  const [voiceMode,       setVoiceMode]       = useState(false)
  const [listening,       setListening]       = useState(false)
  const [ttsActive,       setTtsActive]       = useState(false)
  const [voiceSupported,  setVoiceSupported]  = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const recogRef  = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => { setVoiceSupported(getSpeechRecognition() !== null) }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  useEffect(() => {
    if (!voiceMode) {
      recogRef.current?.abort()
      setListening(false)
      window.speechSynthesis?.cancel()
      setTtsActive(false)
      setInterimText('')
    }
  }, [voiceMode])

  const startListening = useCallback(() => {
    const SR = getSpeechRecognition()
    if (!SR) return
    const recog           = new SR()
    recog.lang            = 'en-US'
    recog.continuous      = false
    recog.interimResults  = true   // show transcript as user speaks
    recog.maxAlternatives = 1
    recogRef.current      = recog

    recog.onresult = (e) => {
      let finalText   = ''
      let interimOnly = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript
        } else {
          interimOnly += e.results[i][0].transcript
        }
      }
      if (finalText) {
        setInput(finalText.trim())
        setInterimText('')
      } else {
        setInterimText(interimOnly)
      }
    }
    recog.onerror = () => { setListening(false); setInterimText('') }
    recog.onend   = () => { setListening(false); setInterimText('') }
    recog.start()
    setListening(true)
  }, [])

  const stopListening = useCallback(() => {
    recogRef.current?.stop()
    setListening(false)
  }, [])

  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || loading) return

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setInterimText('')
    setLoading(true)
    setError(null)

    let streamStarted = false

    try {
      const res = await fetch('/api/playground', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text, history: messages }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Request failed')
      }

      const headerName = res.headers.get('X-Agent-Name')
      if (headerName) setAgentName(headerName)

      // Insert empty placeholder message; stream fills it token-by-token
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])
      setLoading(false)
      streamStarted = true

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let reply     = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        reply += decoder.decode(value, { stream: true })
        const snap = reply
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: snap }
          return next
        })
      }

      if (voiceMode && reply) {
        setTtsActive(true)
        speak(reply, () => setTtsActive(false))
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    } finally {
      if (!streamStarted) setLoading(false)
      if (!voiceMode) setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [input, loading, messages, voiceMode])

  // Auto-send when voice recognition ends and input is ready
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (voiceMode && input && !listening && !loading) { send(input) } }, [listening])

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function reset() {
    setMessages([])
    setError(null)
    setInput('')
    setInterimText('')
    window.speechSynthesis?.cancel()
    setTtsActive(false)
    recogRef.current?.abort()
    setListening(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const SUGGESTIONS = ['What programs do you offer?', 'How much does it cost?', 'Can I book a free trial?', 'What are your hours?']

  // Live label shown under mic button
  const liveLabel = listening
    ? (interimText ? `"${interimText}"` : '● Listening — release to send')
    : ttsActive ? '● Speaking'
    : loading   ? '● Processing'
    : 'Hold to speak'

  return (
    <div className="card flex flex-col overflow-hidden h-[calc(100vh-9rem)] max-h-[780px] w-full max-w-3xl mx-auto relative z-10">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] shadow-[0_4px_15px_rgba(0,0,0,0.1)] relative z-20">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center shrink-0 w-8 h-8 transition-colors ${ttsActive ? 'bg-[var(--live)] shadow-[0_0_10px_var(--live)]' : 'bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]'} text-[var(--bg)]`}>
            {ttsActive ? <Volume2 size={16} /> : <Bot size={16} />}
          </div>
          <div>
            <p className="font-display font-bold uppercase leading-none text-[12px] tracking-[0.1em] text-[var(--text-1)] drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
              {agentName}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {ttsActive ? (
                <WaveformBars />
              ) : (
                <>
                  <span className="w-1.5 h-1.5 bg-[var(--live)] rounded-full animate-[live-dot_1.8s_ease-in-out_infinite] shadow-[0_0_5px_var(--live)]" />
                  <span className="font-body uppercase text-[9px] tracking-[0.14em] text-[var(--live)] glow-text">
                    Bounded by knowledge base
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {voiceSupported && (
            <button
              onClick={() => setVoiceMode((v) => !v)}
              className={`btn-ghost ${voiceMode ? 'bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)] shadow-[0_0_10px_var(--accent)]' : ''}`}
            >
              {voiceMode ? <Mic size={14} /> : <MicOff size={14} />}
              {voiceMode ? 'Voice ON' : 'Voice'}
            </button>
          )}
          <button onClick={reset} className="btn-ghost">
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      </div>

      {/* ── Simulation banner ────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-2 bg-[rgba(255,174,0,0.08)] border-b border-[var(--warn)] border-opacity-40">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--warn)] animate-[live-dot_2s_ease-in-out_infinite] shadow-[0_0_5px_var(--warn)] shrink-0" />
        <p className="font-display font-bold uppercase text-[9px] tracking-[0.2em] text-[var(--warn)]">
          Simulation mode — no real calls or SMS are sent
        </p>
      </div>

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scroll-smooth p-5 flex flex-col gap-4 relative bg-dot-pattern">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-5 animate-[fade-up_0.4s_ease_both]">
            {/* Crosshair icon */}
            <div className="relative flex items-center justify-center w-14 h-14 border border-[var(--border)] shadow-[0_0_15px_rgba(0,240,255,0.1)]">
              <MessageSquare size={24} className="text-[var(--accent-2)]" />
              <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[var(--accent-2)]" />
              <span className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[var(--accent-2)]" />
              <span className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[var(--accent-2)]" />
              <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--accent-2)]" />
            </div>
            <div>
              <p className="font-display font-bold uppercase text-[12px] tracking-[0.18em] text-[var(--accent-2)] text-shadow-[0_0_8px_rgba(0,240,255,0.4)]">
                Simulate a parent inquiry
              </p>
              <p
                className="font-body mt-1.5 max-w-xs"
                style={{ fontSize: '11px', color: 'var(--text-3)' }}
              >
                {voiceMode
                  ? 'Voice mode active — hold the mic button to speak.'
                  : 'Ask anything a parent might ask. The AI responds using only your knowledge base.'}
              </p>
            </div>
            {!voiceMode && (
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {SUGGESTIONS.map((q, i) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus() }}
                    style={{
                      padding: '5px 10px',
                      fontSize: '10px',
                      fontFamily: 'var(--font-body)',
                      color: 'var(--text-2)',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.1s',
                      animation: `fade-up 0.4s ${0.1 + i * 0.07}s both`,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-2)' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            style={{ animation: `fade-up 0.25s ease both` }}
          >
            <div className={`flex items-center justify-center shrink-0 w-8 h-8 mt-1 rounded-full border border-[var(--border)] ${msg.role === 'user' ? 'bg-[var(--surface-2)] text-[var(--text-2)]' : 'bg-[var(--accent)] text-white'}`}>
              {msg.role === 'user' ? <User size={15} /> : <Bot size={15} />}
            </div>
            <div className={`max-w-[75%] p-3.5 text-[14px] leading-relaxed rounded-lg border ${
              msg.role === 'user'
                ? 'bg-[var(--accent-tint)] text-[var(--text-1)] border-[var(--border)]'
                : 'bg-[var(--surface-2)] text-[var(--text-1)] border-[var(--border)]'
            }`}>
              {msg.content}
              {/* Streaming cursor for empty assistant placeholder */}
              {msg.role === 'assistant' && msg.content === '' && (
                <span style={{ display: 'inline-block', width: '6px', height: '12px', background: 'var(--accent)', animation: 'blink-cursor 0.7s steps(1) infinite', verticalAlign: 'middle' }} />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex items-center justify-center shrink-0 w-8 h-8 mt-1 bg-[var(--accent)] text-white rounded-full border border-[var(--border)]">
              <Bot size={15} />
            </div>
            <div className="flex items-center p-3.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg">
              <BlockLoader />
            </div>
          </div>
        )}

        {error && (
          <div
            className="font-body"
            style={{
              fontSize: '11px',
              color: 'var(--danger)',
              background: 'transparent',
              border: '1px solid var(--danger)',
              padding: '10px 14px',
            }}
          >
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input area ───────────────────────────────────────────────────── */}
      <div className="shrink-0 p-4 border-t border-[var(--border)] bg-[var(--surface-2)] shadow-[0_-4px_15px_rgba(0,0,0,0.1)] relative z-20">
        {voiceMode ? (
          <div className="flex flex-col items-center gap-3 py-1">
            {/* Mic button with sonar rings */}
            <div className="relative flex items-center justify-center" style={{ width: '72px', height: '72px' }}>
              {listening && [0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    border: '2px solid var(--accent)',
                    borderRadius: '50%',
                    animation: `mic-ring-expand 1.4s ${i * 0.45}s ease-out infinite`,
                  }}
                />
              ))}
              <button
                onMouseDown={startListening}
                onMouseUp={stopListening}
                onTouchStart={startListening}
                onTouchEnd={stopListening}
                disabled={loading}
                style={{
                  position: 'relative',
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: listening ? 'var(--danger)' : 'var(--accent)',
                  color: 'var(--bg)',
                  boxShadow: listening ? '3px 3px 0 0 var(--danger)' : 'var(--shadow-accent)',
                  transform: listening ? 'scale(1.06)' : 'scale(1)',
                  transition: 'transform 0.15s, box-shadow 0.15s, background 0.15s',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                <Mic size={24} />
              </button>
            </div>
            <p
              className="font-display uppercase text-center"
              style={{
                fontSize: '9px',
                letterSpacing: '0.2em',
                color: listening && interimText ? 'var(--text-1)' : 'var(--text-3)',
                maxWidth: '260px',
                fontStyle: listening && interimText ? 'italic' : 'normal',
              }}
            >
              {liveLabel}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-3 p-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_rgba(232,93,63,0.10)] transition-all duration-200">
              <span className="shrink-0 self-center text-[14px] text-[var(--accent)] ml-2 font-semibold">
                &gt;
              </span>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask something a parent might ask…"
                className="flex-1 resize-none bg-transparent border-none outline-none font-body text-[14px] text-[var(--text-1)] max-h-[120px] leading-relaxed py-2 placeholder-[var(--text-3)]"
                onInput={(e) => {
                  const t = e.currentTarget
                  t.style.height = 'auto'
                  t.style.height = `${t.scrollHeight}px`
                }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className={`w-10 h-10 flex items-center justify-center shrink-0 mb-1 border transition-all duration-200 ${
                  input.trim() && !loading
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--bg)] shadow-[0_0_15px_var(--accent)] hover:bg-white active:scale-95'
                    : 'bg-transparent border-[var(--border-strong)] text-[var(--text-3)] cursor-not-allowed'
                }`}
              >
                <Send size={16} />
              </button>
            </div>
            <p className="font-display uppercase text-center mt-3 text-[10px] tracking-[0.2em] text-[var(--text-3)]">
              Shift+Enter new line · Enter to send
            </p>
          </>
        )}
      </div>
    </div>
  )
}
