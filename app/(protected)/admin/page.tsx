'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Phone, Brain, TrendingUp, Globe, CheckCircle,
  XCircle, Clock, RefreshCw, Shield, AlertCircle
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface TenantRow {
  id: string
  name: string
  slug: string
  franchise_url: string | null
  phone_number: string | null
  agent_name: string | null
  is_active: boolean
  created_at: string
  lead_count: number
  call_count: number
  knowledge_count: number
  last_activity: string | null
}

interface RecentLead {
  id: string
  caller_name: string | null
  caller_phone: string | null
  core_interest: string | null
  call_outcome: string
  parsed_at: string
  tenant_name: string
}

interface Summary {
  total_tenants: number
  active_tenants: number
  total_leads: number
  total_calls: number
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function outcomeColor(outcome: string) {
  switch (outcome) {
    case 'booked':            return 'text-[var(--live)] bg-[var(--live)]/10 border-[var(--live)]/30'
    case 'interested':        return 'text-[var(--warn)] bg-[var(--warn)]/10 border-[var(--warn)]/30'
    case 'callback-requested': return 'text-blue-400 bg-blue-400/10 border-blue-400/30'
    case 'not-interested':    return 'text-[var(--text-3)] bg-[var(--text-3)]/10 border-[var(--text-3)]/30'
    default:                  return 'text-[var(--text-3)] bg-[var(--text-3)]/10 border-[var(--text-3)]/30'
  }
}

/* ─── Stat Card ──────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number | string; color: string
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold text-[var(--text-1)] leading-none">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)] mt-1">{label}</p>
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function AdminPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/stats')
      if (res.status === 403) { router.replace('/'); return }
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setSummary(data.summary)
      setTenants(data.tenants)
      setRecentLeads(data.recent_leads)
    } catch {
      setError('Could not load admin data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-[var(--text-3)]">
        <RefreshCw size={16} className="animate-spin" />
        <span className="text-sm font-medium">Loading admin data…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-6 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm max-w-md mx-auto mt-12">
        <AlertCircle size={16} className="shrink-0" />
        {error}
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={16} className="text-[var(--accent)]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Creator Admin</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-1)] tracking-tight">Blueslate Overview</h1>
          <p className="text-sm text-[var(--text-3)] mt-1">All tenants, leads, and platform activity in one place.</p>
        </div>
        <button onClick={load} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-bold text-[var(--text-2)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all disabled:opacity-50">
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Summary Cards ── */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users}     label="Total Tenants"   value={summary.total_tenants}   color="#E85D3F" />
          <StatCard icon={CheckCircle} label="Active Tenants" value={summary.active_tenants} color="#2EA043" />
          <StatCard icon={TrendingUp} label="Total Leads"    value={summary.total_leads}     color="#D29922" />
          <StatCard icon={Phone}     label="Total Calls"     value={summary.total_calls}     color="#388BFD" />
        </div>
      )}

      {/* ── Tenant Table ── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-1)]">All Tenants</h2>
            <p className="text-[10px] text-[var(--text-3)] mt-0.5 uppercase tracking-widest">
              {tenants.length} franchise{tenants.length !== 1 ? 's' : ''} onboarded
            </p>
          </div>
        </div>

        {tenants.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--text-3)]">No tenants yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  {['Franchise', 'Agent', 'Leads', 'Calls', 'Knowledge', 'Last Activity', 'Status', 'Joined'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map((t, i) => (
                  <tr key={t.id}
                    className={`border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors ${i === tenants.length - 1 ? 'border-b-0' : ''}`}>

                    {/* Franchise */}
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-[var(--text-1)]">{t.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-[var(--text-3)]">/{t.slug}</span>
                        {t.franchise_url && (
                          <a href={t.franchise_url} target="_blank" rel="noopener noreferrer"
                            className="text-[var(--accent)] hover:underline ml-1">
                            <Globe size={9} />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Agent */}
                    <td className="px-5 py-4">
                      <span className="text-xs text-[var(--text-2)]">{t.agent_name ?? '—'}</span>
                    </td>

                    {/* Leads */}
                    <td className="px-5 py-4">
                      <span className="text-sm font-bold text-[var(--warn)]">{t.lead_count}</span>
                    </td>

                    {/* Calls */}
                    <td className="px-5 py-4">
                      <span className="text-sm font-bold text-blue-400">{t.call_count}</span>
                    </td>

                    {/* Knowledge */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Brain size={11} className="text-[var(--text-3)]" />
                        <span className="text-xs text-[var(--text-2)]">{t.knowledge_count} source{t.knowledge_count !== 1 ? 's' : ''}</span>
                      </div>
                    </td>

                    {/* Last Activity */}
                    <td className="px-5 py-4">
                      {t.last_activity ? (
                        <div className="flex items-center gap-1.5">
                          <Clock size={10} className="text-[var(--text-3)]" />
                          <span className="text-xs text-[var(--text-2)]">{timeAgo(t.last_activity)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--text-3)]">No activity</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      {t.is_active ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider text-[var(--live)] bg-[var(--live)]/10 border border-[var(--live)]/30">
                          <CheckCircle size={9} /> Active
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider text-[var(--text-3)] bg-[var(--text-3)]/10 border border-[var(--text-3)]/30">
                          <XCircle size={9} /> Inactive
                        </div>
                      )}
                    </td>

                    {/* Joined */}
                    <td className="px-5 py-4">
                      <span className="text-xs text-[var(--text-3)]">
                        {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent Leads Across All Tenants ── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text-1)]">Recent Leads — All Tenants</h2>
          <p className="text-[10px] text-[var(--text-3)] mt-0.5 uppercase tracking-widest">Latest 10 across the platform</p>
        </div>

        {recentLeads.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--text-3)]">No leads captured yet.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--surface-2)] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(lead.caller_name?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-1)]">{lead.caller_name ?? 'Unknown Caller'}</p>
                    <p className="text-[10px] text-[var(--text-3)]">
                      {lead.caller_phone ?? 'No phone'} · {lead.core_interest ?? 'No interest noted'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-[var(--surface-2)] text-[var(--text-3)] border-[var(--border)]">
                    {lead.tenant_name}
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${outcomeColor(lead.call_outcome)}`}>
                    {lead.call_outcome.replace('-', ' ')}
                  </span>
                  <span className="text-[10px] text-[var(--text-3)] w-16 text-right">{timeAgo(lead.parsed_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
