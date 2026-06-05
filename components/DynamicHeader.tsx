'use client'

import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'
import NotificationBell from './NotificationBell'
import UserMenu from './UserMenu'

const ROUTES: Record<string, { title: string; subtitle: string }> = {
  '/':                       { title: 'Dashboard',      subtitle: 'Overview & live metrics' },
  '/analytics':              { title: 'Analytics',      subtitle: 'Call velocity · interest · outcome allocation' },
  '/knowledge':              { title: 'Knowledge Base', subtitle: 'Loop A — Instant franchise knowledge extraction' },
  '/knowledge/playground':   { title: 'AI Playground',  subtitle: 'Simulate parent inquiries bounded by your knowledge base' },
  '/voice':                  { title: 'Voice Agent',    subtitle: 'Loop B — Real-time AI receptionist via Vapi.ai' },
  '/leads':                  { title: 'Leads',          subtitle: 'Loop C — Auto-parsed leads from call transcripts' },
  '/profile':                { title: 'Profile',        subtitle: 'Account identity' },
  '/notifications':          { title: 'Notifications',  subtitle: 'All activity and alerts' },
  '/settings':               { title: 'Settings',       subtitle: 'Agent identity · workspace configuration' },
}

interface Props {
  email: string
  name: string
  avatarUrl?: string | null
}

export default function DynamicHeader({ email, name, avatarUrl }: Props) {
  const pathname = usePathname()
  const route = ROUTES[pathname] ?? { title: 'Blueslate', subtitle: '' }

  return (
    <header className="h-[60px] px-6 flex items-center justify-between bg-[var(--surface)] border-b border-[var(--border)] shrink-0 relative z-50">
      <div className="absolute inset-0 bg-micro-grid opacity-30 pointer-events-none mix-blend-plus-lighter" />
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-50" />
      
      {/* Route identity */}
      <div className="flex items-center gap-3 min-w-0 relative z-10">
        <div className="w-[3px] h-5 bg-[var(--accent)] shrink-0 shadow-[0_0_8px_var(--accent)]" />
        <div className="min-w-0 flex flex-col justify-center">
          <h1 className="font-display font-bold uppercase text-[13px] tracking-[0.14em] text-[var(--text-1)] drop-shadow-[0_0_5px_rgba(255,255,255,0.2)] glitch-hover truncate">
            {route.title}
          </h1>
          {route.subtitle && (
            <p className="font-body text-[11px] text-[var(--text-3)] mt-0.5 tracking-[0.04em] truncate">
              {route.subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 relative z-10">
        <ThemeToggle />
        <NotificationBell />
        <div className="w-[1px] h-6 bg-[var(--border)] mx-1" />
        <UserMenu email={email} name={name} avatarUrl={avatarUrl} />
      </div>
    </header>
  )
}
