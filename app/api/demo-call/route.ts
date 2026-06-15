import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const Schema = z.object({
  phone:    z.string().min(7, 'Enter a valid phone number').max(20),
  name:     z.string().max(80).optional(),
  interest: z.string().max(300).optional(),
})

const VAPI_API = 'https://api.vapi.ai'

// Cache the resolved phone number ID for the process lifetime (avoids repeated API calls)
let cachedPhoneNumberId: string | null = null

type VapiPhoneNumber = { id: string; assistantId?: string; number?: string; [key: string]: unknown }

async function resolvePhoneNumberId(apiKey: string, assistantId: string): Promise<string | null> {
  // 1. Prefer explicit env var
  if (process.env.VAPI_DEMO_PHONE_ID) return process.env.VAPI_DEMO_PHONE_ID

  // 2. Return cached value from a previous resolution
  if (cachedPhoneNumberId) return cachedPhoneNumberId

  // 3. Auto-resolve: find the phone number linked to the demo assistant
  const res = await fetch(`${VAPI_API}/phone-number?limit=100`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return null

  const list = await res.json() as VapiPhoneNumber[]
  const numbers = Array.isArray(list) ? list : (list as { results?: VapiPhoneNumber[] }).results ?? []

  // Match by assistantId first, then fall back to first available number
  const match = numbers.find(n => n.assistantId === assistantId) ?? numbers[0]
  if (!match) return null

  cachedPhoneNumberId = match.id
  return match.id
}

const FIRST_MESSAGE = (name?: string, interest?: string) => {
  const greeting = name ? `Hi ${name}!` : `Hi there!`
  const context  = interest
    ? ` I can see you're interested in ${interest}.`
    : ''
  return `${greeting} This is Sage, the AI receptionist from Blueslate. You requested a live demo from our website.${context} Before we get into it — could I confirm your name and the best phone number to reach you? I want to make sure we capture your details so our team can follow up with you personally.`
}

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
    // Normalize to E.164 — Vapi requires this format
    let phone = parsed.data.phone.replace(/[\s\-().]/g, '')
    if (!phone.startsWith('+')) {
      // 10-digit Indian mobile (starts with 6-9)
      if (/^[6-9]\d{9}$/.test(phone)) phone = `+91${phone}`
      // 10-digit US/Canada
      else if (/^\d{10}$/.test(phone)) phone = `+1${phone}`
      // 11-digit starting with 1 (US with leading 1)
      else if (/^1\d{10}$/.test(phone)) phone = `+${phone}`
      else phone = `+${phone}` // best effort
    }

    const apiKey      = process.env.VAPI_API_KEY
    const assistantId = process.env.VAPI_ASSISTANT_ID

    if (!apiKey)      return NextResponse.json({ error: 'Voice service not configured' }, { status: 503 })
    if (!assistantId) return NextResponse.json({ error: 'Demo assistant not configured' }, { status: 503 })

    const phoneNumberId = await resolvePhoneNumberId(apiKey, assistantId)
    if (!phoneNumberId) {
      return NextResponse.json(
        { error: 'No phone number found — please call us directly at +1 (707) 669-9278' },
        { status: 503 },
      )
    }

    type VapiCallResponse = { id: string; [key: string]: unknown }

    const res = await fetch(`${VAPI_API}/call`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistantId,
        phoneNumberId,
        customer: {
          number: phone,
          name:   name ?? 'Demo Visitor',
        },
        assistantOverrides: {
          firstMessage: FIRST_MESSAGE(name, interest),
        },
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error('[demo-call] Vapi error:', res.status, errBody)
      let vapiMsg = ''
      try { vapiMsg = (JSON.parse(errBody) as { message?: string; error?: string }).message ?? (JSON.parse(errBody) as { message?: string; error?: string }).error ?? '' } catch { /* ignore */ }
      return NextResponse.json(
        { error: vapiMsg || `Call failed (${res.status}) — try calling directly at +1 (707) 669-9278` },
        { status: 502 },
      )
    }

    const data = await res.json() as VapiCallResponse
    return NextResponse.json({ success: true, callId: data.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[demo-call] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
