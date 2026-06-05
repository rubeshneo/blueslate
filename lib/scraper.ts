// ─── Social platform detection ────────────────────────────────────────────

const SOCIAL_DOMAINS = new Set([
  'instagram.com', 'www.instagram.com',
  'facebook.com', 'www.facebook.com',
  'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com',
  'tiktok.com', 'www.tiktok.com',
  'linkedin.com', 'www.linkedin.com',
  'youtube.com', 'www.youtube.com',
])

export function isSocialUrl(url: string): boolean {
  const trimmed = url.trim()
  if (trimmed.startsWith('@')) return true
  try {
    const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    const parsed = new URL(withProto)
    return SOCIAL_DOMAINS.has(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}

// ─── URL normalizer ───────────────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()

  // @handle → Instagram profile URL
  if (trimmed.startsWith('@')) {
    const handle = trimmed.slice(1).toLowerCase()
    return `https://www.instagram.com/${handle}/`
  }

  const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(withProto)
    parsed.hostname = parsed.hostname.toLowerCase()
    if (!parsed.hostname.includes('.')) {
      return `https://${trimmed.toLowerCase()}.com`
    }
    return parsed.toString()
  } catch {
    throw new Error(`"${raw}" is not a valid URL. Try something like pizzahut.com`)
  }
}

// ─── Jina.ai scraper ──────────────────────────────────────────────────────

// Uses Jina.ai Reader — free, no API key, handles JS-rendered pages and bot-protected sites
export async function scrapeUrl(url: string): Promise<{
  rawText: string
  title: string
  isSocial: boolean
}> {
  const normalized  = normalizeUrl(url)
  const social      = isSocialUrl(url)
  const jinaUrl     = `https://r.jina.ai/${normalized}`

  const response = await fetch(jinaUrl, {
    headers: {
      Accept: 'text/plain',
      'X-Return-Format': 'markdown',
    },
    signal: AbortSignal.timeout(20000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Jina ${response.status}: ${body.slice(0, 300) || 'No details'}`)
  }

  const text = await response.text()

  const titleMatch = text.match(/^Title:\s*(.+)$/m)
  const title = titleMatch ? titleMatch[1].trim() : normalized

  return {
    rawText:  text.slice(0, 5000),
    title,
    isSocial: social,
  }
}
