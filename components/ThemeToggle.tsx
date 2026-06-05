'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-8 h-8 shrink-0" />

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center justify-center w-8 h-8 rounded-md border border-[var(--border)] bg-transparent text-[var(--text-2)] cursor-pointer transition-all duration-150 shrink-0 hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
    >
      {isDark ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  )
}
