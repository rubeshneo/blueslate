import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTenantId } from '@/lib/get-tenant'

const VALID_OUTCOMES = ['booked', 'interested', 'not-interested', 'callback-requested', 'unknown']

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('id, caller_name, caller_phone, core_interest, call_outcome, booking_slot, parsed_at, call_log_id, call_logs(full_transcript, recording_url, duration_seconds)')
      .eq('id', params.id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) throw error
    return NextResponse.json({ lead: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = await getTenantId()
    const body = await req.json() as { call_outcome?: string }

    if (!body.call_outcome || !VALID_OUTCOMES.includes(body.call_outcome)) {
      return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('leads')
      .update({ call_outcome: body.call_outcome })
      .eq('id', params.id)
      .eq('tenant_id', tenantId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
