import { NextResponse } from 'next/server'
import { syncKnowledgeToVapi } from '@/lib/vapi'
import { getTenantId } from '@/lib/get-tenant'

export async function POST() {
  try {
    const TENANT_ID = await getTenantId()
    const result = await syncKnowledgeToVapi(TENANT_ID)
    return NextResponse.json({ success: true, sourceCount: result.sourceCount })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Vapi Sync] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
