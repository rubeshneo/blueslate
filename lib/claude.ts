import Groq from 'groq-sdk'

const client = new Groq({ apiKey: process.env.GROQ_API_KEY })
export const MODEL_FAST  = 'llama-3.1-8b-instant'    // ~300ms — receptionist Q&A, extraction
export const MODEL_SMART = 'llama-3.3-70b-versatile'  // ~4s   — nuanced transcript parsing only

export async function chat(
  prompt: string,
  maxTokens: number,
  model = MODEL_FAST,
  systemPrompt?: string,
): Promise<string> {
  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const res = await client.chat.completions.create({ model, max_tokens: maxTokens, messages })
  return res.choices[0]?.message?.content ?? ''
}

// Streaming variant — returns a ReadableStream<Uint8Array> for piping to Response
export async function chatStream(
  prompt: string,
  maxTokens: number,
  model = MODEL_FAST,
  systemPrompt?: string,
): Promise<ReadableStream<Uint8Array>> {
  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const groqStream = await client.chat.completions.create({
    model, max_tokens: maxTokens, messages, stream: true,
  })

  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of groqStream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) controller.enqueue(encoder.encode(text))
        }
      } finally {
        controller.close()
      }
    },
  })
}

export function parseJson(text: string): unknown {
  // Step 1: extract content from inside a fenced block if one exists anywhere in the output.
  // Handles: prose before the fence, ```json or ``` opener, any whitespace variation.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate  = fenceMatch ? fenceMatch[1].trim() : text.trim()

  // Step 2: find the first complete {...} JSON object in the candidate string.
  // Protects against trailing prose after the closing brace.
  const objectMatch = candidate.match(/\{[\s\S]*\}/)

  // Step 3: parse whichever representation is most specific.
  const raw = objectMatch ? objectMatch[0] : candidate
  if (!raw) throw new SyntaxError('parseJson: empty input after fence/object extraction')
  return JSON.parse(raw)
}

// ─── Extract structured knowledge from scraped HTML/text ─────────────────────
export async function extractKnowledge(rawText: string, sourceUrl: string) {
  const text = await chat(
    `You are extracting structured knowledge for a franchise AI receptionist system.

From the following scraped website text, extract key information about the franchise business.
Return ONLY valid JSON matching this schema — no markdown, no explanation:

{
  "business_name": "string",
  "tagline": "string or null",
  "description": "string (2-3 sentences summary)",
  "services": ["list of programs or services offered"],
  "age_groups": ["target age groups if mentioned"],
  "pricing": "pricing summary or null",
  "location": "address or city/state",
  "hours": "operating hours or null",
  "contact_email": "string or null",
  "contact_phone": "string or null",
  "key_selling_points": ["top 3-5 USPs"],
  "booking_cta": "how to sign up or book a trial (e.g. 'Call us' or 'Book online at URL')",
  "faqs": [{"question": "string", "answer": "string"}]
}

Source URL: ${sourceUrl}

Scraped content:
${rawText.slice(0, 4000)}`,
    800
  )

  try {
    return parseJson(text)
  } catch {
    return { raw_extraction: text, parse_error: true }
  }
}

// ─── Extract knowledge from social media profiles ────────────────────────────
export async function extractKnowledgeSocial(rawText: string, sourceUrl: string) {
  const text = await chat(
    `You are extracting structured knowledge from a social media profile for a franchise AI receptionist system.

Social profiles contain bios, post captions, and links rather than formal web pages.
Extract whatever business information is present and return ONLY valid JSON:

{
  "business_name": "string or null",
  "tagline": "string or null (bio/description)",
  "description": "string (1-2 sentence summary from bio and post context)",
  "services": ["programs or services mentioned in posts/bio"],
  "age_groups": ["target age groups if mentioned"],
  "pricing": "pricing if mentioned, else null",
  "location": "location tag or city mentioned, else null",
  "hours": "hours if mentioned, else null",
  "contact_email": "email if mentioned, else null",
  "contact_phone": "phone if mentioned, else null",
  "key_selling_points": ["3-5 selling points inferred from bio/posts"],
  "booking_cta": "link-in-bio CTA or how to book, else null",
  "faqs": []
}

Source URL: ${sourceUrl}

Profile content:
${rawText.slice(0, 4000)}`,
    800
  )

  try {
    return parseJson(text)
  } catch {
    return { raw_extraction: text, parse_error: true }
  }
}

export interface TranscriptResult {
  caller_name:   string | null
  caller_phone:  string | null
  core_interest: string | null
  call_outcome:  'booked' | 'interested' | 'not-interested' | 'callback-requested' | 'unknown'
  booking_slot:  string | null
  summary?:      string
  raw_extraction?: string
  parse_error?:    boolean
}

// ─── Parse call transcript for lead data ────────────────────────────────────
export async function parseTranscript(transcript: string): Promise<TranscriptResult> {
  const text = await chat(
    `You are a lead extraction engine for a franchise AI receptionist.

From the following call transcript, extract caller information.
Return ONLY valid JSON — no markdown, no explanation:

{
  "caller_name": "string or null",
  "caller_phone": "string or null (as mentioned in conversation)",
  "core_interest": "string — what they were calling about",
  "call_outcome": "one of: booked | interested | not-interested | callback-requested | unknown",
  "booking_slot": "ISO 8601 datetime string if a specific time was booked, else null",
  "summary": "2-3 sentence summary of the call"
}

Transcript:
${transcript.slice(0, 6000)}`,
    1024,
    MODEL_SMART,
  )

  try {
    return parseJson(text) as TranscriptResult
  } catch (err) {
    console.error('[WEBHOOK_LEAD_ERROR]: parseTranscript JSON parse failed', {
      error:    err instanceof Error ? err.message : err,
      groq_raw: text.slice(0, 500),
    })
    return {
      caller_name:   null,
      caller_phone:  null,
      core_interest: null,
      call_outcome:  'unknown',
      booking_slot:  null,
      raw_extraction: text,
      parse_error:    true,
    }
  }
}
