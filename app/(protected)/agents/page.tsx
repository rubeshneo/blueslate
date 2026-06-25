export const dynamic = 'force-dynamic'

import AgentsManager from '@/components/AgentsManager'

export default function AgentsPage() {
  return (
    <main className="flex-1" style={{ padding: '24px' }}>
      <AgentsManager />
    </main>
  )
}
