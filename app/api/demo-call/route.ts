import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const Schema = z.object({
  phone:    z.string().min(7, 'Enter a valid phone number').max(20),
  name:     z.string().max(80).optional(),
  interest: z.string().max(300).optional(),
})

const VAPI_API    = 'https://api.vapi.ai'
const VAPI_NUMBER = '+17076699278'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalize raw input to E.164 */
function toE164(raw: string): string {
  const clean = raw.replace(/[\s\-().]/g, '')
  if (clean.startsWith('+')) return clean
  if (/^[6-9]\d{9}$/.test(clean)) return `+91${clean}`   // India 10-digit
  if (/^\d{10}$/.test(clean))     return `+1${clean}`    // US/CA 10-digit
  if (/^1\d{10}$/.test(clean))    return `+${clean}`     // US with leading 1
  return `+${clean}`
}

/** True if not US or Canada */
function isInternational(e164: string): boolean {
  return !e164.startsWith('+1')
}

/** Vapi phone number ID cache (avoids repeated list calls) */
let cachedPhoneNumberId: string | null = null
type VapiPhoneNumber = { id: string; assistantId?: string; [key: string]: unknown }

async function resolveVapiPhoneNumberId(apiKey: string, assistantId: string): Promise<string | null> {
  if (process.env.VAPI_DEMO_PHONE_ID) return process.env.VAPI_DEMO_PHONE_ID
  if (cachedPhoneNumberId) return cachedPhoneNumberId

  const res = await fetch(`${VAPI_API}/phone-number?limit=100`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return null

  const raw  = await res.json() as VapiPhoneNumber[] | { results?: VapiPhoneNumber[] }
  const list = Array.isArray(raw) ? raw : (raw.results ?? [])
  const match = list.find(n => n.assistantId === assistantId) ?? list[0]
  if (!match) return null

  cachedPhoneNumberId = match.id
  return match.id
}

// ── Call strategies ───────────────────────────────────────────────────────────

/** US/CA: Vapi outbound — delivers custom firstMessage with caller context */
async function placeVapiCall(
  apiKey:        string,
  assistantId:   string,
  phoneNumberId: string,
  phone:         string,
  name?:         string,
  interest?:     string,
): Promise<string> {
  const greeting = name ? `Hi ${name}!` : `Hi there!`
  const ctx      = interest ? ` I can see you're interested in ${interest}.` : ''
  const firstMessage = `${greeting} This is Sage, the AI receptionist from Blueslate. You requested a live demo from our website.${ctx} Before we dive in — could I confirm your name and the best number to reach you? I want to make sure our team can follow up with you personally.`

  const res = await fetch(`${VAPI_API}/call`, {
    method: 'POST',
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

/**
 * International: Twilio bridges the call.
 * Twilio dials the user's number; when they pick up, TwiML connects them to
 * the Vapi demo line (+17076699278) so Sage handles the conversation.
 */
async function placeTwilioBridgeCall(phone: string): Promise<string> {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_PHONE_NUMBER

  if (!sid || !token || !from) throw new Error('Twilio credentials not configured')

  // TwiML: when user picks up, connect them straight into Vapi's demo line
  const twiml = `<Response><Dial>${VAPI_NUMBER}</Dial></Response>`

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, From: from, Twiml: twiml }).toString(),
      signal: AbortSignal.timeout(15_000),
    },
  )

  if (!res.ok) {
    const body = await res.json() as { message?: string; code?: number }
    // Code 21215 = geographic permission not enabled
    if (body.code === 21215) {
      throw new Error('International calling not enabled on this account — enable India in Twilio Geographic Permissions')
    }
    throw new Error(body.message ?? `Twilio call failed (${res.status})`)
  }

  return ((await res.json() as { sid: string }).sid)
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
    const phone  = toE164(parsed.data.phone)
    const intl   = isInternational(phone)

    const apiKey      = process.env.VAPI_API_KEY
    const assistantId = process.env.VAPI_ASSISTANT_ID

    if (!apiKey)      return NextResponse.json({ error: 'Voice service not configured' }, { status: 503 })
    if (!assistantId) return NextResponse.json({ error: 'Demo assistant not configured' }, { status: 503 })

    let callId: string

    if (intl) {
      // International → Twilio bridge → Vapi demo line
      callId = await placeTwilioBridgeCall(phone)
    } else {
      // US/CA → Vapi direct outbound with personalized firstMessage
      const phoneNumberId = await resolveVapiPhoneNumberId(apiKey, assistantId)
      if (!phoneNumberId) {
        return NextResponse.json(
          { error: 'No Vapi phone number found — try calling directly at +1 (707) 669-9278' },
          { status: 503 },
        )
      }
      callId = await placeVapiCall(apiKey, assistantId, phoneNumberId, phone, name, interest)
    }

    return NextResponse.json({ success: true, callId, method: intl ? 'twilio-bridge' : 'vapi' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[demo-call] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
