export const dynamic = 'force-dynamic'

import NotificationsList from '@/components/NotificationsList'

export default function NotificationsPage() {
  return (
    <main className="flex-1" style={{ padding: '24px' }}>
      <NotificationsList />
    </main>
  )
}
