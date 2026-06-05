import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const tenant_id = req.nextUrl.searchParams.get('tenant_id')
  if (!tenant_id) {
    return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('knowledge_context')
    .select('*')
    .eq('tenant_id', tenant_id)
    .order('scraped_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, structured_data } = await req.json()
    if (!id || !structured_data) {
      return NextResponse.json({ error: 'id and structured_data required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('knowledge_context')
      .update({ structured_data })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
