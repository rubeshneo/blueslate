'use client'

import { useState } from 'react'
import { Building2, Save, CheckCircle2, AlertCircle } from 'lucide-react'

interface Props {
  initialName: string
  initialSlug: string
}

export default function WorkspaceSettingsCard({ initialName, initialSlug }: Props) {
  const [name,   setName]   = useState(initialName)
  const [slug,   setSlug]   = useState(initialSlug)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function sanitizeSlug(val: string) {
    return val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      const res = await fetch('/api/tenant-identity', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), slug: slug.trim() }),
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
          <Building2 size={17} className="text-white" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[var(--text-1)]">Workspace</p>
          <p className="text-[12px] text-[var(--text-3)] mt-0.5">
            Franchise name and identifier used across the platform
          </p>
        </div>
      </div>

      <form onSubmit={save} className="p-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Franchise Name */}
          <div>
            <label className="font-display font-bold uppercase text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-3 block">
              Franchise Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              placeholder="e.g. XP League Frisco"
              className="input-field w-full"
            />
            <p className="text-[11px] text-[var(--text-3)] mt-2">
              Displayed in the app header and reports
            </p>
          </div>

          {/* Slug */}
          <div>
            <label className="font-display font-bold uppercase text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-3 block">
              Slug
              <span className="normal-case font-normal tracking-normal ml-2 opacity-70">
                (lowercase, hyphens only)
              </span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
              maxLength={60}
              required
              placeholder="e.g. xp-league-frisco"
              className="input-field w-full font-mono"
            />
            <p className="text-[11px] text-[var(--text-3)] mt-2">
              Used as a unique identifier — auto-formats as you type
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 text-[13px] text-[var(--danger)] border border-[var(--danger)] rounded-md p-3 bg-[var(--surface-2)]">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center gap-4 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (
              <>
                <span className="inline-block w-1 h-2.5 bg-white animate-[blink-cursor_0.7s_0s_steps(1)_infinite]" />
                <span className="inline-block w-1 h-2.5 bg-white animate-[blink-cursor_0.7s_0.2s_steps(1)_infinite]" />
                <span className="inline-block w-1 h-2.5 bg-white animate-[blink-cursor_0.7s_0.4s_steps(1)_infinite]" />
                Saving
              </>
            ) : saved ? (
              <><CheckCircle2 size={14} /> Saved</>
            ) : (
              <><Save size={14} /> Save Workspace</>
            )}
          </button>
          {saved && (
            <span className="text-[11px] text-[var(--live)] animate-[fade-up_0.3s_ease_both]">
              Workspace updated successfully.
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
