import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'Rubesh.kumar@neoaistriq.com').toLowerCase()

export async function GET() {
  // ── Auth guard — admin only ──────────────────────────────────────────────────
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Fetch all tenants ────────────────────────────────────────────────────────
  const { data: tenants, error: tenantsErr } = await supabaseAdmin
    .from('tenants')
    .select('id, name, slug, franchise_url, phone_number, is_active, created_at, agent_name')
    .order('created_at', { ascending: false })

  if (tenantsErr || !tenants) {
    return Response.json({ error: 'Failed to fetch tenants' }, { status: 500 })
  }

  // ── Fetch counts per tenant in parallel ─────────────────────────────────────
  const enriched = await Promise.all(
    tenants.map(async (tenant) => {
      const [
        { count: leadCount },
        { count: callCount },
        { count: knowledgeCount },
        { data: lastLead },
      ] = await Promise.all([
        supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
        supabaseAdmin.from('call_logs').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
        supabaseAdmin.from('knowledge_context').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('is_active', true),
        supabaseAdmin.from('leads').select('parsed_at').eq('tenant_id', tenant.id).order('parsed_at', { ascending: false }).limit(1),
      ])

      return {
        ...tenant,
        lead_count: leadCount ?? 0,
        call_count: callCount ?? 0,
        knowledge_count: knowledgeCount ?? 0,
        last_activity: lastLead?.[0]?.parsed_at ?? null,
      }
    })
  )

  // ── Recent leads across all tenants ─────────────────────────────────────────
  const { data: recentLeads } = await supabaseAdmin
    .from('leads')
    .select('id, caller_name, caller_phone, core_interest, call_outcome, parsed_at, tenant_id')
    .order('parsed_at', { ascending: false })
    .limit(10)

  // Attach tenant name to each lead
  const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t.name]))
  const leadsWithTenant = (recentLeads ?? []).map(l => ({
    ...l,
    tenant_name: tenantMap[l.tenant_id] ?? 'Unknown',
  }))

  // ── Summary totals ───────────────────────────────────────────────────────────
  const summary = {
    total_tenants: enriched.length,
    active_tenants: enriched.filter(t => t.is_active).length,
    total_leads: enriched.reduce((s, t) => s + (t.lead_count as number), 0),
    total_calls: enriched.reduce((s, t) => s + (t.call_count as number), 0),
  }

  return Response.json({ summary, tenants: enriched, recent_leads: leadsWithTenant })
}
