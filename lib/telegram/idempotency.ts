import type { SupabaseClient } from '@supabase/supabase-js'
export async function alreadyProcessed(supabase: SupabaseClient, updateId: number): Promise<boolean> {
  const { data } = await supabase.from('processed_updates').select('update_id').eq('update_id', updateId).maybeSingle()
  return !!data
}
export async function markProcessed(supabase: SupabaseClient, updateId: number): Promise<void> {
  await supabase.from('processed_updates').insert({ update_id: updateId })
}
