import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { chatStream, MODEL_FAST } from '@/lib/claude'

const TENANT_ID = process.env.TENANT_ID!

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

const PlaygroundSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000),
  history: z.array(
    z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })
  ).max(20).default([]),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = PlaygroundSchema.safeParse(await req.json())
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const { message, history } = parsed.data

    // ── Fetch ALL active knowledge contexts + agent identity in parallel ──
    const [{ data: entries }, { data: tenant }] = await Promise.all([
      supabaseAdmin
        .from('knowledge_context')
        .select('structured_data, source_url')
        .eq('tenant_id', TENANT_ID)
        .eq('is_active', true)
        .order('scraped_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('tenants')
        .select('agent_name, agent_greeting')
        .eq('id', TENANT_ID)
        .single(),
    ])

    const agentName     = tenant?.agent_name    ?? 'Blueslate AI'
    const agentGreeting = tenant?.agent_greeting ?? 'Hi! Thanks for calling. How can I help you today?'

    let context = 'No knowledge base has been added yet. Tell the user to go to the Knowledge page and scrape their franchise website first.'

    if (entries && entries.length > 0) {
      const blocks = entries
        .filter((e) => e.structured_data)
        .map((e, i) => {
          const label = `--- Source ${i + 1}: ${e.source_url ?? 'unknown'} ---`
          return `${label}\n${buildContextBlock(e.structured_data as Record<string, unknown>)}`
        })
      if (blocks.length > 0) context = blocks.join('\n\n')
    }

    const conversationHistory = (history ?? [])
      .slice(-8)
      .map((m) => `${m.role === 'user' ? 'Parent' : agentName}: ${m.content}`)
      .join('\n')

    const systemPrompt = `You are ${agentName}, an AI receptionist for a franchise.
Your greeting configuration: "${agentGreeting}"

You ONLY answer questions using the information in the Knowledge Base below. If asked something not covered, say you don't have that information and offer to have someone call them back.

Keep responses concise, warm, and professional. Never make up programs, prices, or facts not in the knowledge base.

=== KNOWLEDGE BASE ===
${context}
=== END KNOWLEDGE BASE ===`

    const fullPrompt = conversationHistory
      ? `${conversationHistory}\nParent: ${message}\n${agentName}:`
      : `Parent: ${message}\n${agentName}:`

    const stream = await chatStream(fullPrompt, 512, MODEL_FAST, systemPrompt)

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Agent-Name': agentName,
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        'Set-Cookie': `playground_tested_${TENANT_ID}=true; Path=/; Max-Age=31536000; SameSite=Lax`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: msg }, { status: 500 })
  }
}
