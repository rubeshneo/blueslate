'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, User, Bell, Settings, Brain,
  Phone, Users, BarChart2, MessageSquare, Menu, X, Bot, Shield,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import NotificationBell from './NotificationBell'
import UserMenu from './UserMenu'

// ── Nav config ────────────────────────────────────────────────────────────────
const mainNav = [
  { href: '/',          label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/analytics', label: 'Analytics',    icon: BarChart2 },
]
const featureNav = [
  { href: '/knowledge',            label: 'Knowledge',     icon: Brain },
  { href: '/knowledge/playground', label: 'AI Playground', icon: MessageSquare },
  { href: '/voice',                label: 'Voice Agent',   icon: Phone },
  { href: '/agents',               label: 'AI Agents',     icon: Bot },
  { href: '/leads',                label: 'Leads',         icon: Users },
]
const accountNav = [
  { href: '/profile',       label: 'Profile',       icon: User },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings',      label: 'Settings',      icon: Settings },
]
// Pure platform-admin nav — franchise-operational tools are hidden for the creator.
const adminNav = [
  { href: '/admin',         label: 'Admin Panel',  icon: Shield },
  { href: '/profile',       label: 'Profile',       icon: User },
  { href: '/notifications', label: 'Notifications', icon: Bell },
]

const ROUTES: Record<string, { title: string; subtitle: string }> = {
  '/':                       { title: 'Dashboard',      subtitle: 'Overview & live metrics' },
  '/analytics':              { title: 'Analytics',      subtitle: 'Call velocity · interest · outcome' },
  '/knowledge':              { title: 'Knowledge Base', subtitle: 'Franchise knowledge extraction' },
  '/knowledge/playground':   { title: 'AI Playground',  subtitle: 'Simulate parent inquiries' },
  '/voice':                  { title: 'Voice Agent',    subtitle: 'Real-time AI receptionist via Vapi' },
  '/agents':                 { title: 'AI Agents',      subtitle: 'Role-based AI caller library' },
  '/leads':                  { title: 'Leads',          subtitle: 'Auto-parsed leads from call transcripts' },
  '/profile':                { title: 'Profile',        subtitle: 'Account identity' },
  '/notifications':          { title: 'Notifications',  subtitle: 'All activity and alerts' },
  '/settings':               { title: 'Settings',       subtitle: 'Agent configuration' },
  '/admin':                  { title: 'Blueslate',      subtitle: 'All tenants & platform activity' },
}

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({
  href, label, icon: Icon, onClick,
}: {
  href: string; label: string; icon: React.ElementType; onClick?: () => void
}) {
  const pathname = usePathname()
  const active = pathname === href

  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        background: active ? 'var(--sidebar-active-bg)' : undefined,
        color: active ? 'var(--sidebar-text-1)' : 'var(--sidebar-text-2)',
      }}
      className="group flex items-center gap-3 mx-2 px-3 py-2 rounded-md transition-all duration-150 hover:opacity-100"
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover-bg)'
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = ''
      }}
    >
      <Icon
        size={15}
        className="shrink-0 transition-colors"
        style={{ color: active ? 'var(--accent)' : 'var(--sidebar-text-3)' }}
      />
      <span className="text-[13px] font-medium tracking-[-0.01em]">{label}</span>
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />}
    </Link>
  )
}

function NavSection({
  label, items, onClick,
}: {
  label: string; items: { href: string; label: string; icon: React.ElementType }[]; onClick?: () => void
}) {
  return (
    <div className="mb-1">
      <p className="px-5 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--sidebar-label)' }}>
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => <NavItem key={item.href} {...item} onClick={onClick} />)}
      </div>
    </div>
  )
}

// ── SidebarContent ────────────────────────────────────────────────────────────
function SidebarContent({ onClose, isAdmin }: { onClose?: () => void; isAdmin?: boolean }) {
  return (
    <>
      {/* Logo */}
      <div className="px-4 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[#E85D3F] flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-[12px] tracking-tight">BS</span>
          </div>
          <div>
            <p className="text-[14px] font-semibold leading-none" style={{ color: 'var(--sidebar-text-1)' }}>Blueslate</p>
            <p className="text-[11px] mt-0.5 leading-none" style={{ color: 'var(--sidebar-text-3)' }}>AI Receptionist</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="transition-colors p-1 rounded md:hidden hover:opacity-70"
            style={{ color: 'var(--sidebar-text-3)' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav — platform admins get a focused nav; franchise owners get the full toolset */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {isAdmin ? (
          <NavSection label="Admin" items={adminNav} onClick={onClose} />
        ) : (
          <>
            <NavSection label="Overview" items={mainNav}    onClick={onClose} />
            <NavSection label="Features" items={featureNav} onClick={onClose} />
            <NavSection label="Account"  items={accountNav} onClick={onClose} />
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[11px]" style={{ color: 'var(--sidebar-label)' }}>v1.0</span>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--live)] animate-[live-dot_2s_ease-in-out_infinite]" />
            <span className="text-[11px] font-medium" style={{ color: 'var(--live)' }}>Online</span>
          </div>
        </div>
      </div>
    </>
  )
}

// ── AppShell ─────────────────────────────────────────────────────────────────
export default function AppShell({
  email, name, avatarUrl, isAdmin, children,
}: {
  email: string; name: string; avatarUrl?: string | null; isAdmin?: boolean; children: React.ReactNode
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const route = ROUTES[pathname] ?? { title: 'Blueslate', subtitle: '' }

  useEffect(() => { setDrawerOpen(false) }, [pathname])

  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Desktop sidebar — fixed height, never scrolls ────────────────── */}
      <aside
        className="hidden md:flex w-[240px] shrink-0 h-screen flex-col"
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
      >
        <SidebarContent isAdmin={isAdmin} />
      </aside>

      {/* ── Mobile backdrop ──────────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      <aside
        className="fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col md:hidden transition-transform duration-300 ease-out"
        style={{
          background: 'var(--sidebar-bg)',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <SidebarContent onClose={() => setDrawerOpen(false)} isAdmin={isAdmin} />
      </aside>

      {/* ── Main area — only this scrolls ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">

        {/* ── Header — sticks to top of the scrollable column ─────────── */}
        <header className="h-[60px] px-4 md:px-6 flex items-center justify-between bg-[var(--surface)] border-b border-[var(--border)] shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setDrawerOpen((v) => !v)}
              className="md:hidden p-2 rounded-md text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>

            <div className="min-w-0">
              <h1 className="text-[14px] font-semibold text-[var(--text-1)] truncate leading-tight">
                {route.title}
              </h1>
              {route.subtitle && (
                <p className="text-[12px] text-[var(--text-3)] mt-0.5 truncate hidden sm:block leading-tight">
                  {route.subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <div className="hidden sm:block w-[1px] h-5 bg-[var(--border)] mx-1" />
            <UserMenu email={email} name={name} avatarUrl={avatarUrl} />
          </div>
        </header>

        {children}
      </div>
    </div>
  )
}
