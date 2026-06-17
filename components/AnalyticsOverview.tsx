'use client'

import { useMemo, useState } from 'react'
import { TrendingUp, Users, Phone, Target, ArrowRight } from 'lucide-react'

interface Lead {
  call_outcome:  string
  core_interest: string | null
  parsed_at:     string
}

interface CallLog {
  started_at:       string
  duration_seconds: number | null
}

interface Props {
  leads:    Lead[]
  callLogs: CallLog[]
}

// ── SVG constants ───────────────────────────────────────────────────────────
const CHART_W = 560
const CHART_H = 200
const PAD     = { top: 20, right: 20, bottom: 40, left: 44 }
const PLOT_W  = CHART_W - PAD.left - PAD.right
const PLOT_H  = CHART_H - PAD.top  - PAD.bottom

// ── Call Velocity Chart ─────────────────────────────────────────────────────
function CallVelocityChart({ callLogs, days: daysProp }: { callLogs: CallLog[]; days: number }) {
  const { points, days } = useMemo(() => {
    const now = Date.now()
    let days = daysProp
    if (days === 0) {
      // all-time: span from oldest call to today
      const ts = callLogs.filter(c => c.started_at).map(c => new Date(c.started_at).getTime())
      days = ts.length === 0 ? 30 : Math.max(14, Math.ceil((now - Math.min(...ts)) / 86_400_000) + 1)
    }
    const slots: Record<string, number> = {}
    for (let d = days - 1; d >= 0; d--) {
      const dt = new Date(now - d * 86_400_000)
      slots[dt.toISOString().slice(0, 10)] = 0
    }
    callLogs.forEach((c) => {
      if (!c.started_at) return
      const key = c.started_at.slice(0, 10)
      if (key in slots) slots[key] = (slots[key] ?? 0) + 1
    })
    return { points: Object.entries(slots).map(([date, count]) => ({ date, count })), days }
  }, [callLogs, daysProp])

  const maxVal = Math.max(...points.map((p) => p.count), 1)
  const total  = points.reduce((s, p) => s + p.count, 0)

  const toX = (i: number) => PAD.left + (i / (points.length - 1)) * PLOT_W
  const toY = (v: number) => PAD.top  + PLOT_H - (v / maxVal) * PLOT_H

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.count).toFixed(1)}`)
    .join(' ')

  const areaD = `${pathD} L ${toX(points.length - 1)} ${PAD.top + PLOT_H} L ${toX(0)} ${PAD.top + PLOT_H} Z`

  return (
    <div className="card p-6 relative overflow-hidden group">
      <div className="absolute inset-0 bg-micro-grid opacity-20 pointer-events-none mix-blend-screen" />
      {/* Header */}
      <div className="flex items-start justify-between mb-5 relative z-10">
        <div>
          <p className="font-display font-bold uppercase text-[10px] tracking-[0.2em] text-[var(--accent-2)] drop-shadow-[0_0_5px_rgba(0,240,255,0.4)]">
            ── Call Velocity
          </p>
          <p className="font-display font-bold leading-none mt-2 text-4xl text-[var(--text-1)] drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
            {total}
          </p>
          <p className="font-display uppercase mt-1 text-[9px] tracking-[0.14em] text-[var(--text-3)]">
            calls · {daysProp === 0 ? 'all time' : `last ${days} days`}
          </p>
        </div>
        <Phone size={16} className="text-[var(--text-3)] mt-1 group-hover:text-[var(--accent)] transition-colors drop-shadow-[0_0_5px_var(--accent)]" />
      </div>

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full h-auto"
        style={{ display: 'block' }}
        aria-hidden
      >
        <defs>
          <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   style={{ stopColor: 'var(--accent)', stopOpacity: 0.18 }} />
            <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.01 }} />
          </linearGradient>
          <clipPath id="chartClip">
            <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} />
          </clipPath>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD.top + PLOT_H - t * PLOT_H
          return (
            <g key={t}>
              <line
                x1={PAD.left} y1={y} x2={PAD.left + PLOT_W} y2={y}
                stroke="currentColor" strokeOpacity="0.07" strokeWidth="1"
              />
              <text
                x={PAD.left - 8} y={y + 4}
                textAnchor="end" fontSize={9} fill="currentColor" opacity={0.35}
                fontFamily="var(--font-display)"
              >
                {Math.round(t * maxVal)}
              </text>
            </g>
          )
        })}

        {/* Diagonal trajectory markers */}
        {Array.from({ length: 7 }).map((_, i) => {
          const x = PAD.left + ((i + 0.5) / 7) * PLOT_W
          return (
            <line key={i}
              x1={x - 18} y1={PAD.top + PLOT_H}
              x2={x + 18} y2={PAD.top}
              stroke="currentColor" strokeOpacity="0.04" strokeWidth="1"
              clipPath="url(#chartClip)"
            />
          )
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#velGrad)" clipPath="url(#chartClip)" />

        {/* Line — animated draw-on */}
        <path
          d={pathD}
          fill="none"
          style={{ stroke: 'var(--accent)', animation: 'dash-draw 1.4s cubic-bezier(0.16,1,0.3,1) forwards' }}
          strokeWidth="1.5"
          strokeLinecap="square"
          strokeLinejoin="miter"
          strokeDasharray="1200"
          strokeDashoffset="1200"
          clipPath="url(#chartClip)"
        />

        {/* Data points */}
        {points.map((p, i) =>
          p.count > 0 ? (
            <rect
              key={i}
              x={toX(i) - 2.5}
              y={toY(p.count) - 2.5}
              width={5}
              height={5}
              style={{ fill: 'var(--accent)' }}
            />
          ) : null
        )}

        {/* X-axis baseline */}
        <line
          x1={PAD.left} y1={PAD.top + PLOT_H}
          x2={PAD.left + PLOT_W} y2={PAD.top + PLOT_H}
          stroke="currentColor" strokeOpacity="0.15" strokeWidth="1"
        />

        {/* X-axis labels */}
        {points.map((p, i) =>
          i % 7 === 0 ? (
            <text
              key={i}
              x={toX(i)} y={CHART_H - 6}
              textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.35}
              fontFamily="var(--font-display)"
            >
              {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </text>
          ) : null
        )}
      </svg>
    </div>
  )
}

// ── Interest Distribution ───────────────────────────────────────────────────
function InterestChart({ leads }: { leads: Lead[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {}
    leads.forEach((l) => {
      if (!l.core_interest) return
      const key = l.core_interest.trim()
      counts[key] = (counts[key] ?? 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [leads])

  const maxVal = Math.max(...data.map((d) => d[1]), 1)

  if (data.length === 0) {
    return (
      <div className="card min-h-[200px] flex flex-col items-center justify-center p-8 gap-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-dot-pattern opacity-40 pointer-events-none" />
        <div className="relative z-10 w-12 h-12 border border-[var(--border)] flex items-center justify-center">
          <Target size={20} className="text-[var(--text-3)]" />
          <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[var(--border-strong)]" />
          <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--border-strong)]" />
        </div>
        <div className="text-center relative z-10">
          <p className="font-display font-bold uppercase text-[11px] tracking-[0.2em] text-[var(--text-2)]">No interest data yet</p>
          <p className="font-body text-[12px] text-[var(--text-3)] mt-1.5">Interests are extracted from call transcripts automatically.</p>
        </div>
        <a href="/voice" className="btn-ghost py-2 px-4 text-[10px] relative z-10 no-underline flex items-center gap-2">
          <ArrowRight size={12} />Configure Voice Agent
        </a>
      </div>
    )
  }

  return (
    <div className="card p-6 relative overflow-hidden group">
      <div className="absolute inset-0 bg-micro-grid opacity-10 pointer-events-none mix-blend-screen" />
      <div className="mb-6 relative z-10">
        <p className="font-display font-bold uppercase text-[10px] tracking-[0.2em] text-[var(--accent)] drop-shadow-[0_0_5px_rgba(255,0,127,0.4)]">
          ── Interest Distribution
        </p>
        <p className="font-display uppercase mt-1 text-[9px] tracking-[0.14em] text-[var(--text-3)]">
          Top programs by inquiry volume
        </p>
      </div>

      <div className="flex flex-col gap-4 relative z-10">
        {data.map(([label, count], i) => (
          <div key={label} className="group/item">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body truncate text-[12px] text-[var(--text-2)] max-w-[70%] group-hover/item:text-[var(--text-1)] transition-colors">
                {label}
              </span>
              <span className="font-display font-bold text-[13px] text-[var(--text-1)] group-hover/item:text-[var(--accent)] transition-colors">
                {count}
              </span>
            </div>
            <div className="h-1.5 bg-[rgba(18,21,38,0.8)] border border-[var(--border)] relative overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 animate-[bar-grow_0.7s_both_cubic-bezier(0.16,1,0.3,1)] ${i === 0 ? 'bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]' : 'bg-[var(--text-2)]'}`}
                style={{
                  width: `${(count / maxVal) * 100}%`,
                  transformOrigin: 'left',
                  animationDelay: `${i * 0.08}s`
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Outcome Donut ───────────────────────────────────────────────────────────
const OUTCOME_META: Record<string, { color: string; label: string }> = {
  booked:               { color: 'var(--live)',          label: 'Booked' },
  interested:           { color: 'var(--accent)',        label: 'Interested' },
  'callback-requested': { color: 'var(--warn)',          label: 'Callback' },
  'not-interested':     { color: 'var(--danger)',        label: 'Declined' },
  unknown:              { color: 'var(--border-strong)', label: 'Unknown' },
}

const DONUT_R  = 58
const DONUT_CX = 88
const DONUT_CY = 88
const STROKE   = 18

function DonutArc({ cx, cy, r, stroke, startAngle, endAngle, color }: {
  cx: number; cy: number; r: number; stroke: number
  startAngle: number; endAngle: number; color: string
}) {
  const span = endAngle - startAngle
  if (span < 0.5) return null
  const a1 = (startAngle - 90) * Math.PI / 180
  const a2 = (endAngle   - 90) * Math.PI / 180
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  const x2 = cx + r * Math.cos(a2)
  const y2 = cy + r * Math.sin(a2)
  const d  = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
  return <path d={d} fill="none" style={{ stroke: color }} strokeWidth={stroke} strokeLinecap="butt" />
}

function OutcomeChart({ leads }: { leads: Lead[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {}
    leads.forEach((l) => { counts[l.call_outcome] = (counts[l.call_outcome] ?? 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [leads])

  const total = data.reduce((s, [, n]) => s + n, 0)
  let cursor  = 0
  const segments = data.map(([key, count]) => {
    const angle = (count / total) * 360
    const seg   = { key, count, start: cursor, end: cursor + angle }
    cursor += angle
    return seg
  })

  return (
    <div className="card p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-dot-pattern opacity-50 pointer-events-none" />
      <div className="mb-5 relative z-10">
        <p className="font-display font-bold uppercase text-[10px] tracking-[0.2em] text-[var(--live)] drop-shadow-[0_0_5px_rgba(0,255,136,0.4)]">
          ── Outcome Allocation
        </p>
        <p className="font-display uppercase mt-1 text-[9px] tracking-[0.14em] text-[var(--text-3)]">
          {total} total leads
        </p>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-4 relative z-10">
          <div className="w-10 h-10 border border-[var(--border)] flex items-center justify-center">
            <Users size={18} className="text-[var(--text-3)]" />
          </div>
          <div className="text-center">
            <p className="font-display font-bold uppercase text-[11px] tracking-[0.2em] text-[var(--text-2)]">No leads yet</p>
            <p className="font-body text-[12px] text-[var(--text-3)] mt-1">Outcome data appears after the first call.</p>
          </div>
          <a href="/voice" className="btn-ghost py-1.5 px-4 text-[9px] no-underline flex items-center gap-2">
            <ArrowRight size={11} />Configure Voice Agent
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          {/* Architectural donut */}
          <svg width={176} height={176} viewBox="0 0 176 176" style={{ flexShrink: 0 }}>
            {/* Tick marks around circumference */}
            {Array.from({ length: 24 }).map((_, i) => {
              const a = (i / 24) * 2 * Math.PI - Math.PI / 2
              const r1 = DONUT_R + STROKE / 2 + 4
              const r2 = r1 + 4
              return (
                <line key={i}
                  x1={DONUT_CX + r1 * Math.cos(a)} y1={DONUT_CY + r1 * Math.sin(a)}
                  x2={DONUT_CX + r2 * Math.cos(a)} y2={DONUT_CY + r2 * Math.sin(a)}
                  stroke="currentColor" strokeOpacity="0.12" strokeWidth="1"
                />
              )
            })}

            {/* Background ring */}
            <circle
              cx={DONUT_CX} cy={DONUT_CY} r={DONUT_R}
              fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth={STROKE}
            />

            {/* Segments */}
            {segments.map((s) => (
              <DonutArc key={s.key}
                cx={DONUT_CX} cy={DONUT_CY} r={DONUT_R} stroke={STROKE}
                startAngle={s.start} endAngle={s.end}
                color={(OUTCOME_META[s.key] ?? OUTCOME_META.unknown).color}
              />
            ))}

            {/* Crosshair */}
            <line
              x1={DONUT_CX - 16} y1={DONUT_CY}
              x2={DONUT_CX + 16} y2={DONUT_CY}
              stroke="currentColor" strokeOpacity="0.12" strokeWidth="1"
            />
            <line
              x1={DONUT_CX} y1={DONUT_CY - 16}
              x2={DONUT_CX} y2={DONUT_CY + 16}
              stroke="currentColor" strokeOpacity="0.12" strokeWidth="1"
            />

            {/* Centre */}
            <text
              x={DONUT_CX} y={DONUT_CY - 4}
              textAnchor="middle" fontSize={26} fontWeight="700"
              fill="var(--text-1)" fontFamily="var(--font-display)"
              style={{ filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.3))' }}
            >
              {total}
            </text>
            <text
              x={DONUT_CX} y={DONUT_CY + 16}
              textAnchor="middle" fontSize={10}
              fill="var(--text-3)" opacity={0.6}
              fontFamily="var(--font-display)"
              letterSpacing="0.16em"
            >
              LEADS
            </text>
          </svg>

          {/* Legend */}
          <div className="flex flex-col gap-3 min-w-0 flex-1 pl-2">
            {segments.map((s) => {
              const meta = OUTCOME_META[s.key] ?? OUTCOME_META.unknown
              return (
                <div key={s.key} className="flex items-center gap-3 group/leg">
                  <span className="w-2 h-2 shrink-0 rounded-full" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
                  <span className="font-body truncate text-[12px] text-[var(--text-2)] group-hover/leg:text-[var(--text-1)] transition-colors">
                    {meta.label}
                  </span>
                  <span className="font-display font-bold ml-auto pl-3 text-[12px] text-[var(--text-1)] shrink-0 glow-text">
                    {Math.round((s.count / total) * 100)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── KPI Row ─────────────────────────────────────────────────────────────────
function KpiRow({ leads, callLogs }: Props) {
  const avgDuration = useMemo(() => {
    const valid = callLogs.filter((c) => c.duration_seconds && c.duration_seconds > 0)
    if (!valid.length) return null
    return Math.round(valid.reduce((s, c) => s + (c.duration_seconds ?? 0), 0) / valid.length)
  }, [callLogs])

  const conversionRate = useMemo(() => {
    if (!leads.length) return null
    return Math.round((leads.filter((l) => l.call_outcome === 'booked').length / leads.length) * 100)
  }, [leads])

  const kpis = [
    { label: 'Total Calls',       value: callLogs.length.toString(), sub: 'all time',          icon: Phone },
    { label: 'Total Leads',       value: leads.length.toString(),    sub: 'parsed from calls', icon: Users },
    { label: 'Avg Duration',
      value: avgDuration !== null ? `${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s` : '—',
      sub: 'per call', icon: TrendingUp },
    { label: 'Booking Rate',
      value: conversionRate !== null ? `${conversionRate}%` : '—',
      sub: 'leads → booked', icon: Target },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map(({ label, value, sub, icon: Icon }, idx) => (
        <div
          key={label}
          className="card p-5 relative overflow-hidden group flex flex-col justify-between min-h-[140px]"
          style={{ animation: `fade-up 0.4s ${idx * 60}ms both` }}
        >
          <div className="absolute -right-6 -bottom-6 opacity-5 group-hover:opacity-[0.15] transition-opacity duration-500 pointer-events-none">
            <Icon size={100} className="text-[var(--accent)]" />
          </div>
          <Icon size={18} className="text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors mb-4 drop-shadow-[0_0_5px_var(--accent)]" />
          <div>
            <p className="font-display font-bold leading-none tracking-tighter text-[32px] text-[var(--text-1)] drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
              {value}
            </p>
            <p className="font-display font-bold uppercase mt-2 text-[10px] tracking-[0.18em] text-[var(--accent-2)] drop-shadow-[0_0_5px_rgba(0,240,255,0.3)]">
              {label}
            </p>
            <p className="font-body mt-1 text-[11px] text-[var(--text-3)]">
              {sub}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

const RANGES = [
  { key: '7d',  label: '7d',  ms: 7  * 86_400_000 },
  { key: '30d', label: '30d', ms: 30 * 86_400_000 },
  { key: 'all', label: 'All', ms: 0 },
] as const
type RangeKey = typeof RANGES[number]['key']

export default function AnalyticsOverview({ leads, callLogs }: Props) {
  const [range, setRange] = useState<RangeKey>('30d')

  const rangeMs    = RANGES.find(r => r.key === range)!.ms
  const chartDays  = range === '7d' ? 7 : range === '30d' ? 30 : 0

  const filteredLeads = useMemo(() =>
    rangeMs ? leads.filter(l => Date.now() - new Date(l.parsed_at).getTime() <= rangeMs) : leads,
    [leads, rangeMs]
  )
  const filteredCallLogs = useMemo(() =>
    rangeMs ? callLogs.filter(c => c.started_at && Date.now() - new Date(c.started_at).getTime() <= rangeMs) : callLogs,
    [callLogs, rangeMs]
  )

  const hasData = leads.length > 0 || callLogs.length > 0

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-dot-pattern opacity-30 pointer-events-none" />
        <div className="relative z-10 w-20 h-20 border border-[var(--border)] flex items-center justify-center">
          <TrendingUp size={32} className="text-[var(--text-3)]" />
          {['tl','tr','bl','br'].map((pos) => (
            <span
              key={pos}
              className={`absolute w-3 h-3 border-[var(--border-strong)] ${
                pos === 'tl' ? 'top-0 left-0 border-t-2 border-l-2' :
                pos === 'tr' ? 'top-0 right-0 border-t-2 border-r-2' :
                pos === 'bl' ? 'bottom-0 left-0 border-b-2 border-l-2' :
                               'bottom-0 right-0 border-b-2 border-r-2'
              }`}
            />
          ))}
        </div>
        <div className="text-center relative z-10 max-w-sm">
          <p className="font-display font-bold uppercase text-[14px] tracking-[0.1em] text-[var(--text-1)]">
            No call data yet
          </p>
          <p className="font-body text-[13px] text-[var(--text-3)] mt-3 leading-relaxed">
            Analytics populate automatically after your first call is processed by the Vapi webhook. Configure your voice agent to get started.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 relative z-10">
          <a href="/voice" className="btn-primary no-underline">
            <Phone size={14} />Configure Voice Agent
          </a>
          <a href="/knowledge/playground" className="btn-ghost no-underline">
            <ArrowRight size={14} />Test in Playground
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Range picker */}
      <div className="flex items-center justify-end gap-1">
        {RANGES.map(r => (
          <button key={r.key} onClick={() => setRange(r.key)}
            className={`font-display font-bold uppercase text-[10px] tracking-widest px-3 py-1.5 border transition-all ${
              range === r.key
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-tint)]'
                : 'border-[var(--border)] text-[var(--text-3)] hover:border-[var(--border-strong)] hover:text-[var(--text-2)]'
            }`}>
            {r.label}
          </button>
        ))}
      </div>
      <KpiRow leads={filteredLeads} callLogs={filteredCallLogs} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CallVelocityChart callLogs={filteredCallLogs} days={chartDays} />
        <OutcomeChart      leads={filteredLeads} />
      </div>
      <InterestChart leads={filteredLeads} />
    </div>
  )
}
