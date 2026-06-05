import { supabaseAdmin } from '@/lib/supabase'

const VAPI_API = 'https://api.vapi.ai'

function buildContextBlock(d: Record<string, unknown>): string {
  const parts: string[] = []
  if (d.business_name)  parts.push(`Business: ${d.business_name}`)
  if (d.tagline)        parts.push(`Tagline: ${d.tagline}`)
  if (d.description)    parts.push(`About: ${d.description}`)
  if (Array.isArray(d.services) && d.services.length)
    parts.push(`Programs/Services: ${(d.services as string[]).join(', ')}`)
  if (Array.isArray(d.age_groups) && d.age_groups.length)
    parts.push(`Age Groups: ${(d.age_groups as string[]).join(', ')}`)
  if (d.pricing)        parts.push(`Pricing: ${d.pricing}`)
  if (d.location)       parts.push(`Location: ${d.location}`)
  if (d.hours)          parts.push(`Hours: ${d.hours}`)
  if (d.contact_phone)  parts.push(`Phone: ${d.contact_phone}`)
  if (d.contact_email)  parts.push(`Email: ${d.contact_email}`)
  if (Array.isArray(d.key_selling_points) && d.key_selling_points.length)
    parts.push(`Key Selling Points:\n${(d.key_selling_points as string[]).map((p) => `  • ${p}`).join('\n')}`)
  if (d.booking_cta)    parts.push(`How to Book: ${d.booking_cta}`)
  if (Array.isArray(d.faqs) && d.faqs.length) {
    const lines = (d.faqs as { question: string; answer: string }[])
      .map((f) => `  Q: ${f.question}\n  A: ${f.answer}`)
    parts.push(`FAQs:\n${lines.join('\n')}`)
  }
  return parts.join('\n')
}

export function buildVapiSystemPrompt(
  entries: { structured_data: unknown; source_url: string | null }[],
  agentName: string,
  agentGreeting: string,
): string {
  const blocks = entries
    .filter((e) => e.structured_data)
    .map((e, i) => {
      const label = `--- Source ${i + 1}: ${e.source_url ?? 'unknown'} ---`
      return `${label}\n${buildContextBlock(e.structured_data as Record<string, unknown>)}`
    })

  const context = blocks.length > 0
    ? blocks.join('\n\n')
    : 'No knowledge base has been configured yet. Ask the caller to leave a message and a team member will follow up.'

  return `You are ${agentName}, an AI receptionist for a franchise business.

Your opening greeting: "${agentGreeting}"

INSTRUCTIONS:
- Answer questions ONLY using the Knowledge Base below
- If asked something not covered, say: "I don't have that information right now, but I can have someone from our team follow up with you."
- When a caller wants to book, register, or schedule — collect their full name, phone number, and preferred time slot, then confirm someone will follow up within 24 hours
- Keep responses concise, warm, and professional — this is a phone call, not a chat
- Never make up programs, prices, or facts not in the knowledge base
- If the caller leaves a phone number or name, repeat it back to confirm accuracy

=== KNOWLEDGE BASE ===
${context}
=== END KNOWLEDGE BASE ===`
}

export async function syncKnowledgeToVapi(tenantId: string): Promise<{ sourceCount: number }> {
  const apiKey      = process.env.VAPI_API_KEY
  const assistantId = process.env.VAPI_ASSISTANT_ID
  if (!apiKey)      throw new Error('VAPI_API_KEY is not configured')
  if (!assistantId) throw new Error('VAPI_ASSISTANT_ID is not configured')

  // Fetch current assistant config + knowledge + tenant identity in parallel
  const [assistantRes, { data: entries }, { data: tenant }] = await Promise.all([
    fetch(`${VAPI_API}/assistant/${assistantId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    }),
    supabaseAdmin
      .from('knowledge_context')
      .select('structured_data, source_url')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('scraped_at', { ascending: false })
      .limit(10),
    supabaseAdmin
      .from('tenants')
      .select('agent_name, agent_greeting')
      .eq('id', tenantId)
      .single(),
  ])

  if (!assistantRes.ok) {
    const err = await assistantRes.text().catch(() => '')
    throw new Error(`Vapi GET assistant ${assistantRes.status}: ${err.slice(0, 200)}`)
  }

  // Preserve existing provider/model — only replace messages + firstMessage
  const existing = await assistantRes.json() as {
    model?: { provider?: string; model?: string; [key: string]: unknown }
  }
  const existingModel = existing.model ?? {}

  const agentName     = tenant?.agent_name    ?? 'AI Receptionist'
  const agentGreeting = tenant?.agent_greeting ?? 'Hi! Thanks for calling. How can I help you today?'
  const systemPrompt  = buildVapiSystemPrompt(entries ?? [], agentName, agentGreeting)

  const patchRes = await fetch(`${VAPI_API}/assistant/${assistantId}`, {
    method: 'PATCH',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: {
        ...existingModel,
        messages: [{ role: 'system', content: systemPrompt }],
      },
      firstMessage: agentGreeting,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!patchRes.ok) {
    const err = await patchRes.text().catch(() => '')
    throw new Error(`Vapi API ${patchRes.status}: ${err.slice(0, 300)}`)
  }

  return { sourceCount: (entries ?? []).length }
}
