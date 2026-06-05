import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { parseTranscript } from '@/lib/claude'
import { supabaseAdmin } from '@/lib/supabase'
import { sendNurtureSms } from '@/lib/sms'

// ── HMAC signature verification ───────────────────────────────────────────────
// Vapi signs each webhook request with HMAC-SHA256 using VAPI_WEBHOOK_SECRET.
// Without this check any internet caller can inject fake leads.
function verifyVapiSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET
  if (!secret) return true // not configured → skip (dev / early stage)
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

// ── Fallback tenant resolution ─────────────────────────────────────────────
// Vapi metadata may omit tenant_id (misconfigured assistant, webhook replay, etc.).
// Rather than hard-failing with a 400, resolve against the configured default tenant
// to prevent the call log from being silently discarded.
async function resolveTenantId(
  fromMetadata: string | null,
  vapiCallId:   string | null,
): Promise<string | null> {
  if (fromMetadata) return fromMetadata

  // Attempt 1: env-var default (single-tenant deployments or dev)
  const envDefault = process.env.TENANT_ID ?? null
  if (envDefault) {
    console.warn(
      '[Vapi] tenant_id missing in webhook metadata — falling back to TENANT_ID env default',
      { vapiCallId, fallback: envDefault },
    )
    return envDefault
  }

  // Attempt 2: first active tenant in the database (last resort)
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (data?.id) {
    console.warn(
      '[Vapi] tenant_id missing — resolved from first active tenant record',
      { vapiCallId, resolved: data.id },
    )
    return data.id
  }

  return null
}

// Loop C: Automated Data Loop
// Vapi fires this webhook when a call ends → parse transcript → persist lead → fire nurture SMS
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-vapi-signature')

    if (!verifyVapiSignature(rawBody, signature)) {
      console.error('[Vapi] HMAC signature mismatch — request rejected', { signature })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const { message } = body

    if (!message || message.type !== 'end-of-call-report') {
      return NextResponse.json({ received: true })
    }

    const call          = message.call
    const transcript:   string = message.transcript     ?? ''
    const recordingUrl: string = message.recordingUrl   ?? null
    const startedAt:    string = call?.startedAt        ?? null
    const endedAt:      string = call?.endedAt          ?? null
    const callerNumber: string = call?.customer?.number ?? null
    const vapiCallId:   string = call?.id               ?? null

    const rawTenantId: string | null =
      message.metadata?.tenant_id ?? call?.metadata?.tenant_id ?? null

    // ── Tenant resolution with structured fallback ─────────────────
    const tenantId = await resolveTenantId(rawTenantId, vapiCallId)

    if (!tenantId) {
      console.error('[Vapi] tenant_id unresolvable — no metadata, no env default, no active tenant', { vapiCallId })
      return NextResponse.json(
        { error: 'tenant_id could not be resolved from metadata or fallback records' },
        { status: 400 },
      )
    }

    // ── Duration ────────────────────────────────────────────────────
    let durationSeconds: number | null = null
    if (startedAt && endedAt) {
      durationSeconds = Math.round(
        (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000,
      )
    }

    // ── Persist call log ────────────────────────────────────────────
    const { data: callLog, error: callLogError } = await supabaseAdmin
      .from('call_logs')
      .upsert(
        {
          tenant_id:        tenantId,
          vapi_call_id:     vapiCallId,
          caller_number:    callerNumber,
          started_at:       startedAt,
          ended_at:         endedAt,
          duration_seconds: durationSeconds,
          full_transcript:  transcript,
          recording_url:    recordingUrl,
          status:           'completed',
        },
        { onConflict: 'vapi_call_id' },
      )
      .select()
      .single()

    if (callLogError) throw callLogError
    console.log(`[Vapi] Call log persisted: ${callLog.id}`)

    // ── Lead extraction ─────────────────────────────────────────────
    if (transcript.length > 50) {
      const parsed = await parseTranscript(transcript)
      console.log(`[Vapi] Lead parsed → outcome: ${parsed.call_outcome}`)

      const { data: lead, error: leadError } = await supabaseAdmin
        .from('leads')
        .insert({
          tenant_id:       tenantId,
          call_log_id:     callLog.id,
          caller_name:     parsed.caller_name   ?? null,
          caller_phone:    parsed.caller_phone  ?? callerNumber,
          core_interest:   parsed.core_interest ?? null,
          call_outcome:    parsed.call_outcome  ?? 'unknown',
          booking_slot:    parsed.booking_slot  ?? null,
          parsed_at:       new Date().toISOString(),
          raw_parsed_json: parsed,
        })
        .select()
        .single()

      if (leadError) {
        console.error('[WEBHOOK_LEAD_ERROR]:', leadError)
      } else {
        console.log(`[Vapi] Lead committed: ${lead.id}`)

        // ── MODULE 1: SMS Nurture — true non-blocking macro task ────
        // Intentionally NOT awaited. Tenant lookup + SMS dispatch run
        // after the HTTP response is already flushed. Any failure is
        // logged with the full error object for serverless tracing.
        void (async () => {
          try {
            const { data: tenant } = await supabaseAdmin
              .from('tenants')
              .select('name')
              .eq('id', tenantId)
              .single()

            await sendNurtureSms({
              to:           parsed.caller_phone ?? callerNumber,
              parentName:   parsed.caller_name  ?? null,
              coreInterest: parsed.core_interest ?? null,
              bookingSlot:  parsed.booking_slot  ?? null,
              tenantName:   tenant?.name ?? 'our franchise',
            })
          } catch (error) {
            console.error('[WEBHOOK_LEAD_ERROR]:', error)
          }
        })()
      }
    }

    return NextResponse.json({ success: true, call_log_id: callLog.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[WEBHOOK_LEAD_ERROR]:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
