import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTenantId } from '@/lib/get-tenant'

const PAGE_SIZE = 25

export async function GET(req: NextRequest) {
  try {
    const TENANT_ID = await getTenantId()
    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor') // ISO timestamp — cursor pagination

    let query = supabaseAdmin
      .from('leads')
      .select('id, caller_name, caller_phone, core_interest, call_outcome, booking_slot, parsed_at, call_log_id, call_logs(full_transcript, recording_url, duration_seconds)')
      .eq('tenant_id', TENANT_ID)
      .order('parsed_at', { ascending: false })
      .limit(PAGE_SIZE + 1) // +1 to detect hasMore

    if (cursor) {
      query = query.lt('parsed_at', cursor)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const hasMore = (data?.length ?? 0) > PAGE_SIZE
    const leads   = hasMore ? data!.slice(0, PAGE_SIZE) : (data ?? [])

    return NextResponse.json({
      leads,
      hasMore,
      nextCursor: hasMore ? leads[leads.length - 1]?.parsed_at ?? null : null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
