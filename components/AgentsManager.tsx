'use client'

import { useEffect, useState } from 'react'
import {
  Bot, Phone, PhoneOutgoing, Check, Loader2, AlertCircle,
  Headphones, Bell, Star, RotateCcw, Moon, Sparkles,
} from 'lucide-react'

type RoleMeta = { role: string; label: string; description: string; direction: 'inbound' | 'outbound' }
type Agent    = { id: string; role: string; name: string; direction: string; vapi_agent_id: string | null; is_active: boolean }

const ROLE_ICON: Record<string, React.ElementType> = {
  receptionist: Headphones,
  follow_up:    PhoneOutgoing,
  reminder:     Bell,
  review:       Star,
  winback:      RotateCcw,
  after_hours:  Moon,
}

export default function AgentsManager() {
  const [catalog, setCatalog] = useState<RoleMeta[]>([])
  const [agents,  setAgents]  = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [busy,    setBusy]    = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/agents')
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load agents')
      const data = await res.json() as { catalog: RoleMeta[]; agents: Agent[] }
      setCatalog(data.catalog)
      setAgents(data.agents)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const provisioned = (role: string) =>
    agents.find((a) => a.role === role && a.is_active && a.vapi_agent_id)

  async function provision(role: string) {
    setBusy(role)
    setError('')
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not provision agent')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not provision agent')
    } finally {
      setBusy(null)
    }
  }

  const activeCount = agents.filter((a) => a.is_active && a.vapi_agent_id).length

  return (
    <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={15} className="text-[var(--accent)]" />
          <h1 className="font-display font-bold uppercase tracking-[0.12em] text-[15px] text-[var(--text-1)]">Agent Library</h1>
        </div>
        <p className="text-[13px] text-[var(--text-3)] max-w-2xl">
          Role-based AI callers for your franchise — each speaks from your knowledge base. Outbound agents share your existing number for caller ID; the receptionist owns inbound.
          <span className="text-[var(--text-2)] font-semibold"> {activeCount} active.</span>
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-[12px] text-[var(--danger)] border border-[var(--danger)]/40 bg-[var(--danger)]/5 rounded-md px-3 py-2.5">
          <AlertCircle size={14} className="shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 text-[var(--text-3)] text-[13px]">
          <Loader2 size={16} className="animate-spin text-[var(--accent)]" /> Loading agents…
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {catalog.map((r) => {
            const Icon = ROLE_ICON[r.role] ?? Bot
            const live = provisioned(r.role)
            const isBusy = busy === r.role
            return (
              <div key={r.role}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 flex flex-col"
                style={{ boxShadow: 'var(--shadow-hard)' }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--accent-tint)', border: '1px solid var(--border)' }}>
                    <Icon size={18} className="text-[var(--accent)]" />
                  </div>
                  <span className="font-display font-bold uppercase text-[8px] tracking-[0.14em] px-2 py-1 rounded-full flex items-center gap-1.5"
                    style={{
                      color: r.direction === 'inbound' ? 'var(--accent)' : 'var(--live)',
                      background: r.direction === 'inbound' ? 'var(--accent-tint)' : 'rgba(0,232,122,0.08)',
                      border: `1px solid ${r.direction === 'inbound' ? 'var(--accent)' : 'var(--live)'}33`,
                    }}>
                    {r.direction === 'inbound' ? <Phone size={9} /> : <PhoneOutgoing size={9} />}
                    {r.direction}
                  </span>
                </div>

                <h3 className="font-display font-bold text-[14px] text-[var(--text-1)] mb-1.5">{r.label}</h3>
                <p className="text-[12px] text-[var(--text-3)] leading-relaxed flex-1">{r.description}</p>

                <div className="mt-4">
                  {live ? (
                    <div className="flex items-center gap-2 font-display font-bold uppercase text-[10px] tracking-[0.12em] text-[var(--live)]">
                      <Check size={13} /> Active
                      <button onClick={() => provision(r.role)} disabled={isBusy}
                        className="ml-auto font-display font-semibold normal-case tracking-normal text-[11px] text-[var(--text-3)] hover:text-[var(--accent)] transition-colors">
                        {isBusy ? 'Updating…' : 'Re-sync'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => provision(r.role)} disabled={isBusy}
                      className="btn-primary w-full justify-center py-2.5 text-[11px]">
                      {isBusy
                        ? <><Loader2 size={13} className="animate-spin mr-1.5" /> Provisioning…</>
                        : <>Provision Agent</>}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[11px] text-[var(--text-3)] border-l-2 border-[var(--border)] pl-3 max-w-2xl">
        Provisioning creates a dedicated voice assistant from your current knowledge. Outbound agents (follow-up, reminder, review, win-back) place calls from the <span className="font-semibold text-[var(--text-2)]">Leads</span> page and are bounded by your monthly call budget. Re-sync after updating your knowledge to refresh an agent.
      </p>
    </div>
  )
}
