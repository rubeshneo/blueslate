import { NextResponse } from 'next/server'
import { syncKnowledgeToVapi } from '@/lib/vapi'

export async function POST() {
  try {
    await syncKnowledgeToVapi()
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Vapi Sync] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
