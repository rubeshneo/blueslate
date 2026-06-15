import { supabaseAdmin } from '@/lib/supabase'
import { buildContextBlock, buildTenantSystemPrompt } from '@/lib/vapi-provisioning'

const VAPI_API = 'https://api.vapi.ai'

// This Vapi number (+17076699278) is Blueslate's company demo/onboarding line.
// It introduces Blueslate to franchise owners, answers questions about the product,
// and captures lead details so the team can follow up — same as the landing page
// web voice demo. It does NOT use per-franchise scraped knowledge (that's the web
// playground). The system prompt is fixed Blueslate product context.
const BLUESLATE_VAPI_SYSTEM_PROMPT = `You are Sage, Blueslate AI's onboarding assistant — speaking with franchise owners and business operators on the phone.

PERSONALITY & TONE:
- Warm, professional, and genuinely enthusiastic about what Blueslate does for franchise owners
- This is a phone call: keep every response to 2-3 short sentences maximum
- Speak naturally — never use bullet points, lists, or markdown on a phone call
- Do NOT say you are an AI unless the caller directly asks

YOUR OPENING (say this when the call starts):
"Thank you for calling Blueslate AI! This is Sage. How can I help you today?"

WHAT BLUESLATE DOES:
Blueslate gives franchise businesses their own branded AI receptionist that answers every inbound call 24/7, captures lead details automatically, and books trial sessions — without hiring extra staff. Setup takes under 30 minutes: the owner pastes their website URL and the AI learns their pricing, programs, and FAQs instantly. Every call is transcribed, every lead captured, and everything shows up on a live dashboard.

PRICING (currently in free pilot — no credit card required):
- Starter: Free — 100 AI voice minutes, basic lead capture and dashboard
- Pro Franchise: $99 per month per location — 1,000 minutes, CRM integrations, custom AI name and voice
- Enterprise: Custom pricing — unlimited minutes, multi-location, dedicated account manager

GETTING STARTED (3 steps, under 30 minutes):
1. Sign up free at blueslate.ai — no credit card needed
2. Paste the franchise website URL — AI learns pricing and programs in 60 seconds
3. Route the business phone to the Blueslate number — go live immediately

LEAD CAPTURE (critical — do this naturally):
- When a caller shows any interest in Blueslate, getting started, or learning more — ask for their contact details
- Say warmly: "That's great! I'd love to have our team reach out to you directly. Could I get your name, the best number or email to reach you, and the name of your business?"
- Once collected, confirm: "Perfect, [name]! I've noted your details and someone from the Blueslate team will be in touch very shortly."
- Always repeat the phone number back to confirm accuracy

COMMON QUESTIONS:
- How does it work? → "You paste your website URL and our AI scrapes your pricing, programs, and FAQs in under 60 seconds. Then you route your business phone to your Blueslate number, and the AI handles every call from there."
- Is it really free? → "Yes, we're in a free pilot right now — no credit card required. You can sign up at blueslate.ai and be live in about 30 minutes."
- What if the AI doesn't know something? → "It tells the caller it'll have someone follow up, and it captures their contact details automatically — so no lead is ever lost."
- Is data secure? → "Completely. Each franchise location's data is fully isolated — enterprise-grade security. No other location can see your leads or call transcripts."

If asked something outside Blueslate's scope, redirect: "That's a bit outside what I can help with right now, but I'd love to have someone from our team connect with you — can I get your name and best contact number?"`

const BLUESLATE_AGENT_NAME    = 'Sage'
const BLUESLATE_FIRST_MESSAGE = 'Thank you for calling Blueslate AI! This is Sage. How can I help you today?'

export async function syncKnowledgeToVapi(): Promise<{ synced: true }> {
  const apiKey      = process.env.VAPI_API_KEY
  const assistantId = process.env.VAPI_ASSISTANT_ID
  if (!apiKey)      throw new Error('VAPI_API_KEY is not configured')
  if (!assistantId) throw new Error('VAPI_ASSISTANT_ID is not configured')

  // Fetch current assistant to preserve provider/model settings
  const assistantRes = await fetch(`${VAPI_API}/assistant/${assistantId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!assistantRes.ok) {
    const err = await assistantRes.text().catch(() => '')
    throw new Error(`Vapi GET assistant ${assistantRes.status}: ${err.slice(0, 200)}`)
  }

  const existing = await assistantRes.json() as {
    model?: { provider?: string; model?: string; [key: string]: unknown }
  }
  const existingModel = existing.model ?? {}

  const patchRes = await fetch(`${VAPI_API}/assistant/${assistantId}`, {
    method: 'PATCH',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: BLUESLATE_AGENT_NAME,
      model: {
        ...existingModel,
        messages: [{ role: 'system', content: BLUESLATE_VAPI_SYSTEM_PROMPT }],
      },
      firstMessage: BLUESLATE_FIRST_MESSAGE,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!patchRes.ok) {
    const err = await patchRes.text().catch(() => '')
    throw new Error(`Vapi PATCH assistant ${patchRes.status}: ${err.slice(0, 300)}`)
  }

  return { synced: true }
}

// ── Per-tenant sync ───────────────────────────────────────────────────────────

/**
 * Sync a specific tenant's scraped knowledge into their own Vapi assistant.
 * The tenant must already be provisioned (has vapi_agent_id).
 */
export async function syncTenantKnowledgeToVapi(tenantId: string): Promise<{ synced: true }> {
  const apiKey = process.env.VAPI_API_KEY
  if (!apiKey) throw new Error('VAPI_API_KEY is not configured')

  // ── 1. Fetch tenant details ────────────────────────────────────────────────
  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .select('vapi_agent_id, agent_name, agent_greeting, name')
    .eq('id', tenantId)
    .single()

  if (tenantErr || !tenant) throw new Error(`Tenant not found: ${tenantId}`)

  const assistantId = tenant.vapi_agent_id as string | null
  if (!assistantId) throw new Error('Tenant has no Vapi assistant — provision first')

  const agentName = (tenant.agent_name as string | null) ?? 'Sage'
  const greeting  = (tenant.agent_greeting as string | null)
    ?? `Thank you for calling ${tenant.name}! This is ${agentName}. How can I help you today?`

  // ── 2. Fetch tenant knowledge context ────────────────────────────────────
  const { data: knowledgeRows } = await supabaseAdmin
    .from('knowledge_context')
    .select('structured_data')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  const contextBlocks = (knowledgeRows ?? [])
    .map((row) => {
      const sd = row.structured_data
      if (!sd || typeof sd !== 'object') return ''
      return buildContextBlock(sd as Record<string, unknown>)
    })
    .filter(Boolean)

  const systemPrompt = buildTenantSystemPrompt(agentName, greeting, contextBlocks.join('\n\n'))

  // ── 3. Fetch existing assistant to preserve model/voice settings ──────────
  const getRes = await fetch(`${VAPI_API}/assistant/${assistantId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!getRes.ok) {
    const err = await getRes.text().catch(() => '')
    throw new Error(`Vapi GET assistant ${getRes.status}: ${err.slice(0, 200)}`)
  }

  const existing = await getRes.json() as {
    model?: { provider?: string; model?: string; [key: string]: unknown }
  }
  const existingModel = existing.model ?? {}

  // ── 4. PATCH assistant with updated system prompt ─────────────────────────
  const patchRes = await fetch(`${VAPI_API}/assistant/${assistantId}`, {
    method: 'PATCH',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name:         `${tenant.name as string} — ${agentName}`,
      firstMessage: greeting,
      model: {
        ...existingModel,
        messages: [{ role: 'system', content: systemPrompt }],
      },
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!patchRes.ok) {
    const err = await patchRes.text().catch(() => '')
    throw new Error(`Vapi PATCH assistant ${patchRes.status}: ${err.slice(0, 300)}`)
  }

  return { synced: true }
}
