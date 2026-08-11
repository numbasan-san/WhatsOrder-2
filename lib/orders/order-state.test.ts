import { describe, it, expect } from 'vitest'
import { canTransition } from './order-state'
describe('canTransition', () => {
  it('allows the happy path', () => {
    expect(canTransition('pending_confirmation','pending')).toBe(true)
    expect(canTransition('pending','approved')).toBe(true)
    expect(canTransition('pending','rejected')).toBe(true)
    expect(canTransition('pending_confirmation','cancelled')).toBe(true)
  })
  it('rejects illegal jumps', () => {
    expect(canTransition('pending_confirmation','approved')).toBe(false)
    expect(canTransition('approved','rejected')).toBe(false)
    expect(canTransition('cancelled','pending')).toBe(false)
  })
})
