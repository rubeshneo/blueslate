import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { getTenantId } from '@/lib/get-tenant'
import { syncTenantKnowledgeToVapi } from '@/lib/vapi'

const DaySchema = z.object({
  enabled: z.boolean(),
  open:    z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  close:   z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
})

const Schema = z.object({
  timezone:            z.string().min(1),
  hours: z.object({
    mon: DaySchema, tue: DaySchema, wed: DaySchema,
    thu: DaySchema, fri: DaySchema, sat: DaySchema, sun: DaySchema,
  }),
  after_hours_message: z.string().max(500),
})

export async function GET() {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('business_hours')
      .eq('id', tenantId)
      .single()

    if (error) throw error
    return NextResponse.json({ business_hours: (data as { business_hours: unknown }).business_hours ?? null })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantId()
    const body = await req.json() as unknown
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      )
    }

    const { error } = await supabaseAdmin
      .from('tenants')
      .update({ business_hours: parsed.data })
      .eq('id', tenantId)

    if (error) throw error

    // Re-sync Vapi assistant so after-hours message takes effect immediately
    syncTenantKnowledgeToVapi(tenantId).catch((e: Error) =>
      console.warn('[business-hours] Vapi sync skipped:', e.message)
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
