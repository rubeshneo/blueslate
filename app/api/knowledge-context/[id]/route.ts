import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTenantId } from '@/lib/get-tenant'

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
