import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import AppShell from '@/components/AppShell'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/landing')

  const name      = (user.user_metadata?.full_name as string) ?? ''
  const email     = user.email ?? ''
  const avatarUrl = (user.user_metadata?.avatar_url as string) ?? null

  return (
    <AppShell email={email} name={name} avatarUrl={avatarUrl}>
      {children}
    </AppShell>
  )
}
