'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useRealtimeLeads, type Lead } from '@/hooks/useRealtimeLeads'
import {
  Users, Phone, Calendar, Target, Zap, ChevronDown, Download,
  Play, PhoneCall, X, MessageSquare, Clock, FileText, CheckCircle,
  AlertCircle, Loader2,
} from 'lucide-react'

/* ── Outcome config ─────────────────────────────────────────────────────────── */

const OUTCOME_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  booked:               { bg: 'var(--live)',    color: '#fff',            label: 'BOOKED' },
  interested:           { bg: 'var(--accent)',  color: '#fff',            label: 'INTERESTED' },
  'not-interested':     { bg: 'var(--danger)',  color: '#fff',            label: 'DECLINED' },
  'callback-requested': { bg: 'var(--warn)',    color: 'var(--bg)',       label: 'CALLBACK' },
  unknown:              { bg: 'transparent',    color: 'var(--text-2)',   label: 'UNKNOWN' },
}

const OUTCOME_OPTIONS = Object.entries(OUTCOME_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }))

/* ── Stat cards config ──────────────────────────────────────────────────────── */

const STAT_CONFIG = [
  { key: 'total',      label: 'Total Leads', icon: Users,    getVal: (s: ReturnType<typeof buildStats>) => s.total },
  { key: 'booked',     label: 'Booked',      icon: Calendar, getVal: (s: ReturnType<typeof buildStats>) => s.booked },
  { key: 'interested', label: 'Interested',  icon: Target,   getVal: (s: ReturnType<typeof buildStats>) => s.interested },
  { key: 'callbacks',  label: 'Callbacks',   icon: Phone,    getVal: (s: ReturnType<typeof buildStats>) => s.callbacks },
]

function buildStats(leads: Lead[]) {
  return {
    total:      leads.length,
    booked:     leads.filter((l) => l.call_outcome === 'booked').length,
    interested: leads.filter((l) => l.call_outcome === 'interested').length,
    callbacks:  leads.filter((l) => l.call_outcome === 'callback-requested').length,
  }
}

function exportCsv(leads: Lead[]) {
  const header = 'Name,Phone,Interest,Outcome,Booking Slot,Date'
  const rows = leads.map((l) =>
    [l.caller_name ?? '', l.caller_phone ?? '', l.core_interest ?? '', l.call_outcome, l.booking_slot ?? '',
      new Date(l.parsed_at).toLocaleString('en-GB')]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  )
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: `leads-${new Date().toISOString().slice(0, 10)}.csv` })
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}

/* ── Transcript drawer ──────────────────────────────────────────────────────── */

type CallbackState = 'idle' | 'placing' | 'placed' | 'error'

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60)
  const s = String(secs % 60).padStart(2, '0')
  return `${m}:${s}`
}

function parseTranscriptLines(text: string) {
  return text.split('\n').filter(l => l.trim()).map((line, i) => {
    const aiMatch   = /^(AI|Assistant|Sage|Bot):\s*/i.exec(line)
    const userMatch = /^(User|Human|Caller):\s*/i.exec(line)
    const speaker   = aiMatch ? 'ai' : userMatch ? 'user' : 'raw'
    const content   = line.replace(/^(AI|Assistant|Sage|Bot|User|Human|Caller):\s*/i, '').trim()
    return { id: i, speaker, content: content || line }
  })
}

function TranscriptDrawer({
  lead: initialLead,
  onClose,
  onOutcomeChange,
}: {
  lead: Lead
  onClose: () => void
  onOutcomeChange: (id: string, outcome: string) => void
}) {
  const [lead, setLead] = useState<Lead>(initialLead)
  const [loadingTranscript, setLoadingTranscript] = useState(!initialLead.call_logs)
  const [outcomeUpdating, setOutcomeUpdating] = useState(false)
  const [callbackState, setCallbackState]     = useState<CallbackState>('idle')
  const [callbackError, setCallbackError]     = useState('')
  const [visible, setVisible]                 = useState(false)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  // Fetch transcript on first open if not already loaded
  useEffect(() => {
    if (lead.call_logs !== undefined) { setLoadingTranscript(false); return }
    setLoadingTranscript(true)
    fetch(`/api/leads/${lead.id}`)
      .then(r => r.json())
      .then((d: { lead?: Lead }) => { if (d.lead) setLead(d.lead) })
      .catch(() => {/* show empty state */})
      .finally(() => setLoadingTranscript(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 220)
  }

  const handleOutcomeChange = async (newOutcome: string) => {
    setOutcomeUpdating(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ call_outcome: newOutcome }),
      })
      if (res.ok) {
        setLead(prev => ({ ...prev, call_outcome: newOutcome }))
        onOutcomeChange(lead.id, newOutcome)
      }
    } finally {
      setOutcomeUpdating(false)
    }
  }

  const handleCallback = async () => {
    if (!lead.caller_phone) return
    setCallbackState('placing')
    setCallbackError('')
    try {
      const res = await fetch('/api/vapi/outbound', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          toNumber: lead.caller_phone,
          toName:   lead.caller_name  ?? undefined,
          interest: lead.core_interest ?? undefined,
        }),
      })
      if (res.ok) {
        setCallbackState('placed')
      } else {
        const d = await res.json() as { error?: string }
        setCallbackError(d.error ?? 'Call failed')
        setCallbackState('error')
      }
    } catch {
      setCallbackState('error')
      setCallbackError('Network error — check connection')
    }
  }

  const cfg          = OUTCOME_CONFIG[lead.call_outcome] ?? OUTCOME_CONFIG.unknown
  const transcript   = lead.call_logs?.full_transcript ?? null
  const recordingUrl = lead.call_logs?.recording_url   ?? null
  const duration     = lead.call_logs?.duration_seconds ?? null
  const lines        = transcript ? parseTranscriptLines(transcript) : null

  return (
    <div className="fixed inset-0 z-50 flex" style={{ backdropFilter: 'blur(2px)' }}>
      {/* Overlay */}
      <div
        className="flex-1 bg-black/40 transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />
      {/* Panel */}
      <div
        className="w-[520px] max-w-full bg-[var(--bg)] border-l border-[var(--border)] flex flex-col h-full shadow-2xl"
        style={{
          transition: 'transform 0.22s cubic-bezier(0.16,1,0.3,1), opacity 0.22s ease',
          transform:  visible ? 'translateX(0)' : 'translateX(40px)',
          opacity:    visible ? 1 : 0,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between p-5 border-b border-[var(--border)] bg-[var(--surface-2)]">
          <div className="flex-1 min-w-0 pr-3">
            <p className="font-display font-bold uppercase text-[9px] tracking-[0.22em] text-[var(--accent)] mb-1.5">Lead Record</p>
            <h2 className="font-display font-bold text-[17px] text-[var(--text-1)] tracking-tight truncate">
              {lead.caller_name ?? 'Unknown Caller'}
            </h2>
            <p className="font-body text-[12px] text-[var(--text-3)] mt-0.5 tracking-[0.04em]">
              {lead.caller_phone ?? 'No phone number'}
            </p>
          </div>
          <button onClick={handleClose} className="btn-ghost p-1.5 flex-shrink-0" title="Close">
            <X size={15} />
          </button>
        </div>

        {/* ── Meta strip ── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 border-b border-[var(--border)] bg-[var(--surface)]">
          {duration !== null && (
            <div className="flex items-center gap-1.5">
              <Clock size={10} className="text-[var(--text-3)]" />
              <span className="font-body text-[11px] text-[var(--text-2)]">{formatDuration(duration)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar size={10} className="text-[var(--text-3)]" />
            <span className="font-body text-[11px] text-[var(--text-2)]">
              {new Date(lead.parsed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {lead.core_interest && (
            <div className="flex items-center gap-1.5 ml-auto">
              <MessageSquare size={10} className="text-[var(--text-3)]" />
              <span className="font-body text-[11px] text-[var(--text-2)] truncate max-w-[180px]">{lead.core_interest}</span>
            </div>
          )}
        </div>

        {/* ── Outcome + Callback ── */}
        <div className="flex items-end gap-3 px-5 py-4 border-b border-[var(--border)]">
          {/* Outcome selector */}
          <div className="flex-1">
            <p className="font-display font-bold uppercase text-[9px] tracking-[0.18em] text-[var(--text-3)] mb-2">Call Outcome</p>
            <div className="relative">
              <select
                value={lead.call_outcome}
                onChange={e => handleOutcomeChange(e.target.value)}
                disabled={outcomeUpdating}
                className="w-full appearance-none font-display font-bold uppercase text-[11px] tracking-[0.1em] bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] px-3 py-2 pr-8 cursor-pointer hover:border-[var(--accent)] transition-colors disabled:opacity-50 rounded-md"
              >
                {OUTCOME_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
            </div>
          </div>

          {/* Outcome badge */}
          <div
            className="font-display font-bold uppercase text-[10px] tracking-[0.14em] px-3 py-2 rounded whitespace-nowrap flex-shrink-0"
            style={{ background: cfg.bg, color: cfg.color, border: lead.call_outcome === 'unknown' ? '1px solid var(--border)' : 'none' }}
          >
            {cfg.label}
          </div>

          {/* Callback button */}
          {lead.caller_phone && (
            <button
              onClick={handleCallback}
              disabled={callbackState === 'placing' || callbackState === 'placed'}
              title={callbackState === 'placed' ? 'Call placed' : 'Call this lead back'}
              className={`flex items-center gap-2 px-3 py-2 border font-display font-bold uppercase text-[10px] tracking-[0.1em] transition-all rounded flex-shrink-0 ${
                callbackState === 'placed'  ? 'border-[var(--live)] text-[var(--live)] bg-[var(--live)]/10' :
                callbackState === 'error'   ? 'border-[var(--danger)] text-[var(--danger)]' :
                callbackState === 'placing' ? 'border-[var(--accent)] text-[var(--accent)] opacity-70' :
                                              'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
              }`}
            >
              {callbackState === 'placing' ? <Loader2 size={12} className="animate-spin" /> :
               callbackState === 'placed'  ? <CheckCircle size={12} /> :
               callbackState === 'error'   ? <AlertCircle size={12} /> :
               <PhoneCall size={12} />}
              {callbackState === 'placed'  ? 'Called' :
               callbackState === 'placing' ? 'Calling' :
               callbackState === 'error'   ? 'Failed' : 'Call Back'}
            </button>
          )}
        </div>

        {callbackState === 'error' && callbackError && (
          <div className="px-5 py-2 bg-[var(--danger)]/10 border-b border-[var(--danger)]/30">
            <p className="font-body text-[11px] text-[var(--danger)]">{callbackError}</p>
          </div>
        )}

        {/* ── Recording ── */}
        {recordingUrl && (
          <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
            <p className="font-display font-bold uppercase text-[9px] tracking-[0.18em] text-[var(--text-3)] mb-2">Recording</p>
            <audio
              controls
              src={recordingUrl}
              className="w-full"
              style={{ height: '32px', filter: 'none' }}
            />
          </div>
        )}

        {/* ── Transcript ── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] sticky top-0 z-10 flex items-center gap-2">
            <FileText size={12} className="text-[var(--text-3)]" />
            <p className="font-display font-bold uppercase text-[9px] tracking-[0.18em] text-[var(--text-3)]">
              Full Transcript
            </p>
            {loadingTranscript && <Loader2 size={10} className="animate-spin text-[var(--text-3)] ml-auto" />}
          </div>

          {loadingTranscript ? (
            <div className="flex items-center justify-center py-12 gap-2 text-[var(--text-3)]">
              <Loader2 size={14} className="animate-spin" />
              <span className="font-body text-[12px]">Loading transcript…</span>
            </div>
          ) : !transcript ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
              <MessageSquare size={22} className="text-[var(--text-3)] opacity-40" />
              <p className="font-body text-[12px] text-[var(--text-3)]">No transcript available for this call</p>
            </div>
          ) : lines ? (
            <div className="p-5 space-y-2.5">
              {lines.map(({ id, speaker, content }) => (
                <div key={id} className={`flex gap-2 ${speaker === 'user' ? 'justify-end' : ''}`}>
                  {speaker === 'ai' && (
                    <div className="w-5 h-5 rounded bg-[var(--accent)]/15 border border-[var(--accent)]/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="font-display font-bold text-[7px] text-[var(--accent)]">AI</span>
                    </div>
                  )}
                  <div className={`max-w-[88%] px-3 py-2 rounded ${
                    speaker === 'ai'   ? 'bg-[var(--surface-2)] border border-[var(--border)]' :
                    speaker === 'user' ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20' :
                                        'bg-transparent'
                  }`}>
                    <p className="font-body text-[12px] leading-relaxed text-[var(--text-1)]">{content}</p>
                  </div>
                  {speaker === 'user' && (
                    <div className="w-5 h-5 rounded bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="font-display font-bold text-[7px] text-[var(--text-3)]">U</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <pre className="p-5 font-body text-[12px] text-[var(--text-2)] leading-relaxed whitespace-pre-wrap">
              {transcript}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Main dashboard ─────────────────────────────────────────────────────────── */

export default function LeadsDashboard({
  tenantId,
  initialLeads,
}: {
  tenantId: string
  initialLeads: Lead[]
}) {
  const { leads: rtLeads, flash, newCount } = useRealtimeLeads(tenantId, initialLeads)

  // Local mutable copy so outcome updates reflect instantly
  const [leads, setLeads] = useState<Lead[]>(rtLeads)
  useEffect(() => { setLeads(rtLeads) }, [rtLeads])

  const handleOutcomeChange = useCallback((id: string, outcome: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, call_outcome: outcome } : l))
  }, [])

  const stats = buildStats(leads)

  const [extraLeads,  setExtraLeads]  = useState<Lead[]>([])
  const [hasMore,     setHasMore]     = useState(initialLeads.length === 25)
  const [cursor,      setCursor]      = useState<string | null>(
    initialLeads.length > 0 ? initialLeads[initialLeads.length - 1]?.parsed_at ?? null : null,
  )
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedLead, setSelectedLead]   = useState<Lead | null>(null)
  const [selectedIds,  setSelectedIds]    = useState<Set<string>>(new Set())
  const [callAllState, setCallAllState]   = useState<'idle' | 'running' | 'done'>('idle')
  const [callAllProg,  setCallAllProg]    = useState({ done: 0, total: 0, errors: 0 })
  const loadingMoreRef = useRef(false)

  const allLeads = useMemo(() => [...leads, ...extraLeads], [leads, extraLeads])

  const leadsWithPhone = allLeads.filter(l => l.caller_phone)
  const isAllSelected  = leadsWithPhone.length > 0 && leadsWithPhone.every(l => selectedIds.has(l.id))

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(leadsWithPhone.map(l => l.id)))
    }
  }, [isAllSelected, leadsWithPhone])

  const callAll = useCallback(async () => {
    const targets = allLeads.filter(l => selectedIds.has(l.id) && l.caller_phone)
    if (!targets.length) return
    setCallAllState('running')
    setCallAllProg({ done: 0, total: targets.length, errors: 0 })
    let errors = 0
    for (const lead of targets) {
      try {
        const res = await fetch('/api/vapi/outbound', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ toNumber: lead.caller_phone, toName: lead.caller_name ?? undefined, interest: lead.core_interest ?? undefined }),
        })
        if (!res.ok) errors++
      } catch { errors++ }
      setCallAllProg(prev => ({ ...prev, done: prev.done + 1, errors }))
      await new Promise(r => setTimeout(r, 800))
    }
    setCallAllState('done')
    setSelectedIds(new Set())
  }, [allLeads, selectedIds])

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const res  = await fetch(`/api/leads?cursor=${encodeURIComponent(cursor)}`)
      const json = await res.json() as { leads: Lead[]; hasMore: boolean; nextCursor: string | null }
      setExtraLeads((prev) => [...prev, ...json.leads])
      setHasMore(json.hasMore)
      setCursor(json.nextCursor)
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [cursor])

  return (
    <div className="space-y-5">

      {/* ── Real-time flash banner ─────────────────────────────────────────── */}
      {flash && (
        <div className="flex items-center gap-3 px-4 py-3 border-l-4 border-[var(--accent)] bg-[var(--accent-tint)] animate-[flash-in_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards] shadow-[0_0_15px_rgba(232,93,63,0.2)]">
          <Zap size={16} className="text-[var(--accent)] shrink-0 animate-pulse" />
          <span className="font-display font-bold uppercase text-[10px] tracking-[0.18em] text-[var(--accent)]">
            ↑ Incoming lead — table updated live
          </span>
          <div className="ml-auto flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ display: 'inline-block', width: '4px', height: '10px', background: 'var(--accent)',
                animation: `voice-bar 0.4s ${i * 0.12}s ease-in-out infinite alternate`, transformOrigin: 'bottom' }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CONFIG.map(({ key, label, icon: Icon, getVal }, idx) => {
          const value = getVal(stats)
          const pct   = key !== 'total' && stats.total > 0 ? Math.round((value / stats.total) * 100) : null
          return (
            <div key={key} className="card p-5 flex flex-col relative overflow-hidden group" style={{ animation: `fade-up 0.4s ${idx * 60}ms both` }}>
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-20 transition-opacity duration-300">
                <Icon size={80} className="text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors" />
              </div>
              <div className="flex items-start justify-between mb-3 relative z-10">
                <Icon size={16} className="text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors" />
                {pct !== null && <span className="font-display font-bold text-[10px] tracking-[0.12em] text-[var(--accent-2)]">{pct}%</span>}
              </div>
              <p className="font-display font-bold leading-none tracking-tighter text-4xl text-[var(--text-1)] relative z-10">{value}</p>
              <p className="font-display font-bold uppercase mt-2 text-[10px] tracking-[0.18em] text-[var(--text-3)] group-hover:text-[var(--text-1)] transition-colors relative z-10">{label}</p>
            </div>
          )
        })}
      </div>

      {/* ── Lead registry table ───────────────────────────────────────────── */}
      <div className={`card overflow-hidden transition-all duration-400 ${flash ? 'border-[var(--accent)] shadow-[0_0_20px_rgba(232,93,63,0.3)]' : ''}`}>
        {/* Table header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
          <div className="flex items-center gap-3">
            <h3 className="font-display font-bold uppercase text-[11px] tracking-[0.2em] text-[var(--accent)]">Lead Registry</h3>
            <div className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-[var(--live)] rounded-full animate-[live-dot_1.6s_ease-in-out_infinite] shadow-[0_0_5px_var(--live)]" />
              <span className="font-display font-bold uppercase text-[9px] tracking-[0.18em] text-[var(--live)]">Live</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display uppercase text-[10px] tracking-[0.1em] text-[var(--text-3)]">
              {allLeads.length} records{newCount > 0 && ` · +${newCount} new`}
            </span>
            {allLeads.length > 0 && (
              <button onClick={() => exportCsv(allLeads)} className="btn-ghost py-1.5 px-3 text-[9px]">
                <Download size={12} /> Export CSV
              </button>
            )}
          </div>
        </div>

        {/* ── Bulk action toolbar ─────────────────────────────────────────── */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-5 py-2.5 bg-[var(--accent-tint)] border-b border-[var(--accent)]/30" style={{ animation: 'fade-up 0.2s ease both' }}>
            <span className="font-display font-bold uppercase text-[10px] tracking-widest text-[var(--accent)]">
              {selectedIds.size} selected
            </span>
            <div className="flex-1" />
            {callAllState === 'running' ? (
              <span className="font-display text-[10px] text-[var(--text-2)] flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                Calling {callAllProg.done}/{callAllProg.total}…
              </span>
            ) : callAllState === 'done' ? (
              <span className="font-display font-bold uppercase text-[10px] tracking-widest text-[var(--live)] flex items-center gap-1.5">
                <CheckCircle size={12} />
                Done{callAllProg.errors > 0 ? ` · ${callAllProg.errors} failed` : ' · all placed'}
              </span>
            ) : (
              <button onClick={callAll}
                className="btn-primary py-1.5 px-4 text-[10px]">
                <PhoneCall size={12} /> Call All ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => { setSelectedIds(new Set()); setCallAllState('idle') }}
              className="btn-ghost py-1 px-2 text-[9px]">
              <X size={11} /> Clear
            </button>
          </div>
        )}

        {allLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-dot-pattern opacity-50 pointer-events-none" />
            <div className="relative z-10 flex items-center justify-center w-14 h-14 border border-[var(--border)]">
              <Users size={24} className="text-[var(--text-3)]" />
            </div>
            <div className="text-center relative z-10">
              <p className="font-display font-bold uppercase text-[12px] tracking-[0.2em] text-[var(--text-2)]">No leads yet</p>
              <p className="font-body text-center max-w-xs text-[12px] text-[var(--text-3)] mt-2 leading-relaxed">
                Leads appear within 60s of each call via Vapi webhook.<br />
                Configure your assistant to start capturing leads.
              </p>
            </div>
            <a href="/voice" className="btn-ghost relative z-10 mt-1">
              <Phone size={12} /> Configure Voice Agent
            </a>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleAll}
                        className="w-3.5 h-3.5 accent-[var(--accent)] cursor-pointer"
                        title={isAllSelected ? 'Deselect all' : 'Select all with phone'}
                      />
                    </th>
                    {['Name', 'Phone', 'Interest', 'Outcome', 'Date', 'Actions'].map((h) => (
                      <th key={h} className="text-left font-display font-bold uppercase px-5 py-3 text-[10px] tracking-[0.18em] text-[var(--text-3)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allLeads.map((lead, idx) => {
                    const isNew = idx === 0 && flash
                    const cfg   = OUTCOME_CONFIG[lead.call_outcome] ?? OUTCOME_CONFIG.unknown
                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className={`border-b border-[var(--border)] cursor-pointer transition-all duration-200 hover:bg-[var(--accent-tint)] group ${
                          selectedIds.has(lead.id) ? 'bg-[var(--accent-tint)]/60' :
                          isNew ? 'border-l-4 border-l-[var(--accent)] bg-[var(--accent-tint)] animate-[fade-up_0.3s_ease_both]' : 'border-l-4 border-l-transparent'
                        }`}
                      >
                        <td className="px-4 py-3.5 w-10" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(lead.id)}
                            onChange={() => toggleSelect(lead.id)}
                            disabled={!lead.caller_phone}
                            className="w-3.5 h-3.5 accent-[var(--accent)] cursor-pointer disabled:opacity-30"
                          />
                        </td>
                        <td className="px-5 py-3.5 font-display font-semibold text-[13px] text-[var(--text-1)] group-hover:text-[var(--accent)] transition-colors">
                          {lead.caller_name || <span className="text-[var(--text-3)] italic font-body text-[12px]">Unknown</span>}
                        </td>
                        <td className="px-5 py-3.5 font-body text-[12px] text-[var(--text-2)] tracking-[0.04em]">
                          {lead.caller_phone || '—'}
                        </td>
                        <td className="px-5 py-3.5 font-body text-[12px] text-[var(--text-2)] max-w-[180px]">
                          <span className="truncate block">{lead.core_interest || '—'}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className="font-display font-bold uppercase inline-block px-2 py-0.5 text-[9px] tracking-[0.14em] rounded"
                            style={{ background: cfg.bg, color: cfg.color, border: lead.call_outcome === 'unknown' ? '1px solid var(--border)' : 'none' }}
                          >
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-body text-[12px] text-[var(--text-3)] whitespace-nowrap">
                          {new Date(lead.parsed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedLead(lead) }}
                              title="View transcript"
                              className="inline-flex items-center gap-1 font-display font-bold uppercase text-[9px] tracking-[0.12em] text-[var(--text-3)] hover:text-[var(--accent)] transition-colors"
                            >
                              <FileText size={11} /> Transcript
                            </button>
                            {lead.call_logs?.recording_url && (
                              <a
                                href={lead.call_logs.recording_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                title="Play recording"
                                className="inline-flex items-center gap-1 font-display font-bold uppercase text-[9px] tracking-[0.12em] text-[var(--text-3)] hover:text-[var(--live)] transition-colors"
                              >
                                <Play size={11} /> Play
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Load more ──────────────────────────────────────────────── */}
            {hasMore && (
              <div className="flex items-center justify-center py-4 border-t border-[var(--border)] bg-[var(--surface-2)]">
                <button onClick={loadMore} disabled={loadingMore} className="btn-ghost py-2 px-6">
                  {loadingMore ? (
                    <><Loader2 size={13} className="animate-spin" /> Loading</>
                  ) : (
                    <><ChevronDown size={13} /> Load more leads</>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Transcript Drawer ─────────────────────────────────────────────── */}
      {selectedLead && (
        <TranscriptDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onOutcomeChange={handleOutcomeChange}
        />
      )}
    </div>
  )
}
