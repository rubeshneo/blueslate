import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-dot-pattern"
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        gap: '24px',
      }}
    >
      {/* Back to landing */}
      <Link
        href="/landing"
        className="font-display font-bold uppercase text-[10px] tracking-widest text-[var(--text-3)] hover:text-[var(--accent)] transition-colors flex items-center gap-2"
      >
        ← Back to Blueslate AI
      </Link>
      {children}
    </div>
  )
}
