import { NextResponse } from 'next/server'
import { getTenantId } from '@/lib/get-tenant'
import { syncTenantKnowledgeToVapi } from '@/lib/vapi'

export async function POST() {
  try {
    const tenantId = await getTenantId()
    await syncTenantKnowledgeToVapi(tenantId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Vapi Sync] Error:', err)
    const status = message.includes('Not authenticated') ? 401
      : message.includes('provision first')              ? 422
      : 500
    return NextResponse.json({ error: message }, { status })
  }
}
