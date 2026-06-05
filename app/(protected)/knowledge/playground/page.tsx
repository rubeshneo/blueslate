export const dynamic = 'force-dynamic'

import PlaygroundChat from '@/components/PlaygroundChat'

export default function PlaygroundPage() {
  return (
    <main className="flex-1" style={{ padding: '24px' }}>
      <PlaygroundChat />
    </main>
  )
}
