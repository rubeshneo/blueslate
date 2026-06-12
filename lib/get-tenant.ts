import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function getTenantId(): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  // 1. JWT cache — available after the first token refresh post-creation
  if (user.app_metadata?.tenant_id) {
    return user.app_metadata.tenant_id as string
  }

  // 2. Deterministic slug — safe to re-derive on every call without side effects
  const slug = `franchise-${user.id.slice(0, 8)}`

  const { data: existing } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    // Warm the JWT cache (fire-and-forget — don't block the response)
    supabaseAdmin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, tenant_id: existing.id },
    }).catch(() => {})
    return existing.id
  }

  // 3. First-ever login — provision a fresh workspace
  const defaultName = user.user_metadata?.full_name
    ? `${user.user_metadata.full_name}'s Franchise`
    : 'My Franchise'

  const { data: newTenant, error } = await supabaseAdmin
    .from('tenants')
    .insert({ slug, name: defaultName })
    .select('id')
    .single()

  if (error || !newTenant) {
    console.error('[getTenantId] Failed to create tenant:', error)
    // Last-resort fallback so the app doesn't hard-crash on a DB hiccup
    return process.env.TENANT_ID!
  }

  // Warm JWT cache
  supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, tenant_id: newTenant.id },
  }).catch(() => {})

  return newTenant.id
}
