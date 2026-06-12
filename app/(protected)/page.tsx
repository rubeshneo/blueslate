export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { CheckCircle2, Circle, Users, Brain, MessageSquare, Radio, ArrowRight, TrendingUp } from 'lucide-react'

import { getTenantId } from '@/lib/get-tenant'
// ── Onboarding steps ──────────────────────────────────────────────────────────
// Each step has a `check` that detects completion from live DB state.
const SETUP_STEPS = [
  {
    id: 'knowledge',
    label: 'Add your franchise knowledge',
    detail: 'Scrape your website or Instagram profile',
    href: '/knowledge',
  },
  {
    id: 'identity',
    label: 'Set your AI agent name & greeting',
    detail: 'White-label the receptionist as your own brand',
    href: '/settings',
  },
  {
    id: 'voice',
    label: 'Configure Vapi voice assistant',
    detail: 'Wire the webhook URL into your Vapi dashboard',
    href: '/voice',
  },
  {
    id: 'test',
    label: 'Test in the AI Playground',
    detail: 'Simulate a parent inquiry before going live',
    href: '/knowledge/playground',
  },
  {
    id: 'live',
    label: 'Receive your first live call',
    detail: 'Leads appear here automatically after each call',
    href: '/leads',
  },
]

export default async function DashboardPage() {
  const supabase = createClient()
  await supabase.auth.getUser() // ensure session is validated

  // Dynamically resolve the tenant ID for the current authenticated user!
  const TENANT_ID = await getTenantId()

  const cookieStore = cookies()
  const hasTested = cookieStore.get(`playground_tested_${TENANT_ID}`)?.value === 'true'



  // ── Fetch all dashboard data in parallel ─────────────────────────────────
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const [
    { count: totalLeads },
    { count: totalCalls },
    { count: bookedLeads },
    { count: callsThisWeek },
    { count: knowledgeCount },
    { data: tenantData },
  ] = await Promise.all([
    supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    supabaseAdmin.from('call_logs').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('call_outcome', 'booked'),
    supabaseAdmin.from('call_logs').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).gte('started_at', weekAgo),
    supabaseAdmin.from('knowledge_context').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('is_active', true),
    supabaseAdmin.from('tenants').select('agent_name').eq('id', TENANT_ID).single(),
  ])

  const bookingRate = totalLeads && totalLeads > 0
    ? `${Math.round(((bookedLeads ?? 0) / totalLeads) * 100)}%`
    : '—'

  // Onboarding completion: map step id → boolean
  const DEFAULT_AGENT_NAMES = ['AI Receptionist', 'Blueslate AI']

  const completedSteps: Record<string, boolean> = {
    knowledge: (knowledgeCount ?? 0) > 0,
    identity: !DEFAULT_AGENT_NAMES.includes(tenantData?.agent_name ?? 'AI Receptionist'),
    voice: (totalCalls ?? 0) > 0,
    test: hasTested,
    live: (totalLeads ?? 0) > 0,
  }
  const setupComplete = Object.values(completedSteps).filter(Boolean).length
  const allDone = setupComplete === SETUP_STEPS.length

  const stats = [
    { label: 'Leads Parsed', value: String(totalLeads ?? 0), icon: Users, color: 'var(--accent)' },
    { label: 'Booking Rate', value: bookingRate, icon: TrendingUp, color: 'var(--warn)' },
    { label: 'Live Agent', value: 'Active', icon: Radio, color: 'var(--live)' },
  ]

  return (
    <main className="flex-1 stagger p-4 md:p-6 flex flex-col gap-5 overflow-x-hidden">

      {/* ── NORTH STAR: Calls This Week ─────────────────────────────────── */}
      <div className="card p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-l-4 border-l-[var(--accent)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)] opacity-[0.04] blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-micro-grid opacity-10 pointer-events-none mix-blend-screen" />

        <div className="relative z-10">
          <p className="font-display font-bold uppercase text-[9px] tracking-[0.22em] text-[var(--text-3)] mb-2">
            ── Primary Metric
          </p>
          <div className="flex items-baseline gap-4">
            <span className="font-display font-bold text-6xl md:text-7xl tracking-[-0.03em] text-[var(--text-1)] leading-none">
              {callsThisWeek ?? 0}
            </span>
            <div>
              <p className="font-display font-bold uppercase text-[13px] tracking-[0.08em] text-[var(--text-2)]">
                Calls this week
              </p>
              <p className="font-body text-[12px] text-[var(--text-3)] mt-0.5">
                {(totalCalls ?? 0)} total · {(totalLeads ?? 0)} leads parsed
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="text-center px-4 border-l border-[var(--border)] first:border-l-0">
              <Icon size={14} style={{ color }} className="mx-auto mb-1" />
              <p className="font-display font-bold text-[18px] text-[var(--text-1)]">{value}</p>
              <p className="font-display uppercase text-[9px] tracking-[0.16em] text-[var(--text-3)] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Onboarding checklist (hidden when all done) ──────────────────── */}
      {!allDone && (
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
            <div>
              <p className="font-display font-bold uppercase text-[10px] tracking-[0.2em] text-[var(--accent)]">
                ── Setup Checklist
              </p>
              <p className="font-body text-[11px] text-[var(--text-3)] mt-0.5">
                {setupComplete} of {SETUP_STEPS.length} steps complete
              </p>
            </div>
            {/* Progress bar */}
            <div className="w-24 h-1.5 bg-[var(--border)] relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[var(--accent)] transition-all duration-700"
                style={{ width: `${(setupComplete / SETUP_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex flex-col">
            {/* All steps — action items */}
            {SETUP_STEPS.map(({ id, label, detail, href }, idx) => {
              const done = completedSteps[id] ?? false
              return (
                <Link
                  key={id}
                  href={href}
                  className={`flex items-center gap-4 px-5 py-4 no-underline transition-all duration-200 group border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--accent-tint)] ${done ? 'opacity-60 hover:opacity-100' : ''}`}
                >
                  {done ? (
                    <CheckCircle2 size={18} className="text-[var(--live)] shrink-0 transition-colors" />
                  ) : (
                    <Circle size={18} className="text-[var(--border-strong)] group-hover:text-[var(--accent)] shrink-0 transition-colors" />
                  )}
                  <span className={`font-display font-bold uppercase text-[10px] tracking-[0.12em] ${done ? 'text-[var(--live)]' : 'text-[var(--text-3)]'}`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-display font-bold uppercase text-[11px] tracking-[0.1em] transition-colors ${done ? 'text-[var(--text-2)] line-through decoration-white/20' : 'text-[var(--text-1)] group-hover:text-[var(--accent-2)]'}`}>
                      {label}
                    </p>
                    <p className="font-body text-[11px] text-[var(--text-3)] mt-0.5">{detail}</p>
                  </div>
                  {!done && <ArrowRight size={14} className="text-[var(--text-3)] shrink-0 group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all" />}
                  {done && <CheckCircle2 size={14} className="text-[var(--live)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Quick actions (shown when setup complete) ────────────────────── */}
      {allDone && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
            <p className="font-display font-bold uppercase text-[9px] tracking-[0.22em] text-[var(--accent)]">
              ── Quick Actions
            </p>
          </div>
          <div className="flex flex-col">
            {[
              { href: '/knowledge', label: 'Update Knowledge', sub: 'Add new franchise info or seasonal offers', icon: Brain },
              { href: '/knowledge/playground', label: 'Test AI Receptionist', sub: 'Simulate a parent inquiry', icon: MessageSquare },
              { href: '/leads', label: 'Browse Leads', sub: 'Live leads from Vapi call transcripts', icon: Users },
            ].map(({ href, label, sub, icon: Icon }, idx, arr) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center justify-between p-4 md:px-5 no-underline text-inherit transition-all duration-200 hover:bg-[var(--accent-tint)] group ${idx < arr.length - 1 ? 'border-b border-[var(--border)]' : ''}`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 border border-[var(--border)] flex items-center justify-center shrink-0 group-hover:border-[var(--accent)] transition-all bg-[var(--surface-2)]">
                    <Icon size={16} className="text-[var(--accent)] group-hover:text-[var(--accent-2)] transition-colors" />
                  </div>
                  <div>
                    <p className="font-display font-bold uppercase text-[11px] tracking-[0.12em] text-[var(--text-1)] group-hover:text-[var(--accent-2)] transition-colors">{label}</p>
                    <p className="font-body text-[12px] text-[var(--text-3)] mt-0.5">{sub}</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-[var(--text-3)] shrink-0 group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Always-visible quick links when onboarding shows ─────────────── */}
      {!allDone && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { href: '/knowledge', label: 'Knowledge Base', icon: Brain, sub: 'Add franchise info' },
            { href: '/knowledge/playground', label: 'AI Playground', icon: MessageSquare, sub: 'Test before going live' },
            { href: '/leads', label: 'Leads', icon: Users, sub: 'View parsed leads' },
          ].map(({ href, label, icon: Icon, sub }) => (
            <Link key={href} href={href} className="card p-5 no-underline group flex flex-col gap-3 hover:border-[var(--accent)] transition-all">
              <Icon size={18} className="text-[var(--accent)] group-hover:text-[var(--accent-2)] transition-colors" />
              <div>
                <p className="font-display font-bold uppercase text-[11px] tracking-[0.1em] text-[var(--text-1)]">{label}</p>
                <p className="font-body text-[11px] text-[var(--text-3)] mt-0.5">{sub}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
