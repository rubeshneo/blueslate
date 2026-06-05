import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID
if (!TENANT_ID) throw new Error('TENANT_ID env var is required')

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
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
