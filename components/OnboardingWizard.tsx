'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Check, ArrowRight, ArrowLeft, Sparkles, Building2, Bot,
  Globe, PartyPopper, Loader2, Zap, Crown, Rocket, Mic,
} from 'lucide-react'

type Initial = {
  name: string
  slug: string
  agentName: string
  agentGreeting: string
  franchiseUrl: string
  hasKnowledge: boolean
}

const PLANS = [
  {
    id: 'starter', name: 'Starter', price: '$0', period: '/mo', icon: Rocket,
    tagline: 'Validate for free', color: 'var(--live)',
    perks: ['100 voice minutes/mo', 'Website ingestion', 'Lead dashboard'],
  },
  {
    id: 'pro', name: 'Pro Franchise', price: '$99', period: '/mo', icon: Crown,
    tagline: 'For busy locations', color: 'var(--accent)', popular: true,
    perks: ['1,000 voice minutes/mo', 'Custom agent voice', 'CRM webhooks', 'White-label'],
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 'Custom', period: '', icon: Zap,
    tagline: 'Multi-location', color: 'var(--accent-2)',
    perks: ['Unlimited minutes', 'Dedicated manager', 'SSO & SLA'],
  },
]

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60)

export default function OnboardingWizard({ tenantId, userName, userEmail, initial }: {
  tenantId: string
  userName: string
  userEmail: string
  initial: Initial
}) {
  const router = useRouter()
  const params = useSearchParams()
  const planParam = params.get('plan')

  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Form state
  const [plan, setPlan] = useState(planParam && PLANS.some(p => p.id === planParam) ? planParam : 'pro')
  const [bizName, setBizName] = useState(initial.name)
  const [slug, setSlug] = useState(initial.slug)
  const [slugTouched, setSlugTouched] = useState(!!initial.slug)
  const [agentName, setAgentName] = useState(initial.agentName || 'Sage')
  const [greeting, setGreeting] = useState(initial.agentGreeting || '')
  const [url, setUrl] = useState(initial.franchiseUrl)
  const [scrapeResult, setScrapeResult] = useState<{ title?: string; type?: string } | null>(
    initial.hasKnowledge ? { type: 'existing' } : null
  )
  const [skippedKnowledge, setSkippedKnowledge] = useState(false)

  const firstName = userName.split(' ')[0] || 'there'

  // Auto-derive slug from business name until user edits it
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(bizName))
  }, [bizName, slugTouched])

  // Auto-fill greeting once business + agent name known
  useEffect(() => {
    if (!initial.agentGreeting && agentName && bizName && !greeting) {
      setGreeting(`Hi! Thanks for calling ${bizName}. I'm ${agentName}, your AI assistant — how can I help you today?`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentName, bizName])

  const STEPS = ['Plan', 'Franchise', 'AI Agent', 'Knowledge', 'Launch']
  const progress = (step / (STEPS.length - 1)) * 100

  const selectedPlan = useMemo(() => PLANS.find(p => p.id === plan)!, [plan])

  // ── Persist helpers ──────────────────────────────────────────────────────
  async function patchTenant(body: Record<string, string>) {
    const res = await fetch('/api/tenant-identity', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || 'Could not save. Please try again.')
    }
  }

  async function next() {
    setError('')
    setSaving(true)
    try {
      if (step === 1) {
        if (!bizName.trim()) throw new Error('Please enter your franchise name.')
        if (!slug.trim()) throw new Error('Please choose a workspace URL slug.')
        await patchTenant({ name: bizName.trim(), slug: slug.trim() })
      }
      if (step === 2) {
        if (!agentName.trim()) throw new Error('Please name your AI agent.')
        if (!greeting.trim()) throw new Error('Please write a greeting.')
        await patchTenant({ agent_name: agentName.trim(), agent_greeting: greeting.trim() })
      }
      setStep(s => Math.min(s + 1, STEPS.length - 1))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  function back() { setError(''); setStep(s => Math.max(s - 1, 0)) }

  function skipStep() { setError(''); setStep(s => Math.min(s + 1, STEPS.length - 1)) }

  async function runScrape() {
    setError('')
    if (!url.trim()) { setError('Paste your website or Instagram URL first.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), tenant_id: tenantId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Could not scrape that URL.')
      setScrapeResult({ title: j.page_title, type: j.source_type })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scrape failed.')
    } finally {
      setSaving(false)
    }
  }

  function finish() {
    // Remember selected plan client-side; dashboard reads live DB state for the rest.
    try { document.cookie = `blueslate_plan=${plan}; path=/; max-age=31536000` } catch {}
    router.push('/')
    router.refresh()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center px-6 py-10">
      {/* Header */}
      <div className="w-full max-w-3xl flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--accent)] text-white flex items-center justify-center font-display font-bold text-xs rounded-sm shadow-[var(--shadow-accent)]">BS</div>
          <span className="font-display font-bold uppercase tracking-widest text-[13px]">Blueslate<span className="text-[var(--accent)]"> AI</span></span>
        </div>
        <div className="w-24" />
      </div>

      {/* Progress rail */}
      <div className="w-full max-w-3xl mb-10">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-2 flex-1">
              <div className={`flex items-center w-full ${i === 0 ? 'justify-start' : i === STEPS.length - 1 ? 'justify-end' : 'justify-center'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-display font-bold border-2 transition-all duration-300 ${
                  i < step ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : i === step ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-tint)] scale-110'
                  : 'border-[var(--border-strong)] text-[var(--text-3)] bg-[var(--surface)]'
                }`}>
                  {i < step ? <Check size={12} /> : i + 1}
                </div>
              </div>
              <span className={`font-display font-bold uppercase text-[9px] tracking-widest transition-colors ${i <= step ? 'text-[var(--text-1)]' : 'text-[var(--text-3)]'}`}>{label}</span>
            </div>
          ))}
        </div>
        <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--accent)] rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-3xl">
        <div key={step} className="card p-8 md:p-10 bg-[var(--surface)]" style={{ animation: 'fade-up 0.4s ease-out both' }}>

          {/* ── Step 0: Plan ── */}
          {step === 0 && (
            <>
              <StepHead icon={Sparkles} eyebrow={`Welcome, ${firstName}`} title="Choose your plan" sub="Start free and upgrade anytime. No credit card required to begin." />
              <div className="grid md:grid-cols-3 gap-4 mt-8">
                {PLANS.map((p) => {
                  const active = plan === p.id
                  return (
                    <button key={p.id} onClick={() => setPlan(p.id)}
                      className={`relative text-left p-5 rounded-xl border-2 transition-all duration-200 ${active ? 'border-[var(--accent)] bg-[var(--accent-tint)] shadow-[0_0_24px_rgba(232,93,63,0.18)] scale-[1.02]' : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]'}`}>
                      {p.popular && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-[var(--accent)] text-white font-display font-bold uppercase text-[8px] tracking-widest rounded-full whitespace-nowrap">Popular</span>
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${p.color}15`, border: `1px solid ${p.color}25` }}>
                          <p.icon size={18} style={{ color: p.color }} />
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${active ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-strong)]'}`}>
                          {active && <Check size={11} className="text-white" />}
                        </div>
                      </div>
                      <p className="font-display font-bold uppercase tracking-widest text-[10px] text-[var(--text-3)] mb-1">{p.name}</p>
                      <div className="flex items-baseline gap-0.5 mb-1">
                        <span className="font-display font-bold text-2xl text-[var(--text-1)]">{p.price}</span>
                        <span className="text-[var(--text-3)] text-xs font-bold">{p.period}</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-3)] mb-4">{p.tagline}</p>
                      <div className="space-y-1.5">
                        {p.perks.map((perk) => (
                          <div key={perk} className="flex items-start gap-2">
                            <Check size={11} className="text-[var(--accent)] shrink-0 mt-0.5" />
                            <span className="text-[11px] text-[var(--text-2)] leading-snug">{perk}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* ── Step 1: Franchise ── */}
          {step === 1 && (
            <>
              <StepHead icon={Building2} eyebrow="Step 2 of 5" title="Tell us about your franchise" sub="This personalizes your AI agent and workspace." />
              <div className="mt-8 space-y-5">
                <Field label="Franchise name">
                  <input className="input-field" value={bizName} placeholder="XP League Frisco"
                    onChange={(e) => setBizName(e.target.value)} autoFocus />
                </Field>
                <Field label="Workspace URL" hint="Used for your branded subdomain & dashboard.">
                  <div className="flex items-center">
                    <span className="px-3 py-[9px] bg-[var(--surface-2)] border border-r-0 border-[var(--border)] rounded-l-md text-[var(--text-3)] text-[13px] font-display whitespace-nowrap">blueslate.ai/</span>
                    <input className="input-field rounded-l-none" value={slug} placeholder="xp-league-frisco"
                      onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)) }} />
                  </div>
                </Field>
              </div>
            </>
          )}

          {/* ── Step 2: AI Agent ── */}
          {step === 2 && (
            <>
              <StepHead icon={Bot} eyebrow="Step 3 of 5" title="Design your AI receptionist" sub="Give your agent a name and a greeting callers will hear first." />
              <div className="mt-8 space-y-5">
                <Field label="Agent name">
                  <input className="input-field" value={agentName} placeholder="Sage"
                    onChange={(e) => setAgentName(e.target.value)} maxLength={80} autoFocus />
                </Field>
                <Field label="Opening greeting" hint={`${greeting.length}/200 characters`}>
                  <textarea className="input-field resize-none" rows={3} value={greeting} maxLength={200}
                    placeholder="Hi! Thanks for calling..."
                    onChange={(e) => setGreeting(e.target.value)} />
                </Field>
                {/* Preview */}
                <div className="p-4 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl">
                  <p className="font-display font-bold uppercase text-[9px] tracking-widest text-[var(--text-3)] mb-3 flex items-center gap-1.5">
                    <Mic size={11} className="text-[var(--accent)]" /> Call preview
                  </p>
                  <div className="flex gap-2 items-start">
                    <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0">
                      <Bot size={11} className="text-white" />
                    </div>
                    <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-[var(--accent-tint)] border border-[var(--accent)]/20 text-xs text-[var(--text-1)] leading-relaxed">
                      {greeting || 'Your greeting will appear here…'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: Knowledge ── */}
          {step === 3 && (
            <>
              <StepHead icon={Globe} eyebrow="Step 4 of 5" title="Add your franchise knowledge" sub="Paste your website or Instagram. We extract pricing, hours, and FAQs automatically." />
              <div className="mt-8 space-y-5">
                <Field label="Website or Instagram URL">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input className="input-field" value={url} placeholder="https://xpleague.com/frisco"
                      onChange={(e) => setUrl(e.target.value)} disabled={saving} autoFocus />
                    <button onClick={runScrape} disabled={saving}
                      className="btn-primary px-6 py-[9px] text-[11px] whitespace-nowrap justify-center">
                      {saving ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Scanning…</> : <>Scan Site</>}
                    </button>
                  </div>
                </Field>

                {scrapeResult && (
                  <div className="p-4 bg-[var(--live)]/10 border border-[var(--live)]/30 rounded-xl" style={{ animation: 'fade-up 0.3s ease-out both' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Check size={14} className="text-[var(--live)]" />
                      <span className="font-display font-bold uppercase text-[10px] tracking-widest text-[var(--live)]">
                        {scrapeResult.type === 'existing' ? 'Knowledge already added' : 'Knowledge extracted & saved'}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-2)] ml-6">
                      {scrapeResult.title ? `Imported “${scrapeResult.title}”. ` : ''}Your AI agent now knows your franchise details. You can refine this anytime in the Knowledge tab.
                    </p>
                  </div>
                )}

                <button onClick={() => { setSkippedKnowledge(true); setStep(s => s + 1) }}
                  className="font-display font-bold uppercase text-[10px] tracking-widest text-[var(--text-3)] hover:text-[var(--accent)] transition-colors">
                  I&apos;ll add this later →
                </button>
              </div>
            </>
          )}

          {/* ── Step 4: Launch ── */}
          {step === 4 && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-[var(--accent-tint)] border border-[var(--accent)]/20 flex items-center justify-center mx-auto mb-6 animate-bounce">
                <PartyPopper size={30} className="text-[var(--accent)]" />
              </div>
              <p className="font-display font-bold uppercase text-[10px] tracking-widest text-[var(--accent)] mb-3">You&apos;re all set</p>
              <h2 className="font-display font-bold text-3xl text-[var(--text-1)] mb-3">
                {bizName || 'Your franchise'} is ready to launch
              </h2>
              <p className="text-[var(--text-2)] max-w-md mx-auto mb-8">
                {agentName} is configured on the <span className="font-bold text-[var(--text-1)]">{selectedPlan.name}</span> plan.
                Wire up your phone number and go live — leads will flow into your dashboard automatically.
              </p>

              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto mb-8 text-left">
                {[
                  { icon: Crown, label: 'Plan', value: selectedPlan.name },
                  { icon: Building2, label: 'Franchise', value: bizName || '—' },
                  { icon: Bot, label: 'Agent', value: agentName || '—' },
                  { icon: Globe, label: 'Knowledge', value: scrapeResult && !skippedKnowledge ? 'Added' : skippedKnowledge ? 'Skipped' : (scrapeResult ? 'Added' : 'Pending') },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg">
                    <Icon size={13} className="text-[var(--accent)] mb-1.5" />
                    <p className="font-display uppercase text-[8px] tracking-widest text-[var(--text-3)]">{label}</p>
                    <p className="font-display font-bold text-[11px] text-[var(--text-1)] truncate">{value}</p>
                  </div>
                ))}
              </div>

              <button onClick={finish}
                className="btn-primary py-3.5 px-8 text-xs mx-auto group overflow-hidden relative shadow-[0_0_24px_rgba(232,93,63,0.3)]">
                <span className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-[scan-right_1.5s_ease-in-out_infinite]" />
                Go to Dashboard
                <ArrowRight size={15} className="ml-2 group-hover:translate-x-1.5 transition-transform" />
              </button>
              {selectedPlan.id !== 'starter' && (
                <p className="text-[10px] text-[var(--text-3)] font-display mt-4">
                  Billing for {selectedPlan.name} ({selectedPlan.price}{selectedPlan.period}) starts after your 14-day trial.
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {error && step !== 4 && (
            <div className="mt-6 text-[12px] text-[var(--danger)] border border-[var(--danger)]/40 bg-[var(--danger)]/5 rounded-md px-3 py-2.5" style={{ animation: 'fade-up 0.2s ease-out both' }}>
              {error}
            </div>
          )}

          {/* Footer nav (hidden on launch step) */}
          {step !== 4 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--border)]">
              <button onClick={back} disabled={step === 0 || saving}
                className={`flex items-center gap-1.5 font-display font-bold uppercase text-[10px] tracking-widest transition-colors ${step === 0 ? 'opacity-0 pointer-events-none' : 'text-[var(--text-2)] hover:text-[var(--accent)]'}`}>
                <ArrowLeft size={13} /> Back
              </button>

              <div className="flex items-center gap-4">
                {/* Step-specific skip — only on steps that have optional content */}
                {[1, 2, 3].includes(step) && (
                  <button
                    onClick={skipStep}
                    disabled={saving}
                    className="font-display font-bold uppercase text-[10px] tracking-widest text-[var(--text-3)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                  >
                    Skip
                  </button>
                )}
                <button onClick={next} disabled={saving}
                  className="btn-primary py-3 px-7 text-[11px] group overflow-hidden relative">
                  <span className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-[scan-right_1.5s_ease-in-out_infinite]" />
                  {saving ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Saving…</> : (
                    <>Continue <ArrowRight size={14} className="ml-1.5 group-hover:translate-x-1 transition-transform" /></>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tiny reassurance footer */}
        <p className="text-center text-[10px] text-[var(--text-3)] font-display mt-5">
          Signed in as {userEmail} · Your progress is saved automatically
        </p>
      </div>
    </div>
  )
}

/* ── Small presentational helpers ── */

function StepHead({ icon: Icon, eyebrow, title, sub }: { icon: React.ElementType; eyebrow: string; title: string; sub: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--accent-tint)] border border-[var(--accent)]/15 flex items-center justify-center">
          <Icon size={16} className="text-[var(--accent)]" />
        </div>
        <span className="font-display font-bold uppercase text-[9px] tracking-widest text-[var(--accent)]">{eyebrow}</span>
      </div>
      <h2 className="font-display font-bold text-2xl md:text-3xl tracking-tight text-[var(--text-1)] mb-2">{title}</h2>
      <p className="text-sm text-[var(--text-2)] max-w-lg">{sub}</p>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="font-display font-bold uppercase text-[9px] tracking-[0.18em] text-[var(--text-3)]">{label}</label>
        {hint && <span className="text-[10px] text-[var(--text-3)] font-display">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
