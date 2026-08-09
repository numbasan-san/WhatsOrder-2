import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Crear cliente de Supabase (user-context: ANON key, session refresh only)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Para refrescar la sesión
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Gate: unauthenticated users trying to reach the dashboard go to /login.
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/login', request.url)
    const redirectResponse = NextResponse.redirect(loginUrl)
    // Carry over any cookie writes (e.g. clearing a stale/invalid session)
    // that setAll() already applied to supabaseResponse — a fresh redirect
    // response would otherwise silently drop them.
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  return supabaseResponse
}