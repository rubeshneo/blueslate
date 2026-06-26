import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/admin'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tenantId = process.env.TENANT_ID
  if (!tenantId) return NextResponse.json({ error: 'TENANT_ID not configured' }, { status: 500 })

  await supabaseAdmin.from('leads').delete().eq('tenant_id', tenantId)
  await supabaseAdmin.from('call_logs').delete().eq('tenant_id', tenantId)
  await supabaseAdmin.from('knowledge_context').delete().eq('tenant_id', tenantId)
  await supabaseAdmin.from('tenants').update({ agent_name: 'AI Receptionist' }).eq('id', tenantId)
  cookies().delete(`playground_tested_${tenantId}`)

  return NextResponse.json({ success: true, message: 'Account wiped and reset.' })
}
