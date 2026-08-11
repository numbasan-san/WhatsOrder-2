import { describe, it, expect } from 'vitest'
import { checkAndConsumeRate } from './rate-limit'

function fakeClient(store: Map<string, any>) {
  return {
    from() {
      return {
        select() { return this },
        eq(_c: string, v: string) { this._k = v; return this },
        maybeSingle() { return Promise.resolve({ data: store.get(this._k) ?? null, error: null }) },
        upsert(row: any) { store.set(row.chat_id, row); return Promise.resolve({ error: null }) },
      } as any
    },
  } as any
}

describe('checkAndConsumeRate', () => {
  it('allows first N then blocks within window', async () => {
    const store = new Map()
    let now = 1_000_000
    const clock = () => now
    const opts = { limit: 3, windowMs: 60_000, now: clock }
    const c = fakeClient(store)
    expect((await checkAndConsumeRate(c, 'u1', opts)).allowed).toBe(true)
    expect((await checkAndConsumeRate(c, 'u1', opts)).allowed).toBe(true)
    expect((await checkAndConsumeRate(c, 'u1', opts)).allowed).toBe(true)
    const blocked = await checkAndConsumeRate(c, 'u1', opts)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })
  it('resets after the window passes', async () => {
    const store = new Map()
    let now = 1_000_000
    const opts = { limit: 1, windowMs: 60_000, now: () => now }
    const c = fakeClient(store)
    expect((await checkAndConsumeRate(c, 'u1', opts)).allowed).toBe(true)
    expect((await checkAndConsumeRate(c, 'u1', opts)).allowed).toBe(false)
    now += 60_001
    expect((await checkAndConsumeRate(c, 'u1', opts)).allowed).toBe(true)
  })
})
