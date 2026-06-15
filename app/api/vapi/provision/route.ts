import { NextResponse } from 'next/server'
import { getTenantId } from '@/lib/get-tenant'
import { provisionTenantVapi } from '@/lib/vapi-provisioning'

export async function POST() {
  try {
    const tenantId = await getTenantId()
    const result = await provisionTenantVapi(tenantId)
    return NextResponse.json({
      success:     true,
      phoneNumber: result.phoneNumber,
      assistantId: result.assistantId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Vapi Provision] Error:', err)
    const status = message.includes('Not authenticated') ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
