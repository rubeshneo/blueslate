import { supabaseAdmin } from '@/lib/supabase'

const VAPI_API = 'https://api.vapi.ai'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format scraped structured_data into a readable text block for the system prompt.
 */
export function buildContextBlock(d: Record<string, unknown>): string {
  const lines: string[] = []

  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? (v as unknown[]).map((x) => str(x)).filter(Boolean) : []

  if (str(d.business_name))   lines.push(`Business: ${str(d.business_name)}`)
  if (str(d.tagline))         lines.push(`Tagline: ${str(d.tagline)}`)
  if (str(d.description))     lines.push(`About: ${str(d.description)}`)

  const services = arr(d.services)
  if (services.length)        lines.push(`Services: ${services.join(', ')}`)

  const ages = arr(d.age_groups)
  if (ages.length)            lines.push(`Age Groups: ${ages.join(', ')}`)

  if (str(d.pricing))         lines.push(`Pricing: ${str(d.pricing)}`)
  if (str(d.hours))           lines.push(`Hours: ${str(d.hours)}`)
  if (str(d.location))        lines.push(`Location: ${str(d.location)}`)
  if (str(d.contact_phone))   lines.push(`Phone: ${str(d.contact_phone)}`)
  if (str(d.contact_email))   lines.push(`Email: ${str(d.contact_email)}`)

  const ksp = arr(d.key_selling_points)
  if (ksp.length)             lines.push(`Key Points: ${ksp.join(' | ')}`)

  if (str(d.booking_cta))     lines.push(`Booking: ${str(d.booking_cta)}`)

  const faqs = arr(d.faqs)
  if (faqs.length)            lines.push(`FAQs: ${faqs.join(' | ')}`)

  return lines.join('\n')
}

/**
 * Build a natural receptionist system prompt for a per-tenant Vapi assistant.
 * Same style as the Blueslate demo but scoped to the franchise's own context.
 */
export function buildTenantSystemPrompt(
  agentName: string,
  greeting: string,
  context: string,
): string {
  return `You are ${agentName}, the AI receptionist for this franchise business — speaking with customers on the phone.

PERSONALITY & TONE:
- Warm, helpful, and genuinely enthusiastic about this business
- This is a phone call: keep every response to 2-3 short sentences maximum
- Speak naturally — never use bullet points, lists, or markdown on a phone call
- Do NOT say you are an AI unless the caller directly asks

YOUR OPENING (say this when the call starts):
"${greeting}"

BUSINESS INFORMATION (use this to answer customer questions):
${context || 'No specific business information available — answer warmly and offer to have someone follow up.'}

LEAD CAPTURE (critical — do this naturally):
- When a caller shows interest in booking, pricing, programs, or visiting — ask for their contact details
- Say warmly: "That's great! I'd love to make sure someone follows up with you directly. Could I get your name and the best number to reach you?"
- Once collected, confirm: "Perfect, [name]! I've noted your details and our team will be in touch very shortly."
- Always repeat the phone number back to confirm accuracy

If asked something outside what you know, say warmly: "That's a great question — let me make sure the right person follows up with you. Could I get your name and best contact number?"`
}

// ── Provisioning ──────────────────────────────────────────────────────────────

type VapiAssistantResponse = {
  id: string
  model?: { provider?: string; model?: string; [key: string]: unknown }
  voice?: Record<string, unknown>
  [key: string]: unknown
}

type VapiPhoneNumberResponse = {
  id: string
  number: string
  [key: string]: unknown
}

/**
 * Provision a new Vapi assistant + phone number for a tenant.
 * Clones the model/voice settings from the demo assistant (VAPI_ASSISTANT_ID).
 * Saves vapi_agent_id, vapi_phone_number_id, vapi_phone_number to the tenants row.
 */
export async function provisionTenantVapi(tenantId: string): Promise<{
  assistantId: string
  phoneNumberId: string
  phoneNumber: string
}> {
  const apiKey      = process.env.VAPI_API_KEY
  const demoId      = process.env.VAPI_ASSISTANT_ID
  if (!apiKey) throw new Error('VAPI_API_KEY is not configured')
  if (!demoId) throw new Error('VAPI_ASSISTANT_ID is not configured')

  // ── 1. Fetch tenant details ────────────────────────────────────────────────
  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .select('id, name, agent_name, agent_greeting')
    .eq('id', tenantId)
    .single()

  if (tenantErr || !tenant) {
    throw new Error(`Tenant not found: ${tenantId}`)
  }

  const agentName = (tenant.agent_name as string | null) ?? 'Sage'
  const greeting  = (tenant.agent_greeting as string | null)
    ?? `Thank you for calling ${tenant.name}! This is ${agentName}. How can I help you today?`

  // ── 2. Fetch demo assistant to clone model + voice settings ───────────────
  const demoRes = await fetch(`${VAPI_API}/assistant/${demoId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!demoRes.ok) {
    const err = await demoRes.text().catch(() => '')
    throw new Error(`Vapi GET demo assistant ${demoRes.status}: ${err.slice(0, 200)}`)
  }
  const demo = await demoRes.json() as VapiAssistantResponse

  // ── 3. Fetch tenant knowledge context for the initial system prompt ────────
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

  // ── 4. Create a new Vapi assistant (cloning voice + model from demo) ───────
  const existingModel = (demo.model ?? {}) as Record<string, unknown>
  const existingVoice = (demo.voice ?? {}) as Record<string, unknown>

  const createRes = await fetch(`${VAPI_API}/assistant`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name:         `${tenant.name} — ${agentName}`,
      firstMessage: greeting,
      model: {
        ...existingModel,
        messages: [{ role: 'system', content: systemPrompt }],
      },
      voice: existingVoice,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!createRes.ok) {
    const err = await createRes.text().catch(() => '')
    throw new Error(`Vapi POST assistant ${createRes.status}: ${err.slice(0, 300)}`)
  }

  const newAssistant = await createRes.json() as VapiAssistantResponse

  // ── 5. Buy a phone number linked to the new assistant ─────────────────────
  const phoneRes = await fetch(`${VAPI_API}/phone-number/buy`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider:    'vapi',
      areaCode:    '415',
      assistantId: newAssistant.id,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!phoneRes.ok) {
    const err = await phoneRes.text().catch(() => '')
    throw new Error(`Vapi buy phone-number ${phoneRes.status}: ${err.slice(0, 300)}`)
  }

  const phoneData = await phoneRes.json() as VapiPhoneNumberResponse

  // ── 6. Persist to DB ───────────────────────────────────────────────────────
  const { error: updateErr } = await supabaseAdmin
    .from('tenants')
    .update({
      vapi_agent_id:        newAssistant.id,
      vapi_phone_number_id: phoneData.id,
      vapi_phone_number:    phoneData.number,
    })
    .eq('id', tenantId)

  if (updateErr) throw updateErr

  return {
    assistantId:   newAssistant.id,
    phoneNumberId: phoneData.id,
    phoneNumber:   phoneData.number,
  }
}

// ── Outbound calls ────────────────────────────────────────────────────────────

type TenantOutboundRow = {
  vapi_agent_id:        string | null
  vapi_phone_number_id: string | null
  agent_name:           string | null
  name:                 string
}

/**
 * Trigger an outbound Vapi call on behalf of a tenant.
 * Uses the tenant's own assistant + phone number.
 */
export async function makeOutboundCall(
  tenantId: string,
  toNumber: string,
  toName?: string,
  interest?: string,
): Promise<{ callId: string }> {
  const apiKey = process.env.VAPI_API_KEY
  if (!apiKey) throw new Error('VAPI_API_KEY is not configured')

  // ── 1. Fetch tenant Vapi details ─────────────────────────────────────────
  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .select('vapi_agent_id, vapi_phone_number_id, agent_name, name')
    .eq('id', tenantId)
    .single()

  if (tenantErr || !tenant) {
    throw new Error(`Tenant not found: ${tenantId}`)
  }

  const row = tenant as TenantOutboundRow

  if (!row.vapi_agent_id || !row.vapi_phone_number_id) {
    throw new Error('Tenant has no Vapi assistant — provision first')
  }

  const agentName = row.agent_name ?? 'Sage'
  const callerDesc = toName ? toName : 'a customer'
  const interestNote = interest
    ? ` They previously expressed interest in: ${interest}.`
    : ''

  const firstMessage = `Hi${toName ? ` ${toName}` : ''}, this is ${agentName} calling from ${row.name}. I'm following up on your recent inquiry.${interestNote} Is now a good time to chat?`

  // ── 2. POST to Vapi /call ─────────────────────────────────────────────────
  type VapiCallResponse = { id: string; [key: string]: unknown }

  const callRes = await fetch(`${VAPI_API}/call`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assistantId:   row.vapi_agent_id,
      phoneNumberId: row.vapi_phone_number_id,
      customer: {
        number: toNumber,
        name:   callerDesc,
      },
      assistantOverrides: {
        firstMessage,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!callRes.ok) {
    const err = await callRes.text().catch(() => '')
    throw new Error(`Vapi POST call ${callRes.status}: ${err.slice(0, 300)}`)
  }

  const callData = await callRes.json() as VapiCallResponse

  return { callId: callData.id }
}
