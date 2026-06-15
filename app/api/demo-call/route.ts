import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const Schema = z.object({
  phone:    z.string().min(7, 'Enter a valid phone number').max(20),
  name:     z.string().max(80).optional(),
  interest: z.string().max(300).optional(),
})

const VAPI_API = 'https://api.vapi.ai'

// ── Phone normalization ───────────────────────────────────────────────────────

function toE164(raw: string): string {
  const clean = raw.replace(/[\s\-().]/g, '')
  if (clean.startsWith('+')) return clean
  if (/^[6-9]\d{9}$/.test(clean)) return `+91${clean}`  // India
  if (/^\d{10}$/.test(clean))     return `+1${clean}`   // US/CA
  if (/^1\d{10}$/.test(clean))    return `+${clean}`
  return `+${clean}`
}

function isInternational(e164: string): boolean {
  return !e164.startsWith('+1')
}

// ── Vapi phone number helpers ─────────────────────────────────────────────────

type VapiPhoneNumber = {
  id:                 string
  provider?:          string
  number?:            string
  assistantId?:       string
  twilioPhoneNumber?: string
  [key: string]:      unknown
}

let cachedUsPhoneId:   string | null = null
let cachedIntlPhoneId: string | null = null
let cachedDemoModel:   { provider: string; model: string } | null = null

/** Fetch demo assistant's model provider+name once, then cache — needed for valid model override */
async function getDemoModel(apiKey: string, assistantId: string): Promise<{ provider: string; model: string } | null> {
  if (cachedDemoModel) return cachedDemoModel
  const res = await fetch(`${VAPI_API}/assistant/${assistantId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return null
  const data = await res.json() as { model?: { provider?: string; model?: string } }
  if (!data.model?.provider) return null
  cachedDemoModel = { provider: data.model.provider, model: data.model.model ?? 'gpt-4o' }
  return cachedDemoModel
}

async function listVapiNumbers(apiKey: string): Promise<VapiPhoneNumber[]> {
  const res = await fetch(`${VAPI_API}/phone-number?limit=100`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return []
  const raw = await res.json() as VapiPhoneNumber[] | { results?: VapiPhoneNumber[] }
  return Array.isArray(raw) ? raw : (raw.results ?? [])
}

/** US/CA: find the Vapi-hosted number linked to the demo assistant */
async function resolveUsPhoneId(apiKey: string, assistantId: string): Promise<string | null> {
  if (process.env.VAPI_DEMO_PHONE_ID) return process.env.VAPI_DEMO_PHONE_ID
  if (cachedUsPhoneId) return cachedUsPhoneId
  const list  = await listVapiNumbers(apiKey)
  const match = list.find(n => n.assistantId === assistantId && n.provider !== 'twilio')
             ?? list.find(n => n.provider !== 'twilio')
             ?? list[0]
  if (!match) return null
  cachedUsPhoneId = match.id
  return match.id
}

/**
 * International: get or auto-import the Twilio number into Vapi.
 * Vapi routes the call through Twilio infrastructure (supports international)
 * while handling the full AI conversation — personalized greeting, context, etc.
 */
async function resolveIntlPhoneId(apiKey: string, assistantId: string): Promise<string> {
  if (process.env.VAPI_TWILIO_PHONE_ID) return process.env.VAPI_TWILIO_PHONE_ID
  if (cachedIntlPhoneId) return cachedIntlPhoneId

  const twilioSid    = process.env.TWILIO_ACCOUNT_SID
  const twilioToken  = process.env.TWILIO_AUTH_TOKEN
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER

  if (!twilioSid || !twilioToken || !twilioNumber) {
    throw new Error('Twilio credentials not configured for international calls')
  }

  // Normalize to digits-only for comparison — Vapi may store numbers in a
  // different format than the env var (e.g. with/without +, spaces, dashes)
  const digitsOnly = (n: string) => n.replace(/\D/g, '')

  // Check if already imported into Vapi
  const list = await listVapiNumbers(apiKey)
  const existing = list.find(n => {
    if (n.provider !== 'twilio') return false
    const stored = String(n.number ?? n.twilioPhoneNumber ?? '')
    return digitsOnly(stored) === digitsOnly(twilioNumber)
  })
  if (existing) {
    cachedIntlPhoneId = existing.id
    return existing.id
  }

  // Import the Twilio number — Vapi routes all outbound calls through it
  const importRes = await fetch(`${VAPI_API}/phone-number`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider:         'twilio',
      number:           twilioNumber,
      twilioAccountSid: twilioSid,
      twilioAuthToken:  twilioToken,
      assistantId,
    }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!importRes.ok) {
    const errBody = await importRes.text().catch(() => '')
    let msg = ''
    try { msg = (JSON.parse(errBody) as { message?: string }).message ?? '' } catch { /* noop */ }

    // If Vapi says it's already imported (duplicate), find it in the list by provider
    const isDuplicate = importRes.status === 409
      || msg.toLowerCase().includes('already')
      || msg.toLowerCase().includes('exist')
    if (isDuplicate) {
      const retry = await listVapiNumbers(apiKey)
      const found = retry.find(n => n.provider === 'twilio')
      if (found) {
        cachedIntlPhoneId = found.id
        return found.id
      }
    }

    throw new Error(msg || `Could not import Twilio number into Vapi (${importRes.status})`)
  }

  const imported = await importRes.json() as VapiPhoneNumber
  cachedIntlPhoneId = imported.id
  return imported.id
}

// ── Interest-aware openers ────────────────────────────────────────────────────

function getInterestOpener(interest: string): string {
  const i = interest.toLowerCase()
  if (i.includes('pric'))      return "We're completely free during our pilot — no credit card needed. After that, plans start at $99 per location per month, which covers 1,000 AI voice minutes and full lead capture."
  if (i.includes('multi'))     return "Blueslate is built for multi-location from day one — every location gets its own AI agent, phone number, and dashboard, all under a single account."
  if (i.includes('lead'))      return "Every call is transcribed automatically. The caller's name, number, and interest are extracted and logged to your dashboard in under 60 seconds — no manual entry."
  if (i.includes('fast') || i.includes('live')) return "Most franchise owners are live in under 30 minutes. You paste your website URL, the AI scrapes your pricing and FAQs in about 60 seconds, then you route your business phone — that's it."
  if (i.includes('recept'))    return "Blueslate replaces the need for a human to answer the phone. The AI handles every call 24/7 — after hours, weekends, peak times — and captures every lead automatically."
  // "What is Blueslate" / general usefulness questions
  if (i.includes('what') || i.includes('blueslate') || i.includes('useful') || i.includes('use') || i.includes('help') || i.includes('work'))
    return "That's a great question — Blueslate is an AI receptionist built for franchise businesses. It picks up every inbound call 24/7, captures the caller's name, phone, and interest automatically, and logs it to your lead dashboard in under 60 seconds — so you never miss a customer even when you're busy."
  // Generic fallback — acknowledge then answer
  return "That's a great question — Blueslate is an AI voice receptionist for franchise businesses. It handles every call 24/7, captures leads automatically, and most owners are live in under 30 minutes — completely free during the pilot."
}

// ── Demo system prompt — overrides the base assistant for outbound context ────

function buildDemoSystemPrompt(name?: string, interest?: string): string {
  return `You are Sage, Blueslate AI's live demo agent — speaking with ${name ?? 'a prospect'} on the phone.

CONTEXT: They requested a live outbound demo from our website.${interest ? ` They specifically want to know about: "${interest}".` : ''}

CRITICAL RULES:
- DO NOT ask for their name or phone number — you already have it, the lead is captured
- DO NOT say "I'll have someone follow up" or "our team will reach out" — YOU are the follow-up
- You ARE the AI receptionist — demonstrate the product by being it
- Keep every response to 2–3 short sentences (this is a phone call)
- Never use bullet points, lists, or markdown on a phone call

YOUR JOB: Answer their questions about Blueslate AI confidently and helpfully.

BLUESLATE FACTS:
- Free pilot, no credit card required. After pilot: $99/location/month (1,000 voice minutes + full lead capture)
- Setup takes under 30 minutes — paste a website URL, AI scrapes pricing/FAQs in ~60 seconds, then route your business phone
- Built for franchise businesses — every location gets its own AI agent, phone number, and dashboard
- AI answers every call 24/7 including after hours and weekends, captures caller name/number/interest automatically
- Powered by Vapi + Groq — natural-sounding voice AI that handles interruptions and follow-up questions

CONVERSATION FLOW:
1. Address their specific interest directly (it's already in your opening message)
2. Answer any follow-up questions
3. When they're satisfied: "You can start free at blueslate.ai — most franchise owners are live in under 30 minutes"
4. Close warmly`
}

// ── Vapi outbound call — full AI experience ───────────────────────────────────

async function placeVapiCall(
  apiKey:        string,
  assistantId:   string,
  phoneNumberId: string,
  phone:         string,
  name?:         string,
  interest?:     string,
): Promise<string> {
  const greeting = name ? `Hi ${name}!` : `Hi there!`

  // Lead directly with the interest answer — no contact-info ask (we already have it)
  const firstMessage = interest
    ? `${greeting} This is Sage from Blueslate AI. You asked about "${interest}" — ${getInterestOpener(interest)} What else can I answer for you?`
    : `${greeting} This is Sage from Blueslate AI, calling back from our website demo. I'm here to answer any questions about our AI receptionist platform for franchise businesses. What would you like to know?`

  // Vapi requires provider+model when overriding the model object — fetch once, then use cached
  const demoModel = await getDemoModel(apiKey, assistantId)

  const modelOverride = demoModel
    ? {
        provider: demoModel.provider,
        model:    demoModel.model,
        messages: [{ role: 'system', content: buildDemoSystemPrompt(name, interest) }],
      }
    : undefined

  const res = await fetch(`${VAPI_API}/call`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assistantId,
      phoneNumberId,
      customer: { number: phone, name: name ?? 'Demo Visitor' },
      assistantOverrides: {
        firstMessage,
        ...(modelOverride ? { model: modelOverride } : {}),
      },
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let msg = ''
    try { msg = (JSON.parse(body) as { message?: string }).message ?? '' } catch { /* noop */ }
    throw new Error(msg || `Vapi call failed (${res.status})`)
  }

  return ((await res.json() as { id: string }).id)
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json() as unknown
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      )
    }

    const { name, interest } = parsed.data
    const phone   = toE164(parsed.data.phone)
    const apiKey  = process.env.VAPI_API_KEY
    const asstId  = process.env.VAPI_ASSISTANT_ID

    if (!apiKey) return NextResponse.json({ error: 'Voice service not configured' }, { status: 503 })
    if (!asstId) return NextResponse.json({ error: 'Demo assistant not configured' }, { status: 503 })

    const phoneNumberId = isInternational(phone)
      ? await resolveIntlPhoneId(apiKey, asstId)
      : await resolveUsPhoneId(apiKey, asstId) ?? (() => { throw new Error('No Vapi phone number available') })()

    const callId = await placeVapiCall(apiKey, asstId, phoneNumberId, phone, name, interest)
    return NextResponse.json({
      success: true,
      callId,
      method: isInternational(phone) ? 'vapi-twilio-intl' : 'vapi',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[demo-call]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
