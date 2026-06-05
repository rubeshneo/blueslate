import { NextResponse } from 'next/server'
import { syncKnowledgeToVapi } from '@/lib/vapi'

const TENANT_ID = process.env.TENANT_ID!

export async function POST() {
  try {
    const result = await syncKnowledgeToVapi(TENANT_ID)
    return NextResponse.json({ success: true, sourceCount: result.sourceCount })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Vapi Sync] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
