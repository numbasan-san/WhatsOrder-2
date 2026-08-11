import { describe, it, expect } from 'vitest'
import { alreadyProcessed, markProcessed, claimUpdate } from './idempotency'

function fake(store: Set<number>) {
  return { from() { return {
    select() { return this }, eq(_c:string,v:number){ this._v=v; return this },
    maybeSingle(){ return Promise.resolve({ data: store.has(this._v)?{update_id:this._v}:null, error:null }) },
    insert(row:any){
      if (store.has(row.update_id)) {
        // Simulate the processed_updates primary-key unique-violation Postgres/PostgREST
        // returns when a concurrent request already inserted this update_id.
        return Promise.resolve({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } })
      }
      store.add(row.update_id)
      return Promise.resolve({ error: null })
    },
  } as any } } as any
}

describe('idempotency', () => {
  it('detects and marks', async () => {
    const s = new Set<number>(); const c = fake(s)
    expect(await alreadyProcessed(c, 42)).toBe(false)
    await markProcessed(c, 42)
    expect(await alreadyProcessed(c, 42)).toBe(true)
  })

  describe('claimUpdate', () => {
    it('claims the update_id the first time it is seen', async () => {
      const s = new Set<number>(); const c = fake(s)
      expect(await claimUpdate(c, 100)).toBe(true)
    })

    it('returns false on a simulated unique-violation (concurrent duplicate)', async () => {
      const s = new Set<number>(); const c = fake(s)
      expect(await claimUpdate(c, 100)).toBe(true)
      expect(await claimUpdate(c, 100)).toBe(false)
    })
  })
})
