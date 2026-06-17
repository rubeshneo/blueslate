'use client'

import { useState } from 'react'
import {
  Globe, RefreshCw, CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  ImageIcon, Trash2, ChevronLeft, ChevronRight, Pencil, Check, X,
} from 'lucide-react'
import ImageUploader from './ImageUploader'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StructuredData = Record<string, any>

const PAGE_SIZE = 5

function safe(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  return JSON.stringify(val)
}

function safeArr(val: unknown): string[] {
  if (!Array.isArray(val)) return []
  return val.map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
}

interface KnowledgeContext {
  id:              string
  source_url:      string
  scraped_at:      string
  structured_data: Record<string, unknown> | null
}

type SyncStatus = null | 'syncing' | 'synced' | 'error'

function Tag({ text }: { text: string }) {
  return (
    <span className="font-display font-bold uppercase inline-block px-2.5 py-1 text-[9px] tracking-[0.14em] bg-[var(--accent-tint)] border border-[var(--border)] text-[var(--text-1)]">
      {text}
    </span>
  )
}

function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-3 border-b border-[var(--border)] items-start group">
      <span className="font-display font-bold uppercase text-[9px] tracking-[0.18em] text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors">
        {label}
      </span>
      <div className="font-body text-[12px] text-[var(--text-1)]">
        {children}
      </div>
    </div>
  )
}

// ── Inline editable text field (pricing / hours) ──────────────────────────────
function EditableTextField({
  fieldKey,
  value,
  contextId,
  onSaved,
}: {
  fieldKey:  'pricing' | 'hours'
  value:     string
  contextId: string
  onSaved:   (fieldKey: string, newValue: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [sync,    setSync]    = useState<SyncStatus>(null)

  const startEdit = () => { setDraft(value); setError(''); setEditing(true) }
  const cancel    = () => { setEditing(false); setError('') }

  const save = async () => {
    const trimmed = draft.trim()
    if (trimmed === value) { setEditing(false); return }

    setSaving(true)
    setError('')
    onSaved(fieldKey, trimmed) // optimistic

    try {
      const res = await fetch(`/api/knowledge-context/${contextId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ structured_data: { [fieldKey]: trimmed } }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Save failed')
      }
      setSync('syncing')
      setEditing(false)
      fetch('/api/vapi/sync', { method: 'POST' })
        .then((r) => setSync(r.ok ? 'synced' : 'error'))
        .catch(() => setSync('error'))
        .finally(() => { setTimeout(() => setSync(null), 3000) })
    } catch (err) {
      onSaved(fieldKey, value) // rollback
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          autoFocus
          disabled={saving}
          className="input-field w-full text-[12px] font-body resize-y min-h-[52px]"
          style={{ padding: '6px 8px' }}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-[0.12em] bg-[var(--accent)] text-white border-none rounded cursor-pointer disabled:opacity-50"
          >
            <Check size={10} /> {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={cancel} disabled={saving} className="btn-ghost text-[10px]">
            <X size={10} /> Cancel
          </button>
        </div>
        {error && (
          <p className="text-[10px] text-[var(--danger)] flex items-center gap-1">
            <AlertCircle size={10} /> {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 group/edit">
      <span className="flex-1">
        {value || <span className="text-[var(--text-3)] italic">Not set</span>}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        {sync === 'syncing' && (
          <span className="text-[9px] font-display uppercase tracking-[0.12em] text-[var(--accent)] animate-pulse">Syncing…</span>
        )}
        {sync === 'synced' && (
          <span className="text-[9px] font-display uppercase tracking-[0.12em] text-[var(--live)] flex items-center gap-0.5">
            <CheckCircle2 size={9} /> Synced
          </span>
        )}
        {sync === 'error' && (
          <span className="text-[9px] font-display uppercase tracking-[0.12em] text-[var(--danger)]">Sync failed</span>
        )}
        <button
          onClick={startEdit}
          title={`Edit ${fieldKey}`}
          className="opacity-0 group-hover/edit:opacity-100 flex items-center justify-center w-5 h-5 rounded border border-[var(--border)] text-[var(--text-3)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
          style={{ background: 'transparent', cursor: 'pointer' }}
        >
          <Pencil size={9} />
        </button>
      </div>
    </div>
  )
}

// ── Inline editable services field (tag list → comma CSV input) ───────────────
function EditableServicesField({
  value,
  contextId,
  onSaved,
}: {
  value:     string[]
  contextId: string
  onSaved:   (fieldKey: string, newValue: unknown) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value.join(', '))
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [sync,    setSync]    = useState<SyncStatus>(null)

  const startEdit = () => { setDraft(value.join(', ')); setError(''); setEditing(true) }
  const cancel    = () => { setEditing(false); setError('') }

  const save = async () => {
    const parsed = draft.split(',').map((s) => s.trim()).filter(Boolean)
    if (JSON.stringify(parsed) === JSON.stringify(value)) { setEditing(false); return }

    setSaving(true)
    setError('')
    onSaved('services', parsed) // optimistic

    try {
      const res = await fetch(`/api/knowledge-context/${contextId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ structured_data: { services: parsed } }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Save failed')
      }
      setSync('syncing')
      setEditing(false)
      fetch('/api/vapi/sync', { method: 'POST' })
        .then((r) => setSync(r.ok ? 'synced' : 'error'))
        .catch(() => setSync('error'))
        .finally(() => { setTimeout(() => setSync(null), 3000) })
    } catch (err) {
      onSaved('services', value) // rollback
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          disabled={saving}
          placeholder="Minecraft, Rocket League, Fortnite"
          className="input-field w-full text-[12px] font-body"
          style={{ padding: '6px 8px' }}
        />
        <p className="text-[9px] font-display uppercase tracking-[0.1em] text-[var(--text-3)]">
          Comma-separated list
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-[0.12em] bg-[var(--accent)] text-white border-none rounded cursor-pointer disabled:opacity-50"
          >
            <Check size={10} /> {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={cancel} disabled={saving} className="btn-ghost text-[10px]">
            <X size={10} /> Cancel
          </button>
        </div>
        {error && (
          <p className="text-[10px] text-[var(--danger)] flex items-center gap-1">
            <AlertCircle size={10} /> {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 group/edit">
      <div className="flex flex-wrap gap-[5px] flex-1">
        {value.length > 0
          ? value.map((s, i) => <Tag key={i} text={s} />)
          : <span className="text-[var(--text-3)] italic text-[12px]">Not set</span>
        }
      </div>
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        {sync === 'syncing' && (
          <span className="text-[9px] font-display uppercase tracking-[0.12em] text-[var(--accent)] animate-pulse">Syncing…</span>
        )}
        {sync === 'synced' && (
          <span className="text-[9px] font-display uppercase tracking-[0.12em] text-[var(--live)] flex items-center gap-0.5">
            <CheckCircle2 size={9} /> Synced
          </span>
        )}
        {sync === 'error' && (
          <span className="text-[9px] font-display uppercase tracking-[0.12em] text-[var(--danger)]">Sync failed</span>
        )}
        <button
          onClick={startEdit}
          title="Edit services"
          className="opacity-0 group-hover/edit:opacity-100 flex items-center justify-center w-5 h-5 rounded border border-[var(--border)] text-[var(--text-3)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
          style={{ background: 'transparent', cursor: 'pointer' }}
        >
          <Pencil size={9} />
        </button>
      </div>
    </div>
  )
}

// ── KnowledgeDisplay ──────────────────────────────────────────────────────────
function KnowledgeDisplay({
  data: initialData,
  context,
}: {
  data:    StructuredData
  context: KnowledgeContext
}) {
  const [showFaqs,  setShowFaqs]  = useState(false)
  const [localData, setLocalData] = useState<StructuredData>(initialData)
  const isVision = context.source_url.startsWith('vision-upload:')

  const handleFieldSaved = (fieldKey: string, newValue: unknown) => {
    setLocalData((prev) => ({ ...prev, [fieldKey]: newValue }))
  }

  if (localData.parse_error) {
    return (
      <div className="font-body border border-[var(--warn)] p-4 text-[12px] text-[var(--warn)] bg-[rgba(255,174,0,0.05)]">
        <p className="font-display font-bold uppercase text-[9px] tracking-[0.18em] mb-2">
          Extraction partially succeeded
        </p>
        <pre className="text-[11px] whitespace-pre-wrap font-display overflow-auto max-h-[200px] border-t border-[var(--warn)] pt-2 mt-2">
          {localData.raw_extraction}
        </pre>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Business name + meta */}
      <div className="py-4 border-b-2 border-[var(--accent)] flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display font-bold uppercase text-[16px] tracking-[0.06em] text-[var(--text-1)]">
              {safe(localData.business_name) || 'Unknown'}
            </h3>
            {isVision && (
              <span className="font-display font-bold uppercase flex items-center gap-1 text-[8px] tracking-[0.16em] bg-[var(--accent)] text-white px-2 py-0.5">
                <ImageIcon size={10} /> Vision
              </span>
            )}
          </div>
          {localData.tagline && (
            <p className="font-body text-[13px] text-[var(--accent)] mt-1.5">{safe(localData.tagline)}</p>
          )}
          {localData.description && (
            <p className="font-body text-[13px] text-[var(--text-2)] mt-2 leading-relaxed max-w-[480px]">
              {safe(localData.description)}
            </p>
          )}
        </div>
        <div className="font-body shrink-0 text-right text-[10px] text-[var(--text-3)] bg-[var(--surface-2)] border border-[var(--border)] p-2">
          <p className="font-display uppercase text-[8px] tracking-[0.18em] text-[var(--text-3)]">Extracted</p>
          <p className="text-[var(--accent-2)] mt-0.5 font-display">
            {new Date(context.scraped_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Data rows */}
      <div>
        {/* Services — editable */}
        <DataRow label="Services">
          <EditableServicesField
            value={safeArr(localData.services)}
            contextId={context.id}
            onSaved={handleFieldSaved}
          />
        </DataRow>

        {safeArr(localData.age_groups).length > 0 && (
          <DataRow label="Age Groups">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {safeArr(localData.age_groups).map((a, i) => <Tag key={i} text={a} />)}
            </div>
          </DataRow>
        )}
        {localData.contact_phone && <DataRow label="Phone">{safe(localData.contact_phone)}</DataRow>}
        {localData.contact_email && <DataRow label="Email">{safe(localData.contact_email)}</DataRow>}
        {localData.location      && <DataRow label="Location">{safe(localData.location)}</DataRow>}

        {/* Hours — editable */}
        <DataRow label="Hours">
          <EditableTextField
            fieldKey="hours"
            value={safe(localData.hours)}
            contextId={context.id}
            onSaved={handleFieldSaved}
          />
        </DataRow>

        {/* Pricing — editable */}
        <DataRow label="Pricing">
          <EditableTextField
            fieldKey="pricing"
            value={safe(localData.pricing)}
            contextId={context.id}
            onSaved={handleFieldSaved}
          />
        </DataRow>

        {localData.booking_cta && (
          <DataRow label="Booking CTA">
            <span style={{ color: 'var(--live)' }}>{safe(localData.booking_cta)}</span>
          </DataRow>
        )}
      </div>

      {/* Selling points */}
      {safeArr(localData.key_selling_points).length > 0 && (
        <div className="pt-4">
          <p className="label-sm mb-3">Key Selling Points</p>
          <div className="flex flex-col gap-2">
            {safeArr(localData.key_selling_points).map((p, i) => (
              <div key={i} className="flex gap-2.5 items-start bg-[var(--surface-2)] p-2.5 rounded-md border border-[var(--border)] border-l-2 border-l-[var(--accent)]">
                <CheckCircle2 size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
                <span className="text-[13px] text-[var(--text-2)]">{p}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQs */}
      {Array.isArray(localData.faqs) && localData.faqs.length > 0 && (
        <div className="pt-4">
          <button onClick={() => setShowFaqs(!showFaqs)} className="btn-ghost">
            {showFaqs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showFaqs ? 'Hide' : 'Show'} FAQs ({localData.faqs.length})
          </button>
          {showFaqs && (
            <div className="mt-3 flex flex-col gap-2">
              {localData.faqs.map((faq: unknown, i: number) => {
                const f = faq as Record<string, unknown>
                return (
                  <div key={i} className="bg-[var(--surface-2)] border border-[var(--border)] p-3.5 hover:border-[var(--accent)] transition-colors">
                    <p className="font-display font-bold uppercase text-[10px] tracking-[0.14em] text-[var(--accent)] mb-1.5">
                      Q: {safe(f.question)}
                    </p>
                    <p className="font-body text-[13px] text-[var(--text-2)] border-l border-[var(--accent)] pl-2">
                      {safe(f.answer)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Source card ───────────────────────────────────────────────────────────────
function SourceCard({
  ctx, expanded, onToggle, onDelete, deleting,
}: {
  ctx:      KnowledgeContext
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const isVision = ctx.source_url.startsWith('vision-upload:')
  const d = ctx.structured_data as StructuredData | null
  const businessName = d?.business_name ? safe(d.business_name) : null
  const displayLabel = businessName
    ?? (isVision ? ctx.source_url.replace('vision-upload:', '') : ctx.source_url)

  return (
    <div className="card overflow-hidden animate-[fade-up_0.3s_ease_both]">
      {/* Card header — always visible */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Type badge */}
        <span
          className="font-display font-bold uppercase text-[8px] tracking-[0.14em] px-2 py-1 shrink-0 flex items-center gap-1"
          style={{
            background: isVision ? 'rgba(245,158,11,0.1)' : 'var(--accent-tint)',
            border: `1px solid ${isVision ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
            color: isVision ? 'var(--accent-2)' : 'var(--accent)',
            borderRadius: '4px',
          }}
        >
          {isVision ? <ImageIcon size={9} /> : <Globe size={9} />}
          {isVision ? 'Vision' : 'URL'}
        </span>

        {/* Source label */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--text-1)] truncate">{displayLabel}</p>
          {businessName && (
            <p className="text-[11px] text-[var(--text-3)] truncate mt-0.5">
              {isVision ? ctx.source_url.replace('vision-upload:', '') : ctx.source_url}
            </p>
          )}
        </div>

        {/* Date */}
        <span className="text-[11px] text-[var(--text-3)] shrink-0 hidden sm:block">
          {new Date(ctx.scraped_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onDelete}
            disabled={deleting}
            title="Delete this knowledge source"
            className="flex items-center justify-center w-8 h-8 rounded-md border border-[var(--border)] text-[var(--text-3)] hover:border-[var(--danger)] hover:text-[var(--danger)] transition-all disabled:opacity-40"
            style={{ background: 'transparent', cursor: deleting ? 'not-allowed' : 'pointer' }}
          >
            <Trash2 size={13} />
          </button>
          <button
            onClick={onToggle}
            title={expanded ? 'Collapse' : 'Expand'}
            className="flex items-center justify-center w-8 h-8 rounded-md border border-[var(--border)] text-[var(--text-3)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
            style={{ background: 'transparent', cursor: 'pointer' }}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && ctx.structured_data && (
        <div className="px-5 pb-5 pt-2 border-t border-[var(--border)]">
          <KnowledgeDisplay data={ctx.structured_data as StructuredData} context={ctx} />
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function KnowledgeScraper({
  tenantId,
  initialContexts,
}: {
  tenantId:        string
  initialContexts: KnowledgeContext[]
}) {
  const [tab,        setTab]        = useState<'url' | 'vision'>('url')
  const [url,        setUrl]        = useState('')
  const [loading,    setLoading]    = useState(false)
  const [elapsed,    setElapsed]    = useState(0)
  const [error,      setError]      = useState('')
  const [sources,    setSources]    = useState<KnowledgeContext[]>(initialContexts)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page,       setPage]       = useState(0)
  const [deleting,   setDeleting]   = useState<Set<string>>(new Set())

  const filteredSources = sources.filter((s) =>
    tab === 'vision' ? s.source_url.startsWith('vision-upload:') : !s.source_url.startsWith('vision-upload:')
  )
  const totalPages     = Math.ceil(filteredSources.length / PAGE_SIZE)
  const visibleSources = filteredSources.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function addOrReplace(ctx: KnowledgeContext) {
    setSources((prev) => {
      const idx = prev.findIndex((s) => s.id === ctx.id)
      if (idx >= 0) {
        const next = [...prev]; next[idx] = ctx; return next
      }
      return [ctx, ...prev]
    })
    setPage(0)
    setExpandedId(ctx.id)
  }

  async function deleteSource(id: string) {
    setDeleting((prev) => { const n = new Set(prev); n.add(id); return n })
    try {
      await fetch(`/api/knowledge-context/${id}`, { method: 'DELETE' })
      setSources((prev) => prev.filter((s) => s.id !== id))
      if (expandedId === id) setExpandedId(null)
      setPage((p) => {
        const newTotal = Math.ceil((sources.length - 1) / PAGE_SIZE)
        return p >= newTotal ? Math.max(0, newTotal - 1) : p
      })
    } finally {
      setDeleting((prev) => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const scrape = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError('')
    const start      = Date.now()
    const controller = new AbortController()
    const timer      = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500)

    try {
      const res  = await fetch('/api/scrape', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: url.trim(), tenant_id: tenantId }),
        signal:  controller.signal,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Scrape failed')
      addOrReplace(json.knowledge_context)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Failed to scrape')
      }
    } finally {
      clearInterval(timer)
      setLoading(false)
      setElapsed(0)
    }
  }

  return (
    <div className="flex flex-col gap-4 relative z-10 w-full max-w-4xl mx-auto">

      {/* ── Scraper input card ─────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-[var(--border)] bg-[var(--surface-2)]">
          {([
            { key: 'url'    as const, label: 'URL Scraper',   icon: Globe     },
            { key: 'vision' as const, label: 'Vision Upload', icon: ImageIcon },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setTab(key); setPage(0) }}
              className={`flex items-center gap-2 px-5 py-3.5 text-[12px] font-semibold border-none border-b-2 mb-[-1px] cursor-pointer transition-all duration-150 ${
                tab === key
                  ? 'bg-[var(--surface)] text-[var(--accent)] border-b-[var(--accent)]'
                  : 'bg-transparent text-[var(--text-3)] border-b-transparent hover:text-[var(--text-2)] hover:bg-[var(--surface)]'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="p-6 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-[var(--accent)] rounded-full blur-[120px] opacity-[0.05] pointer-events-none" />

          {tab === 'url' ? (
            <>
              <div className="flex items-center gap-4 mb-5 relative z-10">
                <div className="w-10 h-10 bg-[var(--accent)] flex items-center justify-center shrink-0 rounded-md">
                  <Globe size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-display font-bold uppercase text-[13px] tracking-[0.12em] text-[var(--text-1)]">
                    Instant Knowledge Loop
                  </p>
                  <p className="font-body text-[12px] text-[var(--text-3)] mt-1">
                    Scrape a URL or @Instagram handle — extracts structured knowledge in &lt;30s
                  </p>
                </div>
              </div>

              <form onSubmit={scrape} className="flex flex-col md:flex-row gap-3 relative z-10">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="pizzahut.com or @xpleaguefrisco"
                  required
                  className="input-field flex-1"
                />
                <button type="submit" disabled={loading} className="btn-primary shrink-0 whitespace-nowrap h-[46px] min-w-[180px]">
                  {loading ? (
                    <div className="flex items-center gap-1">
                      <span className="inline-block w-1 h-2.5 bg-white animate-[blink-cursor_0.7s_0s_steps(1)_infinite]" />
                      <span className="inline-block w-1 h-2.5 bg-white animate-[blink-cursor_0.7s_0.2s_steps(1)_infinite]" />
                      <span className="inline-block w-1 h-2.5 bg-white animate-[blink-cursor_0.7s_0.4s_steps(1)_infinite]" />
                      <span className="ml-1">{elapsed}s</span>
                    </div>
                  ) : (
                    <><RefreshCw size={14} className="animate-[spin_4s_linear_infinite]" /> Scrape &amp; Extract</>
                  )}
                </button>
              </form>

              {loading && (
                <div className="font-body mt-4 flex items-center gap-2.5 text-[12px] text-[var(--accent)]">
                  <div className="flex gap-1 items-center">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className={`inline-block w-1.5 h-1.5 bg-[var(--accent)] animate-[blink-cursor_0.8s_${i * 0.25}s_steps(1)_infinite]`} />
                    ))}
                  </div>
                  Fetching page → stripping HTML → extracting with AI…
                </div>
              )}

              {error && (
                <div className="mt-4 flex items-start gap-2.5 border border-[var(--danger)] bg-[var(--surface-2)] p-3 rounded-md text-[12px] text-[var(--danger)]">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-5 relative z-10">
                <div className="w-10 h-10 bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center shrink-0 rounded-md">
                  <ImageIcon size={18} className="text-[var(--accent-2)]" />
                </div>
                <div>
                  <p className="font-display font-bold uppercase text-[13px] tracking-[0.12em] text-[var(--text-1)]">
                    Vision AI Extraction
                  </p>
                  <p className="font-body text-[12px] text-[var(--text-3)] mt-1">
                    Upload a flyer, price list, or schedule — Groq vision reads it for you
                  </p>
                </div>
              </div>
              <ImageUploader tenantId={tenantId} onSuccess={(ctx) => addOrReplace(ctx)} />
            </>
          )}
        </div>
      </div>

      {/* ── Knowledge sources list ─────────────────────────────────────── */}
      {filteredSources.length === 0 ? (
        <div className="text-center py-16 px-4 card">
          {tab === 'vision'
            ? <ImageIcon size={40} className="text-[var(--border-strong)] mx-auto mb-4 opacity-50" />
            : <Globe    size={40} className="text-[var(--border-strong)] mx-auto mb-4 opacity-50" />}
          <p className="font-body text-[14px] text-[var(--text-3)] max-w-sm mx-auto">
            {tab === 'vision'
              ? 'No images uploaded yet — upload a flyer or price list above'
              : 'No URLs scraped yet — enter a URL above to extract knowledge'}
          </p>
          {tab === 'url' && (
            <p className="font-display uppercase text-[10px] tracking-[0.1em] text-[var(--accent-2)] mt-3">
              Try: https://xpleague.com
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Header row */}
          <div className="flex items-center justify-between px-1">
            <p className="font-display font-bold uppercase text-[10px] tracking-[0.16em] text-[var(--text-3)]">
              {tab === 'vision' ? 'Vision Uploads' : 'URL Sources'} — {filteredSources.length} total
            </p>
            <p className="text-[11px] text-[var(--text-3)]">
              Used by AI Playground &amp; live Vapi calls
            </p>
          </div>

          {/* Source cards */}
          <div className="flex flex-col gap-2">
            {visibleSources.map((ctx) => (
              <SourceCard
                key={ctx.id}
                ctx={ctx}
                expanded={expandedId === ctx.id}
                onToggle={() => setExpandedId((id) => (id === ctx.id ? null : ctx.id))}
                onDelete={() => deleteSource(ctx.id)}
                deleting={deleting.has(ctx.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md border border-[var(--border)] text-[var(--text-2)] disabled:opacity-30 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
                style={{ background: 'transparent', cursor: page === 0 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={13} /> Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className="w-7 h-7 text-[11px] font-medium rounded-md border transition-all"
                    style={{
                      background: page === i ? 'var(--accent)' : 'transparent',
                      border: `1px solid ${page === i ? 'var(--accent)' : 'var(--border)'}`,
                      color: page === i ? 'white' : 'var(--text-3)',
                      cursor: 'pointer',
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md border border-[var(--border)] text-[var(--text-2)] disabled:opacity-30 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
                style={{ background: 'transparent', cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer' }}
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
