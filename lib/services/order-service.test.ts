import { describe, it, expect } from 'vitest'
import { OrderService, OrderTransitionConflictError, UnknownSkuError } from './order-service'

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

  it('real DB error (non-PGRST116) propagates as-is, is NOT mistaken for a lost race, writes no audit', async () => {
    // A genuine failure -- connection drop, permissions, an unrelated constraint -- must
    // not be conflated with the benign "already transitioned" case, or the webhook would
    // tell the customer "Ya procesado" when nothing actually changed.
    const connectionError = { code: '08006', message: 'connection failure' }
    const { client, auditInserts } = fakeSupabase(BASE_ORDER, { data: null, error: connectionError })
    const service = new OrderService(client)

    let caught: unknown
    try {
      await service.confirmOrder('p1')
    } catch (e) {
      caught = e
    }

    expect(caught).not.toBeInstanceOf(OrderTransitionConflictError)
    expect(caught).toMatchObject({ code: '08006' })
    expect(auditInserts).toHaveLength(0)
  })

  it('disallowed transition (e.g. double-confirm on an order already pending) throws OrderTransitionConflictError, no audit written', async () => {
    // canTransition('pending', 'pending') is false -- ALLOWED['pending'] only permits
    // 'approved'/'rejected'. This must surface as the same conflict type as a lost race
    // (not a generic Error), so the webhook/routes treat a double-tap as a benign no-op
    // ("Ya procesado" / 409) instead of a scary error.
    const alreadyPending = { id: 'p1', status: 'pending', telegram_chat_id: '111' }
    const { client, auditInserts } = fakeSupabase(alreadyPending, { data: null, error: null })
    const service = new OrderService(client)

    let caught: unknown
    try {
      await service.confirmOrder('p1')
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(OrderTransitionConflictError)
    expect((caught as Error).name).toBe('OrderTransitionConflictError')
    expect(auditInserts).toHaveLength(0)
  })
})

/**
 * Fake for assignDelivery(): 'pedidos' select().eq().single() returns `initialOrder`;
 * the plain (non-conditional-on-status) update().eq('id',...).select().single() returns
 * `updateResult`. 'audit_log' inserts are captured like above.
 */
function fakeSupabaseForDelivery(initialOrder: Record<string, unknown>, updateResult: { data: any; error: any }) {
  const auditInserts: any[] = []
  const updateCalls: any[] = []
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
          update(patch: Record<string, unknown>) {
            updateCalls.push(patch)
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
      throw new Error(`fakeSupabaseForDelivery: unexpected table '${table}'`)
    },
  }
  return { client: client as any, auditInserts, updateCalls }
}

describe('OrderService.assignDelivery', () => {
  it('patches delivery_* columns on an approved order and writes an assigned_delivery audit row', async () => {
    const initialOrder = { id: 'p1', status: 'approved' }
    const updatedOrder = {
      id: 'p1',
      status: 'approved',
      delivery_assigned_to: 'James Cooper',
      delivery_status: 'assigned',
      delivery_eta: '2026-08-09T18:00:00.000Z',
    }
    const { client, auditInserts, updateCalls } = fakeSupabaseForDelivery(initialOrder, {
      data: updatedOrder,
      error: null,
    })
    const service = new OrderService(client)

    const result = await service.assignDelivery('p1', 'csr-1', {
      assigned_to: 'James Cooper',
      delivery_status: 'assigned',
      delivery_eta: '2026-08-09T18:00:00.000Z',
    })

    expect(result).toEqual(updatedOrder)
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0]).toMatchObject({
      delivery_assigned_to: 'James Cooper',
      delivery_status: 'assigned',
      delivery_eta: '2026-08-09T18:00:00.000Z',
    })
    expect(auditInserts).toHaveLength(1)
    expect(auditInserts[0]).toMatchObject({
      pedido_id: 'p1',
      actor_type: 'csr',
      actor_id: 'csr-1',
      action: 'assigned_delivery',
    })
  })

  it('rejects assigning delivery on a non-approved order, writes no audit', async () => {
    const initialOrder = { id: 'p1', status: 'pending' }
    const { client, auditInserts } = fakeSupabaseForDelivery(initialOrder, { data: null, error: null })
    const service = new OrderService(client)

    await expect(
      service.assignDelivery('p1', 'csr-1', { assigned_to: 'James Cooper', delivery_status: 'assigned', delivery_eta: null }),
    ).rejects.toThrow(/approved/)
    expect(auditInserts).toHaveLength(0)
  })
})

/**
 * Fake for createManualOrder(): 'productos' select().eq('active',true).order() returns the
 * catalog; 'pedidos' insert().select().single() returns `insertResult`; 'audit_log' captures
 * inserts like the other fakes.
 */
function fakeSupabaseForManualOrder(catalog: Record<string, unknown>[], insertResult: { data: any; error: any }) {
  const auditInserts: any[] = []
  const pedidoInserts: any[] = []
  const client = {
    from(table: string) {
      if (table === 'productos') {
        return {
          select() {
            const builder = {
              eq() { return builder },
              order() { return Promise.resolve({ data: catalog, error: null }) },
            }
            return builder
          },
        }
      }
      if (table === 'pedidos') {
        return {
          insert(row: any) {
            pedidoInserts.push(row)
            const builder = {
              select() { return builder },
              single() { return Promise.resolve(insertResult) },
            }
            return builder
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
      throw new Error(`fakeSupabaseForManualOrder: unexpected table '${table}'`)
    },
  }
  return { client: client as any, auditInserts, pedidoInserts }
}

const CATALOG = [
  { sku: 'arroz-5lb', name: 'Arroz premium 5lb', price: 220, stock: 10, active: true },
  { sku: 'leche-1l', name: 'Leche entera 1L', price: 65, stock: 10, active: true },
]

/**
 * Fake for the Telegram draft flow (createDraftFromMessage / completeDraftWithName /
 * completeDraftWithAddress): 'productos' select returns the catalog; 'conversation_state'
 * supports maybeSingle() read (seeded via `conversation`), upsert (captured in `convUpserts`)
 * and delete (captured in `convDeletes`); 'pedidos' insert returns `insertResult`.
 */
function fakeSupabaseForDraft(
  catalog: Record<string, unknown>[],
  conversation: { state: string; draft: any } | null,
  insertResult: { data: any; error: any },
) {
  const convUpserts: any[] = []
  const convDeletes: string[] = []
  const pedidoInserts: any[] = []
  const client = {
    from(table: string) {
      if (table === 'productos') {
        const builder: any = { select: () => builder, eq: () => builder, order: () => Promise.resolve({ data: catalog, error: null }) }
        return builder
      }
      if (table === 'conversation_state') {
        return {
          select() {
            const b: any = { eq: () => b, maybeSingle: () => Promise.resolve({ data: conversation ? { state: conversation.state, draft: conversation.draft } : null, error: null }) }
            return b
          },
          upsert(row: any) { convUpserts.push(row); return Promise.resolve({ error: null }) },
          delete() { return { eq: (_c: string, id: string) => { convDeletes.push(id); return Promise.resolve({ error: null }) } } },
        }
      }
      if (table === 'pedidos') {
        return {
          insert(row: any) {
            pedidoInserts.push(row)
            const b: any = { select: () => b, single: () => Promise.resolve(insertResult) }
            return b
          },
        }
      }
      if (table === 'audit_log') {
        return { insert() { return Promise.resolve({ error: null }) } }
      }
      throw new Error(`fakeSupabaseForDraft: unexpected table '${table}'`)
    },
  }
  return { client: client as any, convUpserts, convDeletes, pedidoInserts }
}

/** Fake GeminiAdapter returning a fixed ParsedOrder. */
function fakeGemini(parsed: { items: { name: string; quantity: number }[]; deliveryAddress: string | null; customerName: string | null }) {
  return { interpret: async () => parsed } as any
}

describe('OrderService.createDraftFromMessage — name step', () => {
  it('parks awaiting_name when the customer name is unknown', async () => {
    const { client, convUpserts } = fakeSupabaseForDraft(CATALOG, null, { data: null, error: null })
    const gemini = fakeGemini({ items: [{ name: 'leche', quantity: 2 }], deliveryAddress: null, customerName: null })
    const service = new OrderService(client, gemini)

    const res = await service.createDraftFromMessage('111', 'quiero 2 leche')

    expect(res.status).toBe('need_name')
    expect(convUpserts).toHaveLength(1)
    expect(convUpserts[0]).toMatchObject({ chat_id: '111', state: 'awaiting_name' })
  })
})

describe('OrderService.createManualOrder', () => {
  it('prices items from the catalog by sku, inserts a pending/manual pedido, writes a created audit row', async () => {
    const insertedRow = {
      id: 'm1',
      status: 'pending',
      source: 'manual',
      total: 505,
      created_by: 'csr-1',
      items: [
        { sku: 'arroz-5lb', product: 'Arroz premium 5lb', quantity: 2, price: 220, subtotal: 440 },
        { sku: 'leche-1l', product: 'Leche entera 1L', quantity: 1, price: 65, subtotal: 65 },
      ],
    }
    const { client, auditInserts, pedidoInserts } = fakeSupabaseForManualOrder(CATALOG, {
      data: insertedRow,
      error: null,
    })
    const service = new OrderService(client)

    const result = await service.createManualOrder('csr-1', {
      customer_name: 'Test QA',
      customer_phone: '809-000-0000',
      delivery_address: 'Calle Prueba 1',
      items: [
        { sku: 'arroz-5lb', quantity: 2 },
        { sku: 'leche-1l', quantity: 1 },
      ],
    })

    expect(result).toEqual(insertedRow)
    expect(pedidoInserts).toHaveLength(1)
    expect(pedidoInserts[0]).toMatchObject({
      status: 'pending',
      source: 'manual',
      created_by: 'csr-1',
      total: 505,
      items: [
        { sku: 'arroz-5lb', product: 'Arroz premium 5lb', quantity: 2, price: 220, subtotal: 440 },
        { sku: 'leche-1l', product: 'Leche entera 1L', quantity: 1, price: 65, subtotal: 65 },
      ],
    })
    expect(auditInserts).toHaveLength(1)
    expect(auditInserts[0]).toMatchObject({ pedido_id: 'm1', actor_type: 'csr', actor_id: 'csr-1', action: 'created' })
  })

  it('throws UnknownSkuError for an unrecognized sku and inserts nothing', async () => {
    const { client, auditInserts, pedidoInserts } = fakeSupabaseForManualOrder(CATALOG, { data: null, error: null })
    const service = new OrderService(client)

    await expect(
      service.createManualOrder('csr-1', {
        customer_name: null,
        customer_phone: null,
        delivery_address: null,
        items: [{ sku: 'not-a-real-sku', quantity: 1 }],
      }),
    ).rejects.toThrow(UnknownSkuError)
    expect(pedidoInserts).toHaveLength(0)
    expect(auditInserts).toHaveLength(0)
  })
})
