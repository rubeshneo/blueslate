import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const tenant_id = req.nextUrl.searchParams.get('tenant_id')
  if (!tenant_id) {
    return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('call_logs')
    .select('*')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
