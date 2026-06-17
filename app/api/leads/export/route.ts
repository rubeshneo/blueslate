import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTenantId } from '@/lib/get-tenant'

const MAX_ROWS = 5_000

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function row(cells: unknown[]): string {
  return cells.map(escapeCsv).join(',')
}

export async function GET() {
  try {
    const TENANT_ID = await getTenantId()

    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('caller_name, caller_phone, core_interest, call_outcome, booking_slot, parsed_at, call_logs(duration_seconds, full_transcript)')
      .eq('tenant_id', TENANT_ID)
      .order('parsed_at', { ascending: false })
      .limit(MAX_ROWS)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const leads = data ?? []
    if (leads.length === MAX_ROWS) {
      console.warn(`[leads/export] Hit ${MAX_ROWS} row cap for tenant ${TENANT_ID}`)
    }

    const header = row(['Date', 'Name', 'Phone', 'Interest', 'Outcome', 'Booking Slot', 'Duration (s)', 'Transcript (preview)'])

    const lines = leads.map((l) => {
      // call_logs join returns array or null
      const log = Array.isArray(l.call_logs) ? l.call_logs[0] : l.call_logs
      const transcript = (log?.full_transcript ?? '').slice(0, 200).replace(/\n/g, ' ')
      return row([
        l.parsed_at     ? new Date(l.parsed_at).toISOString()     : '',
        l.caller_name   ?? '',
        l.caller_phone  ?? '',
        l.core_interest ?? '',
        l.call_outcome  ?? '',
        l.booking_slot  ? new Date(l.booking_slot).toISOString()  : '',
        log?.duration_seconds ?? '',
        transcript,
      ])
    })

    const csv  = [header, ...lines].join('\r\n')
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads-${date}.csv"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status  = message === 'Not authenticated' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
