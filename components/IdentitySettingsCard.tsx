'use client'

import { useState } from 'react'
import { Bot, Save, CheckCircle2, AlertCircle } from 'lucide-react'

interface Props {
  initialName:     string
  initialGreeting: string
}

export default function IdentitySettingsCard({ initialName, initialGreeting }: Props) {
  const [agentName,    setAgentName]    = useState(initialName)
  const [greeting,     setGreeting]     = useState(initialGreeting)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      const res = await fetch('/api/tenant-identity', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ agent_name: agentName, agent_greeting: greeting }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
        <div className="w-9 h-9 bg-[var(--accent)] rounded-md flex items-center justify-center shrink-0">
          <Bot size={17} className="text-white" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[var(--text-1)]">AI Agent Identity</p>
          <p className="text-[12px] text-[var(--text-3)] mt-0.5">
            Customize your receptionist&apos;s name and greeting
          </p>
        </div>
      </div>

      <form onSubmit={save} className="p-6 flex flex-col gap-6 relative z-10">

        {/* Agent Name */}
        <div>
          <label className="font-display font-bold uppercase flex items-baseline gap-2 text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-3">
            Agent Name
            <span className="font-body normal-case font-normal tracking-normal text-[var(--text-3)] text-[11px] opacity-70">
              (max 80 chars)
            </span>
          </label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            maxLength={80}
            required
            placeholder="e.g. Alex at XP League Frisco"
            className="input-field w-full"
          />
          <p className="font-body text-[11px] text-[var(--text-3)] mt-2">
            System prompt: <span className="font-display text-[var(--text-2)] glow-text">You are {agentName || '[agent_name]'}.</span>
          </p>
        </div>

        {/* Greeting */}
        <div>
          <label className="font-display font-bold uppercase flex items-baseline gap-2 text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-3">
            Opening Greeting
            <span className="font-body normal-case font-normal tracking-normal text-[var(--text-3)] text-[11px] opacity-70">
              (max 200 chars)
            </span>
          </label>
          <textarea
            rows={3}
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            maxLength={200}
            required
            placeholder="Hi! Thanks for calling. How can I help you today?"
            className="input-field w-full resize-none leading-relaxed"
          />
        </div>

        {/* Preview */}
        <div className="bg-[var(--surface-2)] border border-[var(--border)] p-5 relative overflow-hidden group/preview">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)] opacity-5 blur-[50px] pointer-events-none group-hover/preview:opacity-10 transition-opacity" />
          <p className="font-display font-bold uppercase text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-4">
            ── Live Preview
          </p>
          <div className="flex gap-4 items-start relative z-10">
            <div className="w-8 h-8 bg-[var(--accent)] rounded-full flex items-center justify-center shrink-0 mt-1">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-sm)] rounded-lg p-3 text-[13px] text-[var(--text-1)] leading-relaxed max-w-[340px] relative">
              <div className="absolute top-3 -left-[6px] w-3 h-3 bg-[var(--surface)] border-l border-b border-[var(--border)] rotate-45" />
              <span className="relative z-10">{greeting || 'Hi! Thanks for calling. How can I help you today?'}</span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 text-[13px] text-[var(--danger)] border border-[var(--danger)] rounded-md p-3 bg-[var(--surface-2)]">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Save */}
        <div className="flex items-center gap-4 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (
              <>
                <span className="inline-block w-1 h-2.5 bg-[var(--bg)] animate-[blink-cursor_0.7s_0s_steps(1)_infinite]" />
                <span className="inline-block w-1 h-2.5 bg-[var(--bg)] animate-[blink-cursor_0.7s_0.2s_steps(1)_infinite]" />
                <span className="inline-block w-1 h-2.5 bg-[var(--bg)] animate-[blink-cursor_0.7s_0.4s_steps(1)_infinite]" />
                Saving
              </>
            ) : saved ? (
              <><CheckCircle2 size={14} /> Saved</>
            ) : (
              <><Save size={14} /> Save Identity</>
            )}
          </button>
          {saved && (
            <span className="font-body text-[11px] text-[var(--live)] animate-[fade-up_0.3s_ease_both]">
              Applied to new playground sessions immediately.
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
