export default function PlaygroundLoading() {
  return (
    <main className="flex-1 p-4 md:p-6 flex items-center justify-center">
      <div className="w-full max-w-3xl mx-auto h-[calc(100vh-9rem)] max-h-[780px] bg-[var(--surface-2)] border border-[var(--border)] border-t-2 border-t-[var(--accent-2)] relative overflow-hidden">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.04)] to-transparent" />
        <div className="h-[52px] border-b border-[var(--border)] bg-[var(--surface)] relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_0.2s_infinite] bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.04)] to-transparent" />
        </div>
      </div>
    </main>
  )
}
