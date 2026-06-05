import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getNotifications, createNotification, markAllRead } from '@/lib/redis'

// GET /api/notifications — list for authenticated user
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await getNotifications(user.id)
  return NextResponse.json({ data })
}

// POST /api/notifications — create a notification
// Body: { title, message, type, userId? }
// userId is optional; if omitted, uses the authenticated user
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const body = await req.json()
  const targetUserId = body.userId ?? user?.id
  if (!targetUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, message, type = 'info' } = body
  if (!title || !message) {
    return NextResponse.json({ error: 'title and message required' }, { status: 400 })
  }

  const notif = await createNotification(targetUserId, { title, message, type })
  return NextResponse.json({ data: notif })
}

// PATCH /api/notifications — mark all as read for authenticated user
export async function PATCH() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await markAllRead(user.id)
  return NextResponse.json({ success: true })
}
