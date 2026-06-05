import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID
if (!TENANT_ID) throw new Error('TENANT_ID env var is required')

// Scoped to the configured tenant — never exposes other tenants
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('id, name, slug, franchise_url, phone_number, vapi_agent_id, is_active, created_at')
    .eq('id', TENANT_ID)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
