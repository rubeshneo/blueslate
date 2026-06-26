// One-off: create (or repair) a confirmed admin user, bypassing email OTP.
// Usage:  node scripts/create-admin.mjs <email> [password]
// Reads Supabase creds from .env.local.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing Supabase env'); process.exit(1) }

const email = (process.argv[2] || 'rubesh.kumar@neoaistriq.com').toLowerCase()
const password = process.argv[3] || (randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '') + 'Aa9!')

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: created, error } = await supabase.auth.admin.createUser({
  email, password, email_confirm: true,
  user_metadata: { full_name: 'Rubesh Kumar S' },
})

if (error) {
  const { data: list } = await supabase.auth.admin.listUsers()
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email)
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
    console.log(`✓ Existing user repaired & confirmed: ${email}`)
  } else {
    console.error('✗ Failed:', error.message)
    process.exit(1)
  }
} else {
  console.log(`✓ Created & confirmed: ${created.user.email}`)
}
console.log(`\n  Email:    ${email}\n  Password: ${password}\n\n  → Log in at /admin-login (change the password after first login).`)
