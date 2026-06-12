import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[15%] -left-[10%] w-[45%] h-[45%] bg-[var(--accent)] opacity-[0.03] blur-[120px] rounded-full animate-[spin_30s_linear_infinite]" />
        <div className="absolute -bottom-[15%] -right-[10%] w-[45%] h-[45%] bg-[var(--accent-2)] opacity-[0.03] blur-[140px] rounded-full animate-[spin_35s_linear_infinite_reverse]" />
      </div>
      <div className="absolute inset-0 bg-micro-grid opacity-[0.04] pointer-events-none z-0" />
      {children}
    </div>
  )
}
