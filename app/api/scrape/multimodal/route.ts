import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parseJson } from '@/lib/claude'
import { syncKnowledgeToVapi } from '@/lib/vapi'

const GROQ_API_KEY   = process.env.GROQ_API_KEY!
const VISION_MODEL   = 'meta-llama/llama-4-scout-17b-16e-instruct'
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB hard cap

const EXTRACTION_PROMPT = `You are an AI extraction engine for a franchise management platform.

Analyze this image — it may be a flyer, schedule board, price list, event poster, signage, or screenshot.

Extract all readable business information and return ONLY valid JSON matching this schema (no markdown, no explanation):

{
  "business_name":       "string or null",
  "tagline":             "string or null",
  "description":         "2-3 sentence summary of what this image shows",
  "services":            ["programs or services visible"],
  "age_groups":          ["age groups or grade levels mentioned"],
  "pricing":             "pricing details visible, or null",
  "location":            "address or location text visible, or null",
  "hours":               "operating hours or schedule text, or null",
  "contact_email":       "email if visible, else null",
  "contact_phone":       "phone number if visible, else null",
  "key_selling_points":  ["notable claims or promotional text"],
  "booking_cta":         "any sign-up or booking instructions visible, or null",
  "faqs":                []
}`

export async function POST(req: NextRequest) {
  try {
    const formData  = await req.formData()
    const file      = formData.get('file') as File | null
    const tenantId  = formData.get('tenant_id') as string | null

    if (!file || !tenantId) {
      return NextResponse.json({ error: 'file and tenant_id are required' }, { status: 400 })
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}. Use PNG, JPEG, or WebP.` }, { status: 400 })
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 400 })
    }

    // ── Base64-encode the image for Groq vision API ────────────────
    const buffer    = await file.arrayBuffer()
    const base64    = Buffer.from(buffer).toString('base64')
    const dataUrl   = `data:${file.type};base64,${base64}`
    const sourceRef = `vision-upload:${file.name}`

    // ── Call Groq vision model ────────────────────────────────────
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:      VISION_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!groqRes.ok) {
      const errBody = await groqRes.text().catch(() => '')
      throw new Error(`Groq vision API ${groqRes.status}: ${errBody.slice(0, 300)}`)
    }

    const groqData = await groqRes.json() as {
      choices: { message: { content: string } }[]
    }
    const rawText = groqData.choices[0]?.message?.content ?? ''

    let structured_data: unknown
    try {
      structured_data = parseJson(rawText)
    } catch {
      structured_data = { raw_extraction: rawText, parse_error: true }
    }

    const { data, error } = await supabaseAdmin
      .from('knowledge_context')
      .upsert(
        {
          tenant_id:       tenantId,
          source_url:      sourceRef,
          raw_content:     rawText,
          structured_data,
          scraped_at:      new Date().toISOString(),
          is_active:       true,
        },
        { onConflict: 'tenant_id,source_url' },
      )
      .select()
      .single()

    if (error) throw error

    // Refresh Blueslate demo assistant (non-blocking)
    syncKnowledgeToVapi().catch((e: Error) =>
      console.warn('[Multimodal] Vapi sync skipped:', e.message)
    )

    return NextResponse.json({
      success:           true,
      knowledge_context: data,
      source_type:       'vision',
      model:             VISION_MODEL,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Multimodal] Extraction error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
