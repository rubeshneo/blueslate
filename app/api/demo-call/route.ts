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

  // Check if already imported into Vapi
  const list     = await listVapiNumbers(apiKey)
  const existing = list.find(n =>
    n.provider === 'twilio' &&
    (n.number === twilioNumber || n.twilioPhoneNumber === twilioNumber),
  )
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
  // Fallback for custom questions
  return "That's a great question — let me answer that for you."
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

  // Lead with the interest directly so Sage immediately addresses their question
  const firstMessage = interest
    ? `${greeting} This is Sage from Blueslate AI. You reached out wanting to know about "${interest}" — let me walk you right through that. ${getInterestOpener(interest)} Also, could I grab your name and best contact number so our team can follow up with you personally?`
    : `${greeting} This is Sage from Blueslate AI. You just requested a live demo from our website. I'd love to show you how our AI receptionist works for franchise businesses. Could I start by confirming your name and the best number to reach you?`

  const res = await fetch(`${VAPI_API}/call`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assistantId,
      phoneNumberId,
      customer: { number: phone, name: name ?? 'Demo Visitor' },
      assistantOverrides: { firstMessage },
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
