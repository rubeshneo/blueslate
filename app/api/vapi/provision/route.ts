import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantId } from '@/lib/get-tenant'
import {
  provisionTenantVapi,
  importTwilioNumber,
  linkExistingVapiNumber,
} from '@/lib/vapi-provisioning'

const Schema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('new') }),
  z.object({
    mode:             z.literal('twilio'),
    twilioAccountSid: z.string().min(10, 'Enter your Twilio Account SID'),
    twilioAuthToken:  z.string().min(10, 'Enter your Twilio Auth Token'),
    twilioNumber:     z.string().min(7,  'Enter your Twilio phone number (e.g. +15551112222)'),
  }),
  z.object({
    mode:              z.literal('vapi_existing'),
    vapiPhoneNumberId: z.string().min(5, 'Enter your Vapi phone number ID'),
  }),
])

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

    const tenantId = await getTenantId()
    const input    = parsed.data
    let result

    if (input.mode === 'new') {
      result = await provisionTenantVapi(tenantId)
    } else if (input.mode === 'twilio') {
      result = await importTwilioNumber(
        tenantId,
        input.twilioAccountSid,
        input.twilioAuthToken,
        input.twilioNumber,
      )
    } else {
      result = await linkExistingVapiNumber(tenantId, input.vapiPhoneNumberId)
    }

    return NextResponse.json({
      success:     true,
      phoneNumber: result.phoneNumber,
      assistantId: result.assistantId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Vapi Provision] Error:', err)
    const status = message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
