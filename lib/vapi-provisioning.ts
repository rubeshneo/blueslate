import { supabaseAdmin } from '@/lib/supabase'
import type { BusinessHoursConfig } from '@/lib/supabase'
import { getRoleTemplate, type AgentRole } from '@/lib/agent-templates'

const VAPI_API = 'https://api.vapi.ai'

// Per-assistant webhook config so end-of-call-reports reach OUR webhook even when
// the org-level Server URL isn't set in the Vapi dashboard. Without this, calls to
// a freshly provisioned tenant assistant would never produce a call_log.
function tenantServerConfig(): Record<string, unknown> | undefined {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl || appUrl.includes('localhost')) return undefined // Vapi can't reach localhost
  const secret = process.env.VAPI_WEBHOOK_SECRET
  return {
    url: `${appUrl}/api/webhooks/vapi`,
    ...(secret ? { secret } : {}),
  }
}

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

// ── Business hours formatter ──────────────────────────────────────────────────

const DAY_NAMES: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}

function formatBusinessHours(bh: BusinessHoursConfig): string {
  const openDays = Object.entries(bh.hours)
    .filter(([, d]) => d.enabled)
    .map(([k, d]) => `${DAY_NAMES[k]} ${d.open}–${d.close}`)

  const lines: string[] = []
  if (openDays.length > 0) {
    lines.push(`BUSINESS HOURS (${bh.timezone}): ${openDays.join(', ')}`)
  }
  if (bh.after_hours_message) {
    lines.push(`AFTER-HOURS: If someone calls outside business hours, say: "${bh.after_hours_message}" — then offer to take their contact details for a morning callback.`)
  }
  return lines.join('\n')
}

/**
 * Build a natural receptionist system prompt for a per-tenant Vapi assistant.
 * Same style as the Blueslate demo but scoped to the franchise's own context.
 */
export function buildTenantSystemPrompt(
  agentName:     string,
  greeting:      string,
  context:       string,
  businessHours?: BusinessHoursConfig | null,
): string {
  const hoursSection = businessHours ? `\n${formatBusinessHours(businessHours)}\n` : ''

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
${hoursSection}
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

export type ProvisionResult = {
  assistantId:   string
  phoneNumberId: string
  phoneNumber:   string
}

// ── Shared helper: create a Vapi assistant for a tenant ──────────────────────
async function createAssistantForTenant(
  tenantId: string,
  apiKey:   string,
): Promise<{ assistant: VapiAssistantResponse; greeting: string }> {
  const demoId = process.env.VAPI_ASSISTANT_ID
  if (!demoId) throw new Error('VAPI_ASSISTANT_ID is not configured')

  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .select('id, name, agent_name, agent_greeting, business_hours')
    .eq('id', tenantId)
    .single()

  if (tenantErr || !tenant) throw new Error(`Tenant not found: ${tenantId}`)

  const agentName    = (tenant.agent_name    as string | null) ?? 'Sage'
  const greeting     = (tenant.agent_greeting as string | null)
    ?? `Thank you for calling ${tenant.name}! This is ${agentName}. How can I help you today?`
  const businessHours = (tenant.business_hours as BusinessHoursConfig | null) ?? null

  // Clone model/voice from demo assistant
  const demoRes = await fetch(`${VAPI_API}/assistant/${demoId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!demoRes.ok) {
    const err = await demoRes.text().catch(() => '')
    throw new Error(`Vapi GET demo assistant ${demoRes.status}: ${err.slice(0, 200)}`)
  }
  const demo = await demoRes.json() as VapiAssistantResponse

  const { data: knowledgeRows } = await supabaseAdmin
    .from('knowledge_context')
    .select('structured_data')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  const context = (knowledgeRows ?? [])
    .map((row) => {
      const sd = row.structured_data
      return sd && typeof sd === 'object' ? buildContextBlock(sd as Record<string, unknown>) : ''
    })
    .filter(Boolean)
    .join('\n\n')

  const systemPrompt = buildTenantSystemPrompt(agentName, greeting, context, businessHours)

  const serverConfig = tenantServerConfig()
  const createRes = await fetch(`${VAPI_API}/assistant`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name:         `${tenant.name} — ${agentName}`,
      firstMessage: greeting,
      // Stamp the tenant so the webhook can attribute calls even if assistant lookup ever fails.
      metadata:     { tenant_id: tenantId },
      ...(serverConfig ? { server: serverConfig } : {}),
      model: {
        ...((demo.model ?? {}) as Record<string, unknown>),
        messages: [{ role: 'system', content: systemPrompt }],
      },
      voice: (demo.voice ?? {}) as Record<string, unknown>,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!createRes.ok) {
    const err = await createRes.text().catch(() => '')
    throw new Error(`Vapi POST assistant ${createRes.status}: ${err.slice(0, 300)}`)
  }

  return { assistant: await createRes.json() as VapiAssistantResponse, greeting }
}

// Persist provisioning result to DB
async function saveTenantVapiConfig(
  tenantId:      string,
  assistantId:   string,
  phoneNumberId: string,
  phoneNumber:   string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('tenants')
    .update({ vapi_agent_id: assistantId, vapi_phone_number_id: phoneNumberId, vapi_phone_number: phoneNumber })
    .eq('id', tenantId)
  if (error) throw error
}

// ── Mode 1: Buy a new Vapi-hosted phone number ────────────────────────────────
export async function provisionTenantVapi(tenantId: string): Promise<ProvisionResult> {
  const apiKey = process.env.VAPI_API_KEY
  if (!apiKey) throw new Error('VAPI_API_KEY is not configured')

  const { assistant } = await createAssistantForTenant(tenantId, apiKey)

  const phoneRes = await fetch(`${VAPI_API}/phone-number/buy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'vapi', areaCode: '415', assistantId: assistant.id }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!phoneRes.ok) {
    // Clean up the assistant we just created
    await fetch(`${VAPI_API}/assistant/${assistant.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch(() => {})
    const err = await phoneRes.text().catch(() => '')
    throw new Error(`Vapi buy phone-number ${phoneRes.status}: ${err.slice(0, 300)}`)
  }

  const phoneData = await phoneRes.json() as VapiPhoneNumberResponse
  await saveTenantVapiConfig(tenantId, assistant.id, phoneData.id, phoneData.number)

  return { assistantId: assistant.id, phoneNumberId: phoneData.id, phoneNumber: phoneData.number }
}

// ── Mode 2: Import an existing Twilio number into Vapi ───────────────────────
export async function importTwilioNumber(
  tenantId:          string,
  twilioAccountSid:  string,
  twilioAuthToken:   string,
  twilioNumber:      string,
): Promise<ProvisionResult> {
  const apiKey = process.env.VAPI_API_KEY
  if (!apiKey) throw new Error('VAPI_API_KEY is not configured')

  const { assistant } = await createAssistantForTenant(tenantId, apiKey)

  // Import the Twilio number into Vapi
  const phoneRes = await fetch(`${VAPI_API}/phone-number`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider:         'twilio',
      number:           twilioNumber,
      twilioAccountSid,
      twilioAuthToken,
      assistantId:      assistant.id,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!phoneRes.ok) {
    await fetch(`${VAPI_API}/assistant/${assistant.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch(() => {})
    const err = await phoneRes.text().catch(() => '')
    throw new Error(`Vapi import Twilio number ${phoneRes.status}: ${err.slice(0, 300)}`)
  }

  const phoneData = await phoneRes.json() as VapiPhoneNumberResponse
  await saveTenantVapiConfig(tenantId, assistant.id, phoneData.id, phoneData.number)

  return { assistantId: assistant.id, phoneNumberId: phoneData.id, phoneNumber: phoneData.number }
}

// ── Mode 3: Use an existing Vapi phone number ID ──────────────────────────────
export async function linkExistingVapiNumber(
  tenantId:          string,
  vapiPhoneNumberId: string,
): Promise<ProvisionResult> {
  const apiKey = process.env.VAPI_API_KEY
  if (!apiKey) throw new Error('VAPI_API_KEY is not configured')

  const { assistant } = await createAssistantForTenant(tenantId, apiKey)

  // Get the existing number's actual phone number string
  const getNumRes = await fetch(`${VAPI_API}/phone-number/${vapiPhoneNumberId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!getNumRes.ok) {
    await fetch(`${VAPI_API}/assistant/${assistant.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch(() => {})
    throw new Error(`Vapi phone number ${vapiPhoneNumberId} not found`)
  }
  const existingPhone = await getNumRes.json() as VapiPhoneNumberResponse

  // Link the number to the new assistant
  const patchRes = await fetch(`${VAPI_API}/phone-number/${vapiPhoneNumberId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ assistantId: assistant.id }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!patchRes.ok) {
    await fetch(`${VAPI_API}/assistant/${assistant.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch(() => {})
    const err = await patchRes.text().catch(() => '')
    throw new Error(`Vapi PATCH phone-number ${patchRes.status}: ${err.slice(0, 300)}`)
  }

  await saveTenantVapiConfig(tenantId, assistant.id, vapiPhoneNumberId, existingPhone.number)

  return { assistantId: assistant.id, phoneNumberId: vapiPhoneNumberId, phoneNumber: existingPhone.number }
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
  overrideAgentVapiId?: string, // use a specific role agent's assistant (e.g. follow_up)
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

  // Outbound calls dial out through the tenant's number, but can be voiced by any
  // provisioned role agent (falls back to the tenant's main assistant).
  const assistantId = overrideAgentVapiId ?? row.vapi_agent_id
  if (!assistantId || !row.vapi_phone_number_id) {
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
      assistantId:   assistantId,
      phoneNumberId: row.vapi_phone_number_id,
      // Attribute the resulting end-of-call-report to this tenant (webhook reads call.metadata.tenant_id).
      metadata: { tenant_id: tenantId },
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

// ── Agent Library ───────────────────────────────────────────────────────────
// Multiple role-based AI callers per tenant (receptionist, follow-up, reminder…),
// each its own Vapi assistant, persisted in the `agents` table.

export interface TenantAgent {
  id:            string
  tenant_id:     string
  role:          string
  name:          string
  direction:     string
  vapi_agent_id: string | null
  is_active:     boolean
  created_at:    string
}

export async function listTenantAgents(tenantId: string): Promise<TenantAgent[]> {
  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id, tenant_id, role, name, direction, vapi_agent_id, is_active, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as TenantAgent[]
}

// Returns a provisioned, active assistant id for a role, or null if none exists.
export async function resolveAgentVapiId(tenantId: string, role: AgentRole): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('agents')
    .select('vapi_agent_id')
    .eq('tenant_id', tenantId)
    .eq('role', role)
    .eq('is_active', true)
    .not('vapi_agent_id', 'is', null)
    .maybeSingle()
  return (data?.vapi_agent_id as string | null) ?? null
}

// Provision (or re-provision) a role-based agent: builds the role's prompt from the
// tenant's knowledge, creates a dedicated Vapi assistant, and upserts the agents row.
export async function provisionAgentForTenant(tenantId: string, role: AgentRole): Promise<TenantAgent> {
  const apiKey = process.env.VAPI_API_KEY
  if (!apiKey) throw new Error('VAPI_API_KEY is not configured')
  const demoId = process.env.VAPI_ASSISTANT_ID
  if (!demoId) throw new Error('VAPI_ASSISTANT_ID is not configured')

  const template = getRoleTemplate(role)
  if (!template) throw new Error(`Unknown agent role: ${role}`)

  // Tenant identity + knowledge
  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .select('id, name, agent_name')
    .eq('id', tenantId)
    .single()
  if (tenantErr || !tenant) throw new Error(`Tenant not found: ${tenantId}`)

  const agentName    = template.defaultName || (tenant.agent_name as string | null) || 'Sage'
  const businessName = (tenant.name as string) || 'our business'

  const { data: knowledgeRows } = await supabaseAdmin
    .from('knowledge_context')
    .select('structured_data')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  const context = (knowledgeRows ?? [])
    .map((row) => {
      const sd = row.structured_data
      return sd && typeof sd === 'object' ? buildContextBlock(sd as Record<string, unknown>) : ''
    })
    .filter(Boolean)
    .join('\n\n')

  const ctx          = { agentName, businessName, context }
  const systemPrompt = template.systemPrompt(ctx)
  const firstMessage = template.firstMessage(ctx)

  // Clone model/voice from the demo assistant for consistent voice quality.
  const demoRes = await fetch(`${VAPI_API}/assistant/${demoId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!demoRes.ok) {
    const err = await demoRes.text().catch(() => '')
    throw new Error(`Vapi GET demo assistant ${demoRes.status}: ${err.slice(0, 200)}`)
  }
  const demo = await demoRes.json() as VapiAssistantResponse

  const serverConfig = tenantServerConfig()
  const createRes = await fetch(`${VAPI_API}/assistant`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name:         `${businessName} — ${template.label}`,
      firstMessage,
      metadata:     { tenant_id: tenantId, role },
      ...(serverConfig ? { server: serverConfig } : {}),
      model: {
        ...((demo.model ?? {}) as Record<string, unknown>),
        messages: [{ role: 'system', content: systemPrompt }],
      },
      voice: (demo.voice ?? {}) as Record<string, unknown>,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!createRes.ok) {
    const err = await createRes.text().catch(() => '')
    throw new Error(`Vapi POST assistant ${createRes.status}: ${err.slice(0, 300)}`)
  }
  const assistant = await createRes.json() as VapiAssistantResponse

  // Upsert the agents row (one per tenant+role).
  const { data: existing } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', role)
    .maybeSingle()

  const fields = {
    tenant_id:     tenantId,
    role,
    name:          agentName,
    direction:     template.direction,
    vapi_agent_id: assistant.id,
    first_message: firstMessage,
    is_active:     true,
    updated_at:    new Date().toISOString(),
  }

  let saved: TenantAgent
  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('agents').update(fields).eq('id', existing.id)
      .select('id, tenant_id, role, name, direction, vapi_agent_id, is_active, created_at').single()
    if (error) throw error
    saved = data as TenantAgent
  } else {
    const { data, error } = await supabaseAdmin
      .from('agents').insert(fields)
      .select('id, tenant_id, role, name, direction, vapi_agent_id, is_active, created_at').single()
    if (error) throw error
    saved = data as TenantAgent
  }

  return saved
}
