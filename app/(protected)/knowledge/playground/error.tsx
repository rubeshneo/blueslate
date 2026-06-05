'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="card max-w-md w-full p-8 flex flex-col items-center text-center gap-6 relative overflow-hidden border-t-2 border-t-[var(--danger)]">
        <div className="absolute inset-0 bg-micro-grid opacity-10 pointer-events-none mix-blend-screen" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--danger)] opacity-5 blur-[50px] pointer-events-none" />

        <div className="relative z-10 w-14 h-14 flex items-center justify-center border border-[var(--danger)] bg-[rgba(255,42,42,0.08)] shadow-[0_0_20px_rgba(255,42,42,0.15)]">
          <AlertTriangle size={24} className="text-[var(--danger)] drop-shadow-[0_0_6px_currentColor]" />
        </div>

        <div className="relative z-10">
          <p className="font-display font-bold uppercase text-[10px] tracking-[0.22em] text-[var(--danger)] mb-2">
            ── System Error
          </p>
          <h2 className="font-display font-bold uppercase text-[18px] tracking-[0.06em] text-[var(--text-1)]">
            Something went wrong
          </h2>
          <p className="font-body text-[13px] text-[var(--text-3)] mt-3 leading-relaxed">
            {error.message || 'An unexpected error occurred. The team has been notified.'}
          </p>
          {error.digest && (
            <p className="font-display text-[10px] tracking-[0.14em] text-[var(--text-3)] mt-2 opacity-60">
              ref: {error.digest}
            </p>
          )}
        </div>

        <button
          onClick={reset}
          className="btn-primary relative z-10"
        >
          <RefreshCw size={14} />
          Try again
        </button>
      </div>
    </main>
  )
}
