import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTenantId } from '@/lib/get-tenant'

// Scoped to the current authenticated user's tenant
export async function GET() {
  try {
    const TENANT_ID = await getTenantId()
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, name, slug, franchise_url, phone_number, vapi_agent_id, is_active, created_at')
      .eq('id', TENANT_ID)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
