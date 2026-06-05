import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

const PatchSchema = z.object({
  agent_name:     z.string().min(1).max(80).trim().optional(),
  agent_greeting: z.string().min(1).max(200).trim().optional(),
  name:           z.string().min(1).max(120).trim().optional(),
  slug:           z.string().min(1).max(60).trim()
                    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
                    .optional(),
}).refine(
  (v) => Object.values(v).some((x) => x !== undefined),
  { message: 'At least one field is required' },
)

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('agent_name, agent_greeting, name, slug')
    .eq('id', TENANT_ID)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const parsed = PatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const patch = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  ) as Record<string, string>

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update(patch)
    .eq('id', TENANT_ID)
    .select('agent_name, agent_greeting, name, slug')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, ...data })
}
