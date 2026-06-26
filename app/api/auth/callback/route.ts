import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const otpType = searchParams.get('type') as EmailOtpType | null
  // `flow` distinguishes the Sign Up page ('signup') from the Sign In page ('signin').
  // Default to the strict 'signin' so any unexpected OAuth entry is treated as sign-in.
  const flow = searchParams.get('flow') ?? 'signin'
  const nextParam = searchParams.get('next') ?? '/'
  const next = nextParam.startsWith('/') ? nextParam : '/' // prevent open redirect

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // ── Email-link verification (password recovery, magic link, email confirm) ──
  // token_hash works across devices (no PKCE verifier needed), so it's the robust
  // path for links opened on a different browser than where they were requested.
  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({ type: otpType, token_hash: tokenHash })
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=link_expired`)
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  // ── OAuth / PKCE code exchange ──
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_error`)
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=oauth_error`)
  }

  // Supabase OAuth silently CREATES an account on first sign-in. We only want that
  // to happen from the Sign Up page. If a brand-new Google account arrives via the
  // Sign In page, undo it — delete the just-created user and send them to register.
  // (Password recovery via code is for existing users, so this never trips them.)
  const createdAtMs = new Date(data.user.created_at).getTime()
  const isBrandNew  = Date.now() - createdAtMs < 60_000

  if (flow !== 'signup' && isBrandNew) {
    await supabase.auth.signOut()
    try {
      await supabaseAdmin.auth.admin.deleteUser(data.user.id)
    } catch (e) {
      console.error('[auth/callback] Failed to remove backdoor OAuth user:', e)
    }
    return NextResponse.redirect(`${origin}/login?error=no_account`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
