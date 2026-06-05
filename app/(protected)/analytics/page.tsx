export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase'
import AnalyticsOverview from '@/components/AnalyticsOverview'

const TENANT_ID = process.env.TENANT_ID!

export default async function AnalyticsPage() {
  const [{ data: leads }, { data: callLogs }] = await Promise.all([
    supabaseAdmin
      .from('leads')
      .select('call_outcome, core_interest, parsed_at')
      .eq('tenant_id', TENANT_ID)
      .order('parsed_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('call_logs')
      .select('started_at, duration_seconds')
      .eq('tenant_id', TENANT_ID)
      .order('started_at', { ascending: false })
      .limit(500),
  ])

  return (
    <main className="flex-1" style={{ padding: '24px' }}>
      <AnalyticsOverview
        leads={leads ?? []}
        callLogs={callLogs ?? []}
      />
    </main>
  )
}
