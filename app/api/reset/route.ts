import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function GET() {
  const tenantId = process.env.TENANT_ID!

  // 1. Delete all leads
  await supabaseAdmin.from('leads').delete().eq('tenant_id', tenantId)

  // 2. Delete all call logs
  await supabaseAdmin.from('call_logs').delete().eq('tenant_id', tenantId)

  // 3. Delete all knowledge context
  await supabaseAdmin.from('knowledge_context').delete().eq('tenant_id', tenantId)

  // 4. Reset agent name back to default
  await supabaseAdmin.from('tenants').update({ agent_name: 'AI Receptionist' }).eq('id', tenantId)

  // 5. Clear the AI playground test cookie
  cookies().delete(`playground_tested_${tenantId}`)

  return NextResponse.json({ 
    success: true, 
    message: 'Your account has been completely wiped and reset!' 
  })
}
