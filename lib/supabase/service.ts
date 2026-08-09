import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client authenticated with the service (secret) key.
 * Bypasses RLS — never import this from client components.
 * Used by the Telegram webhook and OrderService, which run purely on the server
 * and are not tied to a user's cookie session.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
