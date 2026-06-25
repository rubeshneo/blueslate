import { supabaseAdmin } from '@/lib/supabase'

// Builds a per-caller context block from this tenant's own lead/call history,
// matched by phone number. Lets an agent greet a returning caller by name and
// pick up where they left off — instead of treating everyone as a stranger.
// Strictly tenant-scoped: only ever reads the calling tenant's leads.

export interface CallerContext {
  isReturning: boolean
  name:        string | null
  block:       string        // appended to the system prompt ('' when unknown)
  opener:      string | null // personalized first message, or null to use default
}

const EMPTY: CallerContext = { isReturning: false, name: null, block: '', opener: null }

type LeadRow = {
  caller_name:   string | null
  core_interest: string | null
  call_outcome:  string | null
  booking_slot:  string | null
  parsed_at:     string
}

export async function buildCallerContext(tenantId: string, phone: string | null): Promise<CallerContext> {
  if (!phone) return EMPTY

  // Match on the last 10 digits so formatting differences (+91, spaces, dashes)
  // don't cause a miss.
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (digits.length < 7) return EMPTY

  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('caller_name, core_interest, call_outcome, booking_slot, parsed_at')
    .eq('tenant_id', tenantId)
    .ilike('caller_phone', `%${digits}%`)
    .order('parsed_at', { ascending: false })
    .limit(5)

  if (error || !data || data.length === 0) return EMPTY

  const leads = data as LeadRow[]
  const name = leads.find((l) => l.caller_name)?.caller_name ?? null
  const interests = Array.from(
    new Set(leads.map((l) => l.core_interest).filter((x): x is string => Boolean(x))),
  ).slice(0, 3)
  const booked = leads.find((l) => l.booking_slot || l.call_outcome === 'booked')

  const lines: string[] = []
  if (name) lines.push(`Caller name: ${name}`)
  if (interests.length) lines.push(`Previously interested in: ${interests.join('; ')}`)
  if (booked?.booking_slot) lines.push(`Has an existing booking around: ${booked.booking_slot}`)
  else if (booked) lines.push('Has booked with us before.')
  lines.push(
    `This is a RETURNING caller (${leads.length} prior interaction${leads.length > 1 ? 's' : ''}). ` +
    `Greet them by name if known, acknowledge their history warmly, and do NOT re-ask things you already know.`,
  )

  const block =
    `\n\n=== CALLER CONTEXT (this specific caller — use it to personalize) ===\n` +
    `${lines.join('\n')}\n` +
    `=== END CALLER CONTEXT ===`

  const opener = name
    ? `Hi ${name}, welcome back! Great to hear from you again — how can I help today?`
    : null

  return { isReturning: true, name, block, opener }
}
