import { describe, it, expect } from 'vitest'
import { getConversation, setConversation, clearConversation } from './conversation'
function fake(store: Map<string, any>) {
  return { from() { return {
    select(){ return this }, eq(_c:string,v:string){ this._k=v; return this },
    maybeSingle(){ return Promise.resolve({ data: store.get(this._k) ?? null, error: null }) },
    upsert(row:any){ store.set(row.chat_id, row); return Promise.resolve({ error:null }) },
    delete(){ return { eq: (_c:string,v:string)=>{ store.delete(v); return Promise.resolve({ error:null }) } } },
  } as any } } as any
}
describe('conversation', () => {
  it('sets, gets, clears', async () => {
    const s = new Map(); const c = fake(s)
    await setConversation(c, 'u1', 'awaiting_address', { items: [] })
    expect((await getConversation(c, 'u1'))?.state).toBe('awaiting_address')
    await clearConversation(c, 'u1')
    expect(await getConversation(c, 'u1')).toBeNull()
  })
})
