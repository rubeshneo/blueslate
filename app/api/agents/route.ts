import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantId } from '@/lib/get-tenant'
import { AGENT_ROLES, type AgentRole } from '@/lib/agent-templates'
import { listTenantAgents, provisionAgentForTenant } from '@/lib/vapi-provisioning'

// GET — the role catalog + which roles this tenant has provisioned.
export async function GET() {
  try {
    const tenantId = await getTenantId()
    const agents = await listTenantAgents(tenantId)
    return NextResponse.json({ catalog: AGENT_ROLES, agents })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status  = message === 'Not authenticated' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

const PostSchema = z.object({
  role: z.enum(['receptionist', 'follow_up', 'reminder', 'review', 'winback', 'after_hours']),
})

// POST — provision (or re-provision) a role agent for this tenant.
export async function POST(req: NextRequest) {
  try {
    const parsed = PostSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid role' }, { status: 400 })
    }
    const tenantId = await getTenantId()
    const agent = await provisionAgentForTenant(tenantId, parsed.data.role as AgentRole)
    return NextResponse.json({ success: true, agent })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status  = message === 'Not authenticated' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
