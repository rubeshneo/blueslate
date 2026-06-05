import { createClient } from '@/lib/supabase-server'
import ThemeToggle from './ThemeToggle'
import NotificationBell from './NotificationBell'
import UserMenu from './UserMenu'

interface Props {
  title: string
  subtitle?: string
}

export default async function Header({ title, subtitle }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const name = (user?.user_metadata?.full_name as string) ?? ''
  const email = user?.email ?? ''
  const avatarUrl = (user?.user_metadata?.avatar_url as string) ?? null

  return (
    <header className="h-[60px] px-6 flex items-center justify-between bg-[var(--surface)] border-b border-[var(--border)] shrink-0 relative z-50">
      <div className="absolute inset-0 bg-micro-grid opacity-30 pointer-events-none mix-blend-plus-lighter" />
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-50" />
      <div className="relative z-10 flex flex-col justify-center">
        <h1 className="font-display font-bold uppercase text-[13px] tracking-[0.14em] text-[var(--text-1)] drop-shadow-[0_0_5px_rgba(255,255,255,0.2)] glitch-hover">
          {title}
        </h1>
        {subtitle && (
          <p className="font-body text-[11px] text-[var(--text-3)] mt-0.5 tracking-[0.04em]">
            {subtitle}
          </p>
        )}
      </div>
      <div className="relative z-10 flex items-center gap-3">
        <ThemeToggle />
        <NotificationBell />
        <div className="w-[1px] h-6 bg-[var(--border)] mx-1" />
        <UserMenu email={email} name={name} avatarUrl={avatarUrl} />
      </div>
    </header>
  )
}
