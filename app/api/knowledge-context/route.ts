import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTenantId } from '@/lib/get-tenant'

export async function GET() {
  try {
    const TENANT_ID = await getTenantId()

    const { data, error } = await supabaseAdmin
      .from('knowledge_context')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .order('scraped_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status  = message === 'Not authenticated' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
