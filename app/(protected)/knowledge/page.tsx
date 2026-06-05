export const dynamic = 'force-dynamic'

import KnowledgeScraper from '@/components/KnowledgeScraper'
import { supabaseAdmin } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export default async function KnowledgePage() {
  const { data: contexts } = await supabaseAdmin
    .from('knowledge_context')
    .select('id, source_url, scraped_at, structured_data')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .order('scraped_at', { ascending: false })

  return (
    <main className="flex-1" style={{ padding: '24px' }}>
      <KnowledgeScraper tenantId={TENANT_ID} initialContexts={contexts ?? []} />
    </main>
  )
}
