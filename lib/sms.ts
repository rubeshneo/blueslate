// SMS Nurture Pipeline
// Uses Twilio REST API if credentials are set, otherwise runs in mock/log mode.
// Add to .env.local to activate:
//   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   TWILIO_AUTH_TOKEN=your_auth_token
//   TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM  = process.env.TWILIO_PHONE_NUMBER

export interface SmsPayload {
  to:           string | null
  parentName:   string | null
  coreInterest: string | null
  bookingSlot:  string | null
  tenantName:   string
}

export interface SmsResult {
  success:    boolean
  provider:   'twilio' | 'mock'
  messageId?: string
  error?:     string
}

function buildMessage(p: SmsPayload): string {
  const name     = p.parentName   ?? 'there'
  const interest = p.coreInterest ?? 'our programs'

  if (p.bookingSlot) {
    const slot = new Date(p.bookingSlot).toLocaleString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
    return (
      `Hi ${name}! Your free trial at ${p.tenantName} is confirmed for ${slot}. ` +
      `We're excited to meet you! Questions? Just reply to this message.`
    )
  }

  return (
    `Hi ${name}! Thanks for your interest in ${interest} at ${p.tenantName}. ` +
    `We'd love to book a free trial. Reply YES to lock in a slot or call us anytime!`
  )
}

async function sendViaTwilio(to: string, body: string): Promise<SmsResult> {
  const url  = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM!, Body: body }),
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(`Twilio ${res.status}: ${err.message ?? 'Unknown error'}`)
  }

  const data = await res.json() as { sid: string }
  return { success: true, provider: 'twilio', messageId: data.sid }
}

export async function sendNurtureSms(payload: SmsPayload): Promise<SmsResult> {
  if (!payload.to) {
    console.warn('[SMS] No phone number — skipping nurture SMS')
    return { success: false, provider: 'mock', error: 'No phone number provided' }
  }

  const message = buildMessage(payload)

  // ── Live Twilio path ────────────────────────────────────────────
  if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
    try {
      const result = await sendViaTwilio(payload.to, message)
      console.log(`[SMS] Sent via Twilio → ${payload.to} | SID: ${result.messageId}`)
      return result
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown Twilio error'
      console.error('[SMS] Twilio dispatch failed:', error)
      return { success: false, provider: 'twilio', error }
    }
  }

  // ── Mock / sandbox path ─────────────────────────────────────────
  console.log(
    `[SMS Mock] TWILIO credentials not set.\n` +
    `Would send to: ${payload.to}\n` +
    `Message: ${message}`
  )
  return { success: true, provider: 'mock', messageId: `mock_${Date.now()}` }
}
