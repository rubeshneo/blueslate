export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase'
import type { BusinessHoursConfig } from '@/lib/supabase'
import IdentitySettingsCard from '@/components/IdentitySettingsCard'
import WorkspaceSettingsCard from '@/components/WorkspaceSettingsCard'
import BusinessHoursCard from '@/components/BusinessHoursCard'

const TENANT_ID = process.env.TENANT_ID!

type SettingsTenant = {
  name:           string
  slug:           string
  agent_name:     string
  agent_greeting: string
  business_hours: BusinessHoursConfig | null
}

export default async function SettingsPage() {
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('agent_name, agent_greeting, name, slug, business_hours')
    .eq('id', TENANT_ID)
    .single()

  const tenant = data as SettingsTenant | null

  return (
    <main
      className="flex-1 stagger"
      style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      <WorkspaceSettingsCard
        initialName={tenant?.name ?? ''}
        initialSlug={tenant?.slug ?? ''}
      />

      <IdentitySettingsCard
        initialName={tenant?.agent_name ?? 'Blueslate AI'}
        initialGreeting={tenant?.agent_greeting ?? 'Hi! Thanks for calling. How can I help you today?'}
      />

      <BusinessHoursCard initialHours={tenant?.business_hours ?? null} />
    </main>
  )
}
