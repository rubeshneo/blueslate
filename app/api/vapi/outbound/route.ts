import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantId } from '@/lib/get-tenant'
import { makeOutboundCall } from '@/lib/vapi-provisioning'

const OutboundSchema = z.object({
  toNumber: z.string().min(7, 'Phone number is required'),
  toName:   z.string().optional(),
  interest: z.string().optional(),
  leadId:   z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json() as unknown
    const parsed = OutboundSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      )
    }

    const { toNumber, toName, interest } = parsed.data
    const tenantId = await getTenantId()
    const result   = await makeOutboundCall(tenantId, toNumber, toName, interest)

    return NextResponse.json({ success: true, callId: result.callId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Vapi Outbound] Error:', err)

    if (message.includes('Not authenticated'))          return NextResponse.json({ error: message }, { status: 401 })
    if (message.includes('provision first'))            return NextResponse.json({ error: message }, { status: 422 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
