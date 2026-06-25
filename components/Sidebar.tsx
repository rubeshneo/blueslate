'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, User, Bell, Settings, Brain, Phone, Users, BarChart2, MessageSquare, Shield, Bot } from 'lucide-react'

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
  { href: '/notifications', label: 'Alerts',         icon: Bell },
  { href: '/settings',      label: 'Settings',       icon: Settings },
]

const adminNav = [
  { href: '/admin', label: 'Admin Panel', icon: Shield },
]

function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname()
  const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-3 py-2.5 pr-4 pl-4 transition-all duration-300 border-l-2 ${
        active 
          ? 'border-l-[var(--accent)] bg-[var(--surface-2)] text-[var(--text-1)] shadow-[inset_2px_0_10px_rgba(255,0,127,0.1)]' 
          : 'border-l-transparent bg-transparent text-[var(--text-2)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-1)]'
      }`}
    >
      <Icon
        size={14}
        className={`shrink-0 transition-colors duration-300 ${active ? 'text-[var(--accent)] drop-shadow-[0_0_5px_currentColor]' : 'text-[var(--text-3)] group-hover:text-[var(--accent-2)]'}`}
      />
      <span className="font-display font-semibold uppercase text-[10px] tracking-[0.16em]">
        {label}
      </span>
      {active && (
        <span className="ml-auto shrink-0 w-1.5 h-1.5 bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
      )}
    </Link>
  )
}

function NavSection({ label, items }: { label: string; items: { href: string; label: string; icon: React.ElementType }[] }) {
  return (
    <div className="mb-2">
      <p className="font-display font-bold uppercase text-[9px] tracking-[0.22em] text-[var(--text-3)] px-5 pt-4 pb-2 glow-text opacity-70">
        ── {label}
      </p>
      <div>
        {items.map((item) => <NavItem key={item.href} {...item} />)}
      </div>
    </div>
  )
}

export default function Sidebar() {
  return (
    <aside className="w-[240px] shrink-0 min-h-screen flex flex-col bg-tactical border-r border-[var(--border)] relative z-20 overflow-hidden">
      <div className="absolute inset-0 bg-micro-grid opacity-20 pointer-events-none mix-blend-screen" />
      
      {/* Logotype */}
      <div className="px-5 py-5 border-b border-[var(--border)] relative z-10 bg-[rgba(18,21,38,0.4)]">
        <div className="flex items-center gap-3">
          <div className="font-display font-bold text-[13px] flex items-center justify-center shrink-0 glitch-hover w-9 h-9 bg-[var(--accent)] text-[var(--bg)] shadow-[0_0_15px_rgba(255,0,127,0.4)] tracking-tighter">
            BS
          </div>
          <div className="glitch-hover">
            <p className="font-display font-bold uppercase leading-none text-[13px] tracking-[0.1em] text-[var(--text-1)] drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">
              Blueslate
            </p>
            <p className="font-body uppercase leading-none mt-1.5 text-[9px] tracking-[0.24em] text-[var(--accent)] drop-shadow-[0_0_5px_rgba(255,0,127,0.3)]">
              AI Receptionist
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 relative z-10 overflow-y-auto overflow-x-hidden">
        <NavSection label="Overview" items={mainNav} />
        <NavSection label="Features" items={featureNav} />
        <NavSection label="Account"  items={accountNav} />
        <NavSection label="Creator"  items={adminNav} />
      </nav>

      {/* Status footer */}
      <div className="px-5 py-4 border-t border-[var(--border)] relative z-10 bg-[rgba(18,21,38,0.6)]">
        <div className="flex items-center justify-between">
          <span className="font-display font-bold uppercase text-[10px] tracking-[0.2em] text-[var(--text-3)]">
            v1.0
          </span>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[var(--live)] animate-[pulse_2s_infinite] shadow-[0_0_8px_var(--live)]" />
            <span className="font-display font-bold uppercase text-[10px] tracking-[0.2em] text-[var(--live)] drop-shadow-[0_0_5px_rgba(0,255,136,0.3)]">
              Online
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
