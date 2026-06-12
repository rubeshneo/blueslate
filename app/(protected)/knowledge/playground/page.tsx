export const dynamic = 'force-dynamic'

import PlaygroundTabs from '@/components/PlaygroundTabs'

export default function PlaygroundPage() {
  return (
    <main className="flex-1" style={{ padding: '24px' }}>
      <PlaygroundTabs />
    </main>
  )
}
