import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton — createBrowserClient must return a STABLE instance across renders.
// A fresh client per call changes object identity every render, which churns
// realtime subscriptions in hooks that list the client as an effect dependency
// (e.g. useRealtimeLeads). One client per browser tab is also the supported pattern.
let client: SupabaseClient | undefined

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}
