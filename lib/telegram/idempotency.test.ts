import { describe, it, expect } from 'vitest'
import { alreadyProcessed, markProcessed } from './idempotency'
function fake(store: Set<number>) {
  return { from() { return {
    select() { return this }, eq(_c:string,v:number){ this._v=v; return this },
    maybeSingle(){ return Promise.resolve({ data: store.has(this._v)?{update_id:this._v}:null, error:null }) },
    insert(row:any){ store.add(row.update_id); return Promise.resolve({ error:null }) },
  } as any } } as any
}
describe('idempotency', () => {
  it('detects and marks', async () => {
    const s = new Set<number>(); const c = fake(s)
    expect(await alreadyProcessed(c, 42)).toBe(false)
    await markProcessed(c, 42)
    expect(await alreadyProcessed(c, 42)).toBe(true)
  })
})
