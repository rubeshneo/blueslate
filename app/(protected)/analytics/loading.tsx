function Skel({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-[var(--surface-2)] border border-[var(--border)] relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.04)] to-transparent" />
    </div>
  )
}

export default function AnalyticsLoading() {
  return (
    <main className="flex-1 p-4 md:p-6 flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skel key={i} className="h-[90px]" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Skel className="h-[260px]" />
        <Skel className="h-[260px]" />
      </div>
      <Skel className="h-[220px]" />
    </main>
  )
}
