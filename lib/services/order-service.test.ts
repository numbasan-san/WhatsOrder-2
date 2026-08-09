import { describe, it, expect } from 'vitest'
import { OrderService, OrderTransitionConflictError } from './order-service'

/**
 * Minimal hand-rolled fake for the two tables OrderService.transition()/audit() touch.
 * Mirrors the style of the existing rate-limit/idempotency/conversation fakes: no real
 * DB, just enough chainable methods to drive the code path under test.
 *
 * - 'pedidos': the first `.select('*').eq('id',...).single()` (loadOrder) returns
 *   `initialOrder`; the conditional `.update(...).eq('id',...).eq('status',...).select().single()`
 *   returns `updateResult` (either the updated row, or a null/error result simulating
 *   a lost race where the conditional UPDATE matched zero rows).
 * - 'audit_log': every insert is captured in `auditInserts`.
 */
function fakeSupabase(initialOrder: Record<string, unknown>, updateResult: { data: any; error: any }) {
  const auditInserts: any[] = []
  const client = {
    from(table: string) {
      if (table === 'pedidos') {
        return {
          select() {
            const selectBuilder = {
              eq() { return selectBuilder },
              single() { return Promise.resolve({ data: initialOrder, error: null }) },
            }
            return selectBuilder
          },
          update(_patch: Record<string, unknown>) {
            const updateBuilder = {
              eq() { return updateBuilder },
              select() { return updateBuilder },
              single() { return Promise.resolve(updateResult) },
            }
            return updateBuilder
          },
        }
      }
      if (table === 'audit_log') {
        return {
          insert(row: any) {
            auditInserts.push(row)
            return Promise.resolve({ error: null })
          },
        }
      }
      throw new Error(`fakeSupabase: unexpected table '${table}'`)
    },
  }
  return { client: client as any, auditInserts }
}

const BASE_ORDER = { id: 'p1', status: 'pending_confirmation', telegram_chat_id: '111' }

describe('OrderService transition guard (confirmOrder)', () => {
  it('happy path: updates status, returns the updated order, writes exactly one audit row', async () => {
    const updatedOrder = { ...BASE_ORDER, status: 'pending', confirmed_at: '2026-01-01T00:00:00.000Z' }
    const { client, auditInserts } = fakeSupabase(BASE_ORDER, { data: updatedOrder, error: null })
    const service = new OrderService(client)

    const result = await service.confirmOrder('p1')

    expect(result.status).toBe('pending')
    expect(result.confirmed_at).toBe('2026-01-01T00:00:00.000Z')
    expect(auditInserts).toHaveLength(1)
    expect(auditInserts[0]).toMatchObject({ pedido_id: 'p1', actor_type: 'customer', action: 'confirmed' })
  })

  it('lost-race path: conditional update matches zero rows -> throws OrderTransitionConflictError, no audit written', async () => {
    // Simulates the conditional `.eq('status', order.status)` UPDATE matching nothing
    // because another concurrent request already moved the pedido out of that status.
    const { client, auditInserts } = fakeSupabase(BASE_ORDER, {
      data: null,
      error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    })
    const service = new OrderService(client)

    await expect(service.confirmOrder('p1')).rejects.toThrow(OrderTransitionConflictError)
    expect(auditInserts).toHaveLength(0)
  })
})
