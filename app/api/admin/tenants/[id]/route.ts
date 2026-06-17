import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'Rubesh.kumar@neoaistriq.com').toLowerCase()

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as { is_active?: boolean }
  if (typeof body.is_active !== 'boolean') {
    return NextResponse.json({ error: 'is_active (boolean) required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('tenants')
    .update({ is_active: body.is_active })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
