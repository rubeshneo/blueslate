import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantId } from '@/lib/get-tenant'
import { makeOutboundCall, resolveAgentVapiId } from '@/lib/vapi-provisioning'
import { reserveOutboundCall } from '@/lib/redis'
import type { AgentRole } from '@/lib/agent-templates'

const OutboundSchema = z.object({
  toNumber: z.string().min(7, 'Phone number is required'),
  toName:   z.string().optional(),
  interest: z.string().optional(),
  leadId:   z.string().uuid().optional(),
  // Optional: voice the call with a specific role agent (e.g. follow_up). Falls
  // back to the tenant's main assistant when omitted or not yet provisioned.
  role:     z.enum(['receptionist', 'follow_up', 'reminder', 'review', 'winback', 'after_hours']).optional(),
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

    const { toNumber, toName, interest, role } = parsed.data
    const tenantId = await getTenantId()

    // Guard the shared Vapi credit: cap outbound calls per tenant per month.
    const budget = await reserveOutboundCall(tenantId)
    if (!budget.allowed) {
      return NextResponse.json(
        { error: `Monthly outbound call limit reached (${budget.cap} calls). It resets next month, or raise OUTBOUND_CALL_CAP.` },
        { status: 429 },
      )
    }

    const agentVapiId = role ? await resolveAgentVapiId(tenantId, role as AgentRole) : null
    const result = await makeOutboundCall(tenantId, toNumber, toName, interest, agentVapiId ?? undefined)

    return NextResponse.json({ success: true, callId: result.callId, callsRemaining: budget.remaining })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Vapi Outbound] Error:', err)

    if (message.includes('Not authenticated'))          return NextResponse.json({ error: message }, { status: 401 })
    if (message.includes('provision first'))            return NextResponse.json({ error: message }, { status: 422 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
