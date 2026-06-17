export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/lib/supabase-server'
import OnboardingWizard from '@/components/OnboardingWizard'

import { getTenantId } from '@/lib/get-tenant'
export default async function OnboardingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const TENANT_ID = await getTenantId()

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, name, slug, agent_name, agent_greeting, franchise_url')
    .eq('id', TENANT_ID)
    .single()

  const { count: knowledgeCount } = await supabaseAdmin
    .from('knowledge_context')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)

  return (
    <OnboardingWizard
      userName={(user?.user_metadata?.full_name as string) ?? ''}
      userEmail={user?.email ?? ''}
      initial={{
        name: tenant?.name ?? '',
        slug: tenant?.slug ?? '',
        agentName: tenant?.agent_name ?? '',
        agentGreeting: tenant?.agent_greeting ?? '',
        franchiseUrl: tenant?.franchise_url ?? '',
        hasKnowledge: (knowledgeCount ?? 0) > 0,
      }}
    />
  )
}
