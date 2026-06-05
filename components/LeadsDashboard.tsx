'use client'

import { useState, useCallback, useRef } from 'react'
import { useRealtimeLeads, type Lead } from '@/hooks/useRealtimeLeads'
import { Users, Phone, Calendar, Target, Zap, ChevronDown, Download, Play, Link as LinkIcon } from 'lucide-react'

const OUTCOME_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  booked:               { bg: 'var(--live)',    color: 'var(--bg)',    label: 'BOOKED' },
  interested:           { bg: 'var(--accent)',  color: 'var(--bg)',    label: 'INTERESTED' },
  'not-interested':     { bg: 'var(--danger)',  color: '#fff',         label: 'DECLINED' },
  'callback-requested': { bg: 'var(--warn)',    color: 'var(--bg)',    label: 'CALLBACK' },
  unknown:              { bg: 'transparent',    color: 'var(--text-2)', label: 'UNKNOWN' },
}

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
    [
      l.caller_name ?? '',
      l.caller_phone ?? '',
      l.core_interest ?? '',
      l.call_outcome,
      l.booking_slot ?? '',
      new Date(l.parsed_at).toLocaleString('en-GB'),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  )
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: `leads-${new Date().toISOString().slice(0, 10)}.csv` })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function LeadsDashboard({
  tenantId,
  initialLeads,
}: {
  tenantId: string
  initialLeads: Lead[]
}) {
  const { leads, flash, newCount } = useRealtimeLeads(tenantId, initialLeads)
  const stats = buildStats(leads)

  const [extraLeads,  setExtraLeads]  = useState<Lead[]>([])
  const [hasMore,     setHasMore]     = useState(initialLeads.length === 25)
  const [cursor,      setCursor]      = useState<string | null>(
    initialLeads.length > 0 ? initialLeads[initialLeads.length - 1]?.parsed_at ?? null : null
  )
  const [loadingMore, setLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false) // ref guard prevents stale-closure race on concurrent clicks

  const allLeads = [...leads, ...extraLeads]

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
        <div className="flex items-center gap-3 px-4 py-3 border-l-4 border-[var(--accent)] bg-[var(--accent-tint)] animate-[flash-in_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards] shadow-[0_0_15px_rgba(255,0,127,0.3)]">
          <Zap size={16} className="text-[var(--accent)] shrink-0 animate-pulse" />
          <span className="font-display font-bold uppercase text-[10px] tracking-[0.18em] text-[var(--accent)] animate-[glitch-flicker_0.5s_0.35s_ease_forwards] glow-text">
            ↑ Incoming lead — table updated live
          </span>
          <div className="ml-auto flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block', width: '4px', height: '10px',
                  background: 'var(--accent)',
                  animation: `voice-bar 0.4s ${i * 0.12}s ease-in-out infinite alternate`,
                  transformOrigin: 'bottom',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CONFIG.map(({ key, label, icon: Icon, getVal }, idx) => {
          const value = getVal(stats)
          const pct = key !== 'total' && stats.total > 0 ? Math.round((value / stats.total) * 100) : null
          return (
            <div key={key} className="card p-5 flex flex-col relative overflow-hidden group" style={{ animation: `fade-up 0.4s ${idx * 60}ms both` }}>
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-20 transition-opacity duration-300">
                <Icon size={80} className="text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors" />
              </div>
              <div className="flex items-start justify-between mb-3 relative z-10">
                <Icon size={16} className="text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors" />
                {pct !== null && (
                  <span className="font-display font-bold text-[10px] tracking-[0.12em] text-[var(--accent-2)]">
                    {pct}%
                  </span>
                )}
              </div>
              <p className="font-display font-bold leading-none tracking-tighter text-4xl text-[var(--text-1)] relative z-10">{value}</p>
              <p className="font-display font-bold uppercase mt-2 text-[10px] tracking-[0.18em] text-[var(--text-3)] group-hover:text-[var(--text-1)] transition-colors relative z-10">
                {label}
              </p>
            </div>
          )
        })}
      </div>

      {/* ── Lead registry table ───────────────────────────────────────────── */}
      <div className={`card overflow-hidden transition-all duration-400 ${flash ? 'border-[var(--accent)] shadow-[0_0_20px_rgba(255,0,127,0.4)]' : ''}`}>
        {/* Table header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
          <div className="flex items-center gap-3">
            <h3 className="font-display font-bold uppercase text-[11px] tracking-[0.2em] text-[var(--accent)]">
              Lead Registry
            </h3>
            <div className="flex items-center gap-1.5 bg-[rgba(11,13,23,0.5)] border border-[var(--border)] px-2 py-1">
              <span className="w-1.5 h-1.5 bg-[var(--live)] rounded-full animate-[live-dot_1.6s_ease-in-out_infinite] shadow-[0_0_5px_var(--live)]" />
              <span className="font-display font-bold uppercase text-[9px] tracking-[0.18em] text-[var(--live)]">Live</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display uppercase text-[10px] tracking-[0.1em] text-[var(--text-3)]">
              {allLeads.length} records{newCount > 0 && ` · +${newCount} new`}
            </span>
            {allLeads.length > 0 && (
              <button
                onClick={() => exportCsv(allLeads)}
                className="btn-ghost py-1.5 px-3 text-[9px]"
                title="Export all visible leads as CSV"
              >
                <Download size={12} />
                Export CSV
              </button>
            )}
          </div>
        </div>

        {allLeads.length === 0 ? (
          /* ── Empty state with CTA ───────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-16 gap-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-dot-pattern opacity-50 pointer-events-none" />
            <div className="relative z-10 flex items-center justify-center w-14 h-14 border border-[var(--border)] shadow-[0_0_20px_rgba(0,240,255,0.05)]">
              <Users size={24} className="text-[var(--text-3)]" />
              <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-[var(--border-strong)]" />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-[var(--border-strong)]" />
              <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-[var(--border-strong)]" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-[var(--border-strong)]" />
            </div>
            <div className="text-center relative z-10">
              <p className="font-display font-bold uppercase text-[12px] tracking-[0.2em] text-[var(--text-2)]">
                No leads yet
              </p>
              <p className="font-body text-center max-w-xs text-[12px] text-[var(--text-3)] mt-2 leading-relaxed">
                Leads appear within 60s of each call via Vapi webhook.<br />
                Configure your assistant to start capturing leads.
              </p>
            </div>
            <a
              href="/voice"
              className="btn-ghost relative z-10 mt-1"
            >
              <Phone size={12} />
              Configure Voice Agent
            </a>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[rgba(18,21,38,0.4)]">
                    {['Name', 'Phone', 'Interest', 'Outcome', 'Date', 'Recording'].map((h) => (
                      <th key={h} className="text-left font-display font-bold uppercase px-5 py-3 text-[10px] tracking-[0.18em] text-[var(--text-3)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allLeads.map((lead, idx) => {
                    const isNew = idx === 0 && flash
                    const cfg = OUTCOME_CONFIG[lead.call_outcome] ?? OUTCOME_CONFIG.unknown
                    return (
                      <tr
                        key={lead.id}
                        className={`border-b border-[var(--border)] transition-all duration-400 hover:bg-[rgba(255,0,127,0.05)] group ${
                          isNew ? 'border-l-4 border-l-[var(--accent)] bg-[var(--accent-tint)] animate-[fade-up_0.3s_ease_both]' : 'border-l-4 border-l-transparent'
                        }`}
                      >
                        <td className="px-5 py-4 font-display font-semibold text-[13px] text-[var(--text-1)] group-hover:text-[var(--accent-2)] transition-colors">
                          {lead.caller_name || <span className="text-[var(--text-3)] italic font-body">Unknown</span>}
                        </td>
                        <td className="px-5 py-4 font-body text-[12px] text-[var(--text-2)] tracking-[0.06em]">
                          {lead.caller_phone || '—'}
                        </td>
                        <td className="px-5 py-4 font-body text-[12px] text-[var(--text-2)] max-w-[200px]">
                          <span className="truncate block">{lead.core_interest || '—'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`font-display font-bold uppercase inline-block px-2 py-1 text-[10px] tracking-[0.14em] ${lead.call_outcome === 'unknown' ? 'border border-[var(--border)]' : ''}`}
                            style={{ background: cfg.bg, color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-body text-[12px] text-[var(--text-3)] group-hover:text-[var(--text-2)] transition-colors whitespace-nowrap">
                          {new Date(lead.parsed_at).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="px-5 py-4">
                          {(lead as Lead & { recording_url?: string }).recording_url ? (
                            <a
                              href={(lead as Lead & { recording_url?: string }).recording_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 font-display font-bold uppercase text-[9px] tracking-[0.14em] text-[var(--accent)] hover:text-[var(--accent-2)] transition-colors"
                              title="Play recording"
                            >
                              <Play size={11} />
                              Play
                            </a>
                          ) : (
                            <span className="text-[var(--text-3)]">
                              <LinkIcon size={11} className="opacity-30" />
                            </span>
                          )}
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
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="btn-ghost py-2 px-6"
                >
                  {loadingMore ? (
                    <>
                      <span className="inline-block w-1 h-2.5 bg-[var(--text-2)] animate-[blink-cursor_0.7s_0s_steps(1)_infinite]" />
                      <span className="inline-block w-1 h-2.5 bg-[var(--text-2)] animate-[blink-cursor_0.7s_0.2s_steps(1)_infinite]" />
                      <span className="inline-block w-1 h-2.5 bg-[var(--text-2)] animate-[blink-cursor_0.7s_0.4s_steps(1)_infinite]" />
                      Loading
                    </>
                  ) : (
                    <>
                      <ChevronDown size={13} />
                      Load more leads
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
