'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, LogOut, Settings, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

interface Props {
  email: string
  name: string
  avatarUrl?: string | null
}

function getInitials(name: string, email: string) {
  if (name) return name.slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

export default function UserMenu({ email, name, avatarUrl }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = getInitials(name, email)
  const displayName = name || email.split('@')[0]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md border cursor-pointer transition-all duration-150 ${
          open
            ? 'border-[var(--accent)] bg-[var(--surface-2)]'
            : 'border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-2)]'
        }`}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            className="w-6 h-6 rounded-full object-cover border border-[var(--border)]"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0">
            <span className="text-white font-semibold text-[10px] leading-none">{initials}</span>
          </div>
        )}

        <div className="hidden sm:block text-left min-w-0">
          <p className="text-[12px] font-medium text-[var(--text-1)] leading-none truncate max-w-[100px]">
            {displayName}
          </p>
        </div>

        <ChevronDown
          size={13}
          className={`text-[var(--text-3)] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] w-56 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-[var(--shadow-lg)] z-50 animate-[slide-down_0.15s_ease_both] overflow-hidden">
          {/* Identity */}
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
            <p className="text-[13px] font-semibold text-[var(--text-1)] truncate">{displayName}</p>
            <p className="text-[11px] text-[var(--text-3)] mt-0.5 truncate">{email}</p>
          </div>

          {/* Links */}
          <div className="py-1">
            {[
              { href: '/profile',  icon: User,     label: 'Profile' },
              { href: '/settings', icon: Settings, label: 'Settings' },
            ].map(({ href, icon: Icon, label }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-3 px-4 py-2 text-[13px] text-[var(--text-2)] no-underline transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] group"
              >
                <Icon size={13} className="text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors" />
                {label}
              </a>
            ))}
          </div>

          {/* Sign out */}
          <div className="border-t border-[var(--border)] py-1">
            <button
              onClick={signOut}
              className="flex items-center gap-3 w-full px-4 py-2 bg-transparent border-none text-[13px] text-[var(--danger)] cursor-pointer text-left transition-colors hover:bg-[var(--surface-2)] group"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
