import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getTenantId } from '@/lib/get-tenant'
import { getNotifications, createNotification, markAllRead } from '@/lib/redis'

// GET /api/notifications — list for authenticated tenant
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tenantId = await getTenantId()
    const data = await getNotifications(tenantId)
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status  = message === 'Not authenticated' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

// POST /api/notifications — create a notification for the authenticated tenant
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tenantId = await getTenantId()
    const body = await req.json()
    const { title, message, type = 'info' } = body
    if (!title || !message) {
      return NextResponse.json({ error: 'title and message required' }, { status: 400 })
    }

    const notif = await createNotification(tenantId, { title, message, type })
    return NextResponse.json({ data: notif })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status  = message === 'Not authenticated' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

// PATCH /api/notifications — mark all as read for authenticated tenant
export async function PATCH() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tenantId = await getTenantId()
    await markAllRead(tenantId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status  = message === 'Not authenticated' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
