import type { SupabaseClient } from '@supabase/supabase-js'

interface Opts { limit?: number; windowMs?: number; now?: () => number }

export async function checkAndConsumeRate(
  supabase: SupabaseClient, chatId: string, opts: Opts = {},
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const limit = opts.limit ?? 3
  const windowMs = opts.windowMs ?? 60_000
  const now = (opts.now ?? Date.now)()
  const { data } = await supabase.from('rate_limits').select('*').eq('chat_id', chatId).maybeSingle()
  const start = data ? new Date(data.window_start).getTime() : 0
  if (!data || now - start > windowMs) {
    await supabase.from('rate_limits').upsert({ chat_id: chatId, window_start: new Date(now).toISOString(), count: 1 })
    return { allowed: true, retryAfterSec: 0 }
  }
  if (data.count < limit) {
    await supabase.from('rate_limits').upsert({ chat_id: chatId, window_start: data.window_start, count: data.count + 1 })
    return { allowed: true, retryAfterSec: 0 }
  }
  return { allowed: false, retryAfterSec: Math.ceil((windowMs - (now - start)) / 1000) }
}
