export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase'
import IdentitySettingsCard from '@/components/IdentitySettingsCard'
import WorkspaceSettingsCard from '@/components/WorkspaceSettingsCard'

const TENANT_ID = process.env.TENANT_ID!

export default async function SettingsPage() {
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('agent_name, agent_greeting, name, slug')
    .eq('id', TENANT_ID)
    .single()

  return (
    <main
      className="flex-1 stagger"
      style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      {/* Workspace */}
      <WorkspaceSettingsCard
        initialName={tenant?.name ?? ''}
        initialSlug={tenant?.slug ?? ''}
      />

      {/* Identity card */}
      <IdentitySettingsCard
        initialName={tenant?.agent_name ?? 'Blueslate AI'}
        initialGreeting={tenant?.agent_greeting ?? 'Hi! Thanks for calling. How can I help you today?'}
      />
    </main>
  )
}
