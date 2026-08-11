import type { SupabaseClient } from '@supabase/supabase-js'
export interface Conversation { state: string; draft: any }
export async function getConversation(supabase: SupabaseClient, chatId: string): Promise<Conversation | null> {
  const { data } = await supabase.from('conversation_state').select('*').eq('chat_id', chatId).maybeSingle()
  return data ? { state: data.state, draft: data.draft } : null
}
export async function setConversation(supabase: SupabaseClient, chatId: string, state: string, draft: any): Promise<void> {
  await supabase.from('conversation_state').upsert({ chat_id: chatId, state, draft, updated_at: new Date().toISOString() })
}
export async function clearConversation(supabase: SupabaseClient, chatId: string): Promise<void> {
  await supabase.from('conversation_state').delete().eq('chat_id', chatId)
}
