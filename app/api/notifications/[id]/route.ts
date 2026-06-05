import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { markOneRead, deleteNotification } from '@/lib/redis'

// PATCH /api/notifications/[id] — mark one as read
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await markOneRead(user.id, params.id)
  return NextResponse.json({ success: true })
}

// DELETE /api/notifications/[id] — delete one notification
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await deleteNotification(user.id, params.id)
  return NextResponse.json({ success: true })
}
