import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabaseAdmin
    .from('call_logs')
    .delete()
    .like('full_transcript', '%Submitted via blueslate.ai landing page%')

  if (error) return NextResponse.json({ success: false, error: error.message })
  return NextResponse.json({ success: true, message: 'Cleaned debug leads' })
}
