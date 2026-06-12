import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { error } = await supabaseAdmin
    .from('call_logs')
    .delete()
    .like('full_transcript', '%Submitted via blueslate.ai landing page%')

  if (error) {
    return NextResponse.json({ success: false, error: error.message })
  }
  
  return NextResponse.json({ success: true, message: 'Cleaned debug leads' })
}
