import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

/**
 * Server-side, cookie-bound Supabase client — the USER-CONTEXT client.
 * Uses the ANON/publishable key so `auth.signInWithPassword`/`getUser` set
 * and read the caller's session, and queries run under that user's RLS.
 * Never put the secret key here — that belongs only in lib/supabase/service.ts.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
})