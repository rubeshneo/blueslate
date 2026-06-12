import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { scrapeUrl } from '@/lib/scraper'
import { extractKnowledge, extractKnowledgeSocial } from '@/lib/claude'
import { supabaseAdmin } from '@/lib/supabase'
import { syncKnowledgeToVapi } from '@/lib/vapi'

const ScrapeSchema = z.object({
  url:       z.string().min(1, 'URL is required').max(2000),
  tenant_id: z.string().uuid('Invalid tenant_id'),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = ScrapeSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const { url, tenant_id } = parsed.data

    // Loop A: Instant Knowledge Loop
    const { rawText, title, isSocial } = await scrapeUrl(url)

    // Route to the appropriate Groq prompt based on source type
    const structured_data = isSocial
      ? await extractKnowledgeSocial(rawText, url)
      : await extractKnowledge(rawText, url)

    const { data, error } = await supabaseAdmin
      .from('knowledge_context')
      .upsert(
        {
          tenant_id,
          source_url:      url,
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

    // Update tenant franchise_url
    await supabaseAdmin.from('tenants').update({ franchise_url: url }).eq('id', tenant_id)

    // Refresh Blueslate demo assistant (non-blocking)
    syncKnowledgeToVapi().catch((e: Error) =>
      console.warn('[Scrape] Vapi sync skipped:', e.message)
    )

    return NextResponse.json({
      success:           true,
      knowledge_context: data,
      page_title:        title,
      source_type:       isSocial ? 'social' : 'website',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
