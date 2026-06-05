export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase'
import LeadsDashboard from '@/components/LeadsDashboard'
import type { Lead } from '@/hooks/useRealtimeLeads'

const TENANT_ID = process.env.TENANT_ID!

export default async function LeadsPage() {
  const { data } = await supabaseAdmin
    .from('leads')
    .select('id, caller_name, caller_phone, core_interest, call_outcome, booking_slot, parsed_at')
    .eq('tenant_id', TENANT_ID)
    .order('parsed_at', { ascending: false })
    .limit(25)

  return (
    <main className="flex-1" style={{ padding: '24px' }}>
      <LeadsDashboard tenantId={TENANT_ID} initialLeads={(data ?? []) as Lead[]} />
    </main>
  )
}
