import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTenantId } from '@/lib/get-tenant'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, TENANT_ID] = await Promise.all([params, getTenantId()])
    const body = await req.json()

    const patch = (body as { structured_data?: Record<string, unknown> })?.structured_data
    if (!patch || typeof patch !== 'object' || Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'structured_data patch is required' }, { status: 400 })
    }

    // Fetch current row first so we merge fields rather than replacing the entire JSONB
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('knowledge_context')
      .select('structured_data')
      .eq('id', id)
      .eq('tenant_id', TENANT_ID)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: fetchErr?.message ?? 'Not found' }, { status: 404 })
    }

    const merged = { ...(existing.structured_data as Record<string, unknown> ?? {}), ...patch }

    const { data, error } = await supabaseAdmin
      .from('knowledge_context')
      .update({ structured_data: merged })
      .eq('id', id)
      .eq('tenant_id', TENANT_ID)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ knowledge_context: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, TENANT_ID] = await Promise.all([params, getTenantId()])

    const { error } = await supabaseAdmin
      .from('knowledge_context')
      .delete()
      .eq('id', id)
      .eq('tenant_id', TENANT_ID) // tenant isolation — prevents cross-tenant deletes

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
