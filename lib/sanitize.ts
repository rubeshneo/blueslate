const SCRIPT_RE  = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
const JS_URI_RE  = /javascript\s*:/gi
const HTML_TAG_RE = /<[^>]+>/g
const NULL_RE    = /\x00/g

export function sanitizeText(input: string): string {
  return input
    .replace(NULL_RE, '')
    .replace(SCRIPT_RE, '')
    .replace(JS_URI_RE, '')
    .replace(HTML_TAG_RE, '')
    .trim()
}
