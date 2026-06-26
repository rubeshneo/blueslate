import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'rubesh.kumar@neoaistriq.com').toLowerCase()
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL

  const isAdminLogin = pathname === '/admin-login'
  const isAdminArea  = pathname === '/admin' || pathname.startsWith('/admin/')
  const isAuthRoute  = pathname === '/login' || pathname === '/register'
  const isRecovery   = pathname === '/forgot-password' || pathname === '/reset-password'
  const isPublic = isAuthRoute || isAdminLogin || isRecovery || pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname === '/landing'

  if (!user && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/landing'
    return NextResponse.redirect(url)
  }

  // Admin area: gate on the admin email at the edge. Non-admins and guests
  // are funneled to the dedicated admin login rather than the franchise login.
  if (isAdminArea && !isAdmin) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin-login'
    return NextResponse.redirect(url)
  }

  // Already-authenticated admin shouldn't see the admin login.
  if (isAdminLogin && isAdmin) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
