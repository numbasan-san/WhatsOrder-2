import type { SupabaseClient } from '@supabase/supabase-js'

const POSTGRES_UNIQUE_VIOLATION = '23505'

export async function alreadyProcessed(supabase: SupabaseClient, updateId: number): Promise<boolean> {
  const { data } = await supabase.from('processed_updates').select('update_id').eq('update_id', updateId).maybeSingle()
  return !!data
}

export async function markProcessed(supabase: SupabaseClient, updateId: number): Promise<void> {
  await supabase.from('processed_updates').insert({ update_id: updateId })
}

/**
 * Atomically claims an update_id: the INSERT itself is the concurrency gate, closing
 * the check-then-insert race that a separate alreadyProcessed()+markProcessed() call
 * pair leaves open. Returns true if this call claimed the id (first time seen), false
 * if a concurrent request already claimed it (unique-violation on the primary key).
 */
export async function claimUpdate(supabase: SupabaseClient, updateId: number): Promise<boolean> {
  const { error } = await supabase.from('processed_updates').insert({ update_id: updateId })
  if (!error) return true
  if (error.code === POSTGRES_UNIQUE_VIOLATION) return false
  throw error
}
