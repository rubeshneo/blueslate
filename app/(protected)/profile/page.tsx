export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase-server'
import ProfileForm from '@/components/ProfileForm'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const initial = {
    email: user?.email ?? '',
    name: (user?.user_metadata?.full_name as string) ?? '',
    avatarUrl: (user?.user_metadata?.avatar_url as string) ?? '',
  }

  return (
    <main className="flex-1" style={{ padding: '24px', maxWidth: '640px' }}>
      <ProfileForm initial={initial} />
    </main>
  )
}
