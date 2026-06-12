import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { sendNurtureSms } from '@/lib/sms'

const TENANT_ID = process.env.TENANT_ID!

// Public endpoint hit from the marketing landing page. Captures inbound interest
// (callback requests, newsletter signups, and company access requests) as real
// leads so they surface on the dashboard exactly like a Vapi-sourced lead would.
const Schema = z.object({
  intent:   z.enum(['callback', 'newsletter', 'access_request']).default('callback'),
  name:     z.string().max(120).trim().optional(),
  phone:    z.string().max(40).trim().optional(),
  email:    z.string().email('Enter a valid email').max(160).trim().optional(),
  interest: z.string().max(300).trim().optional(),
  // ── B2B access-request fields (company wants the product) ──
  company:   z.string().max(160).trim().optional(),
  industry:  z.string().max(120).trim().optional(),
  locations: z.string().max(40).trim().optional(),
  plan:      z.string().max(40).trim().optional(),
  message:   z.string().max(1000).trim().optional(),
}).refine((v) => v.phone || v.email, {
  message: 'A phone number or email is required',
  path: ['email'],
})

const SOURCE_LABEL: Record<string, string> = {
  newsletter:      'Newsletter signup',
  access_request:  'Company access request',
  callback:        'Website demo request',
}

export async function POST(req: NextRequest) {
  try {
    const parsed = Schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const { intent, name, phone, email, interest, company, industry, locations, plan, message } = parsed.data

    const now = new Date().toISOString()
    const source = SOURCE_LABEL[intent] ?? SOURCE_LABEL.callback

    // Build a human-readable interest summary for the dashboard column.
    const interestText =
      intent === 'access_request'
        ? [company && `${company}`, industry, locations && `${locations} location(s)`, plan && `${plan} plan`]
            .filter(Boolean).join(' · ') || 'Company access request'
        : (interest || source)

    const transcript =
      `[${source}] Submitted via blueslate.ai landing page.\n` +
      `Contact: ${name ?? '—'} | Phone: ${phone ?? '—'} | Email: ${email ?? '—'}\n` +
      (intent === 'access_request'
        ? `Company: ${company ?? '—'} | Industry: ${industry ?? '—'} | Locations: ${locations ?? '—'} | Interested plan: ${plan ?? '—'}\n` +
          `Message: ${message ?? '—'}`
        : `Interest: ${interestText}`)

    // Mirror the real pipeline: a call_log row anchors the lead's FK.
    const { data: callLog, error: logErr } = await supabaseAdmin
      .from('call_logs')
      .insert({
        tenant_id:       TENANT_ID,
        vapi_call_id:    crypto.randomUUID(),
        caller_number:   phone ?? null,
        started_at:      now,
        ended_at:        now,
        full_transcript: transcript,
        status:          'completed',
      })
      .select('id')
      .single()

    if (logErr) throw logErr

    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('leads')
      .insert({
        tenant_id:     TENANT_ID,
        call_log_id:   callLog.id,
        caller_name:   name || company || (email ? email.split('@')[0] : null),
        caller_phone:  phone ?? null,
        core_interest: interestText,
        parsed_at:     now,
        raw_parsed_json: { source, intent, email: email ?? null, company, industry, locations, plan, message },
      })
      .select('id')
      .single()

    if (leadErr) throw leadErr

    // Fire a confirmation SMS for callback + access requests (mock-safe if Twilio unset). Non-blocking.
    if ((intent === 'callback' || intent === 'access_request') && phone) {
      void (async () => {
        try {
          const { data: tenant } = await supabaseAdmin
            .from('tenants').select('name').eq('id', TENANT_ID).single()
          await sendNurtureSms({
            to: phone,
            parentName: name ?? null,
            coreInterest: interestText,
            bookingSlot: null,
            tenantName: tenant?.name ?? 'Blueslate AI',
          })
        } catch (e) {
          console.error('[DEMO_REQUEST_SMS_ERROR]:', e)
        }
      })()
    }

    return NextResponse.json({ success: true, lead_id: lead.id })
  } catch (err: unknown) {
    const e = err as { message?: string; details?: string; code?: string }
    const message = e?.message || (err instanceof Error ? err.message : 'Unknown error')
    const details = e?.details || ''
    const code = e?.code || ''
    console.error('[DEMO_REQUEST_ERROR]:', err)
    return NextResponse.json({ error: `${message} ${details} ${code}`.trim() }, { status: 500 })
  }
}
