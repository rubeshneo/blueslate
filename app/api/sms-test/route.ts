import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendNurtureSms } from '@/lib/sms'

// Dev utility to verify the Twilio SMS path end-to-end.
// Usage: POST /api/sms-test  { "to": "+1XXXXXXXXXX" }
// Returns { provider: 'twilio' | 'mock', success, messageId? } so you can
// confirm credentials are live without making a real call or filling a form.
//
// Disabled in production unless ALLOW_SMS_TEST=true to avoid abuse.
const Schema = z.object({
  to: z.string().min(8, 'Provide a phone number in E.164 format, e.g. +14155552671').max(40),
  name: z.string().max(80).optional(),
})

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SMS_TEST !== 'true') {
    return NextResponse.json({ error: 'sms-test is disabled in production' }, { status: 403 })
  }

  const parsed = Schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }
  const { to, name } = parsed.data

  const configured = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER,
  )

  const result = await sendNurtureSms({
    to,
    parentName: name ?? 'there',
    coreInterest: 'a Blueslate SMS test',
    bookingSlot: null,
    tenantName: 'Blueslate AI',
  })

  return NextResponse.json({
    twilioConfigured: configured,
    ...result,
    hint: configured
      ? (result.success
          ? 'SMS dispatched. If you did not receive it on a Twilio trial, verify the destination number under Console → Verified Caller IDs.'
          : 'Twilio rejected the send — see "error". Common cause: destination not verified (trial) or wrong From number.')
      : 'Running in mock mode — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env.local to send for real.',
  })
}
