import { NextResponse } from 'next/server'
import { getTenantId } from '@/lib/get-tenant'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const tenantId = await getTenantId()

    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('vapi_agent_id, vapi_phone_number, vapi_phone_number_id')
      .eq('id', tenantId)
      .single()

    if (error || !tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const assistantId   = (tenant.vapi_agent_id as string | null)        ?? null
    const phoneNumber   = (tenant.vapi_phone_number as string | null)     ?? null
    const phoneNumberId = (tenant.vapi_phone_number_id as string | null)  ?? null

    return NextResponse.json({
      provisioned:  !!assistantId && !!phoneNumber,
      assistantId,
      phoneNumber,
      phoneNumberId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Vapi Status] Error:', err)
    const status = message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
