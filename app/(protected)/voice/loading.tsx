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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skel key={i} className="h-[100px]" />)}
      </div>
      <Skel className="h-[180px]" />
      <Skel className="h-[240px]" />
    </main>
  )
}
