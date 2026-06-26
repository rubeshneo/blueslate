// One-off: create (or repair) a confirmed admin user, bypassing email OTP,
// then VERIFY the credentials actually work via a real sign-in.
// Usage:  node scripts/create-admin.mjs <email> [password]
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const url     = env.NEXT_PUBLIC_SUPABASE_URL
const svcKey  = env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
console.log('Supabase project:', url)

const email = (process.argv[2] || 'rubesh.kumar@neoaistriq.com').toLowerCase()
const password = process.argv[3] || 'Blueslate#2026'

const admin = createClient(url, svcKey, { auth: { autoRefreshToken: false, persistSession: false } })

// Find existing user (any casing)
const { data: list } = await admin.auth.admin.listUsers()
const existing = list?.users?.find((u) => u.email?.toLowerCase() === email)

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password, email_confirm: true,
  })
  console.log(error ? `✗ update failed: ${error.message}` : `✓ updated user ${existing.id}`)
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: 'Rubesh Kumar S' },
  })
  console.log(error ? `✗ create failed: ${error.message}` : `✓ created user ${data.user.id}`)
}

// Verify: real sign-in with the anon key (same path the app uses)
const pub = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: signIn, error: signErr } = await pub.auth.signInWithPassword({ email, password })
console.log('\n── VERIFY sign-in ──')
console.log(signErr ? `✗ sign-in FAILED: ${signErr.message}` : `✓ sign-in OK as ${signIn.user.email}`)
console.log(`\n  Email:    ${email}\n  Password: ${password}\n`)
