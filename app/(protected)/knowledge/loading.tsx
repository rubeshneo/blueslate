function Skel({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-[var(--surface-2)] border border-[var(--border)] relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.04)] to-transparent" />
    </div>
  )
}

export default function Loading() {
  return (
    <main className="flex-1 p-4 md:p-6 flex flex-col gap-5">
      <Skel className="h-[88px] border-l-4 border-l-[var(--border-strong)]" />
      <Skel className="h-[260px]" />
      <Skel className="h-[140px]" />
    </main>
  )
}
