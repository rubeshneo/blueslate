import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Browser / client-side client (respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side admin client (bypasses RLS — only use in API routes)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string
  slug: string
  name: string
  franchise_url: string | null
  phone_number: string | null
  vapi_agent_id: string | null
  created_at: string
  is_active: boolean
}

export interface KnowledgeContext {
  id: string
  tenant_id: string
  source_url: string
  scraped_at: string
  raw_content: string | null
  structured_data: Record<string, unknown> | null
  is_active: boolean
}

export interface CallLog {
  id: string
  tenant_id: string
  vapi_call_id: string | null
  caller_number: string | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  full_transcript: string | null
  recording_url: string | null
  status: 'completed' | 'missed' | 'failed' | 'in-progress'
  created_at: string
}

export interface Lead {
  id: string
  tenant_id: string
  call_log_id: string | null
  caller_name: string | null
  caller_phone: string | null
  core_interest: string | null
  call_outcome: 'booked' | 'interested' | 'not-interested' | 'callback-requested' | 'unknown'
  booking_slot: string | null
  parsed_at: string
  raw_parsed_json: Record<string, unknown> | null
}
