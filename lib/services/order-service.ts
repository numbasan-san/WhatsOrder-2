import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { CatalogService } from '@/lib/catalog/catalog-service'
import { matchItemsToCatalog, orderTotal, buildOrderSummary } from '@/lib/orders/pricing'
import { canTransition } from '@/lib/orders/order-state'
import { GeminiAdapter } from '@/lib/adapters/gemini-adapter'
import { ERPAdapter } from '@/lib/adapters/erp-adapter'
import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'
import { getConversation, setConversation, clearConversation } from '@/lib/telegram/conversation'
import type { DeliveryStatus, OrderItem, OrderStatus, Pedido } from '@/lib/types'

export interface DraftResult {
  status: 'created' | 'need_address' | 'no_items'
  pedidoId?: string
  summary?: string
  unmatched?: string[]
}

interface OrderDraft {
  items: OrderItem[]
  unmatched: string[]
  customerName: string | null
}

type AuditActor = 'csr' | 'customer' | 'bot' | 'system'

export interface AssignDeliveryInput {
  assigned_to: string
  delivery_status: DeliveryStatus
  delivery_eta: string | null
}

export interface ManualOrderInput {
  customer_name: string | null
  customer_phone: string | null
  delivery_address: string | null
  items: { sku: string; quantity: number }[]
}

/** Thrown by createManualOrder when a requested sku isn't in the active catalog. */
export class UnknownSkuError extends Error {
  constructor(public readonly sku: string) {
    super(`Unknown sku: ${sku}`)
    this.name = 'UnknownSkuError'
  }
}

/**
 * Thrown when a conditional status-transition UPDATE matches zero rows: another
 * concurrent request already moved the pedido out of the status this call expected
 * (lost the race). Callers must treat this as a harmless no-op — no audit row, no
 * notification — rather than a real failure.
 */
export class OrderTransitionConflictError extends Error {
  constructor(
    public readonly pedidoId: string,
    public readonly fromStatus: OrderStatus,
    public readonly toStatus: OrderStatus,
  ) {
    super(`Pedido ${pedidoId} ya no está en '${fromStatus}' (se intentó pasar a '${toStatus}')`)
    this.name = 'OrderTransitionConflictError'
  }
}

export class OrderService {
  private supabase: SupabaseClient
  private catalog: CatalogService
  private gemini: GeminiAdapter
  private erp: ERPAdapter
  private telegram: TelegramAdapter

  constructor(supabase: SupabaseClient = createServiceClient()) {
    this.supabase = supabase
    this.catalog = new CatalogService(supabase)
    this.gemini = new GeminiAdapter()
    this.erp = new ERPAdapter(supabase)
    this.telegram = new TelegramAdapter()
  }

  /**
   * Parse a raw customer message into a priced draft order.
   * - No catalog matches at all -> 'no_items'.
   * - Matches but no delivery address -> conversation parked as 'awaiting_address', 'need_address'.
   * - Matches with an address -> pedido row created as 'pending_confirmation', 'created'.
   */
  async createDraftFromMessage(chatId: string, message: string): Promise<DraftResult> {
    const catalog = await this.catalog.getActive()
    const names = catalog.map((c) => c.name)
    const parsed = await this.gemini.interpret(message, names)
    const { items, unmatched } = matchItemsToCatalog(parsed.items, catalog)

    if (items.length === 0) {
      return { status: 'no_items', unmatched }
    }

    if (!parsed.deliveryAddress) {
      await setConversation(this.supabase, chatId, 'awaiting_address', {
        items,
        unmatched,
        customerName: parsed.customerName ?? null,
      } satisfies OrderDraft)
      return { status: 'need_address', unmatched }
    }

    const pedidoId = await this.insertDraft(chatId, items, parsed.customerName ?? null, parsed.deliveryAddress)
    return {
      status: 'created',
      pedidoId,
      summary: buildOrderSummary(items, orderTotal(items), parsed.deliveryAddress),
      unmatched,
    }
  }

  /** Resume a conversation parked in 'awaiting_address' once the customer replies with the address. */
  async completeDraftWithAddress(chatId: string, address: string): Promise<DraftResult> {
    const conv = await getConversation(this.supabase, chatId)
    const draft = conv?.draft as OrderDraft | undefined
    if (!conv || conv.state !== 'awaiting_address' || !draft?.items?.length) {
      return { status: 'no_items' }
    }

    const pedidoId = await this.insertDraft(chatId, draft.items, draft.customerName ?? null, address)
    await clearConversation(this.supabase, chatId)
    return {
      status: 'created',
      pedidoId,
      summary: buildOrderSummary(draft.items, orderTotal(draft.items), address),
      unmatched: draft.unmatched ?? [],
    }
  }

  private async insertDraft(
    chatId: string,
    items: OrderItem[],
    customerName: string | null,
    address: string,
  ): Promise<string> {
    const total = orderTotal(items)
    const { data, error } = await this.supabase
      .from('pedidos')
      .insert({
        telegram_chat_id: chatId,
        customer_name: customerName,
        items,
        total,
        status: 'pending_confirmation',
        source: 'telegram',
        delivery_address: address,
      })
      .select()
      .single()
    if (error) throw error

    await this.audit(data.id, 'bot', null, 'created', { total, itemCount: items.length })
    return data.id as string
  }

  private async loadOrder(pedidoId: string): Promise<Pedido> {
    const { data, error } = await this.supabase.from('pedidos').select('*').eq('id', pedidoId).single()
    if (error) throw error
    return data as Pedido
  }

  private async transition(pedidoId: string, to: OrderStatus, patch: Record<string, unknown>): Promise<Pedido> {
    const order = await this.loadOrder(pedidoId)
    if (!canTransition(order.status, to)) {
      // Disallowed transition -- most commonly a customer/CSR double-tap where the pedido
      // is already past (or never was in) the expected status. Same conflict type as the
      // lost-race path below so callers (webhook, routes) treat both as a benign no-op
      // ("Ya procesado" / 409) instead of surfacing a scary generic error.
      throw new OrderTransitionConflictError(pedidoId, order.status, to)
    }
    // The UPDATE is conditioned on the status we just read (optimistic concurrency):
    // if another request already transitioned this pedido, this matches zero rows and
    // .single() reports PGRST116 ("no rows") instead of us silently double-applying it.
    const { data, error } = await this.supabase
      .from('pedidos')
      .update({ status: to, ...patch })
      .eq('id', pedidoId)
      .eq('status', order.status)
      .select()
      .single()

    const lostRace = error ? error.code === 'PGRST116' : !data
    if (lostRace) {
      throw new OrderTransitionConflictError(pedidoId, order.status, to)
    }
    if (error) {
      // A real failure (connection drop, permissions, an unrelated constraint, ...) --
      // not a lost race. Rethrow as-is so callers don't mistake it for a benign no-op.
      throw error
    }
    return data as Pedido
  }

  async confirmOrder(pedidoId: string): Promise<Pedido> {
    const updated = await this.transition(pedidoId, 'pending', { confirmed_at: new Date().toISOString() })
    await this.audit(pedidoId, 'customer', null, 'confirmed')
    return updated
  }

  async cancelOrder(pedidoId: string): Promise<Pedido> {
    const updated = await this.transition(pedidoId, 'cancelled', {})
    await this.audit(pedidoId, 'customer', null, 'cancelled')
    return updated
  }

  async approveOrder(pedidoId: string, csrUserId: string): Promise<Pedido> {
    const updated = await this.transition(pedidoId, 'approved', {
      approved_by: csrUserId,
      approved_at: new Date().toISOString(),
    })
    if (updated.telegram_chat_id) {
      await this.telegram.sendSimpleMessage(
        updated.telegram_chat_id,
        `✅ Pedido #${updated.id.slice(0, 8)} aprobado. Estará en camino pronto. Gracias por tu compra.`,
      )
    }
    await this.audit(pedidoId, 'csr', csrUserId, 'approved')
    return updated
  }

  async rejectOrder(pedidoId: string, csrUserId: string, reason: string): Promise<Pedido> {
    const updated = await this.transition(pedidoId, 'rejected', {
      rejected_by: csrUserId,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    if (updated.telegram_chat_id) {
      await this.telegram.sendSimpleMessage(
        updated.telegram_chat_id,
        `❌ Pedido #${updated.id.slice(0, 8)} rechazado. Motivo: ${reason}`,
      )
    }
    await this.audit(pedidoId, 'csr', csrUserId, 'rejected', { reason })
    return updated
  }

  /**
   * Attach/refresh delivery metadata on an already-approved pedido. Not part of the
   * status state machine (delivery_status is a free-form logistics field, not `status`),
   * so this is a plain conditional patch, not a `transition()` call -- but we still guard
   * that the order is 'approved' since assigning delivery on a pending/rejected order
   * makes no sense.
   */
  async assignDelivery(pedidoId: string, csrUserId: string, input: AssignDeliveryInput): Promise<Pedido> {
    const order = await this.loadOrder(pedidoId)
    if (order.status !== 'approved') {
      throw new Error(`No se puede asignar entrega: el pedido ${pedidoId} está en '${order.status}', no 'approved'`)
    }

    const { data, error } = await this.supabase
      .from('pedidos')
      .update({
        delivery_assigned_to: input.assigned_to,
        delivery_status: input.delivery_status,
        delivery_eta: input.delivery_eta,
      })
      .eq('id', pedidoId)
      .select()
      .single()
    if (error) throw error

    await this.audit(pedidoId, 'csr', csrUserId, 'assigned_delivery', { ...input })
    return data as Pedido
  }

  /**
   * CSR-authored order (phone/in-person orders keyed into the dashboard, not the Telegram
   * bot). Items are priced from the live catalog by sku -- never trust a client-supplied
   * price/subtotal -- and an unknown sku fails the whole order rather than silently
   * dropping or mispricing an item.
   */
  async createManualOrder(csrUserId: string, input: ManualOrderInput): Promise<Pedido> {
    const catalog = await this.catalog.getActive()
    const bySku = new Map(catalog.map((p) => [p.sku, p]))

    const items: OrderItem[] = input.items.map(({ sku, quantity }) => {
      const product = bySku.get(sku)
      if (!product) throw new UnknownSkuError(sku)
      const qty = Math.max(1, Math.floor(quantity || 1))
      return {
        sku: product.sku,
        product: product.name,
        quantity: qty,
        price: product.price,
        subtotal: Math.round(product.price * qty * 100) / 100,
      }
    })
    const total = orderTotal(items)

    const { data, error } = await this.supabase
      .from('pedidos')
      .insert({
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        delivery_address: input.delivery_address,
        items,
        total,
        status: 'pending',
        source: 'manual',
        created_by: csrUserId,
      })
      .select()
      .single()
    if (error) throw error

    await this.audit(data.id, 'csr', csrUserId, 'created', { total, itemCount: items.length, source: 'manual' })
    return data as Pedido
  }

  async getPendingOrders(): Promise<Pedido[]> {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data ?? []) as Pedido[]
  }

  async getOrderById(orderId: string): Promise<Pedido> {
    return this.loadOrder(orderId)
  }

  async getOrderStats() {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select('status, total, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    return {
      total: data.length,
      pending: data.filter((o) => o.status === 'pending').length,
      approved: data.filter((o) => o.status === 'approved').length,
      rejected: data.filter((o) => o.status === 'rejected').length,
      totalRevenue: data.reduce((sum, o) => sum + (o.total || 0), 0),
    }
  }

  private async audit(
    pedidoId: string | null,
    actorType: AuditActor,
    actorId: string | null,
    action: string,
    detail?: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabase.from('audit_log').insert({
      pedido_id: pedidoId,
      actor_type: actorType,
      actor_id: actorId,
      action,
      detail: detail ?? null,
    })
    if (error) console.error('audit_log insert error:', error)
  }
}

// Lazy singleton: the real construction (which calls createServiceClient() and
// therefore requires the server env vars) only happens on first property access,
// not at module-import time. That keeps importing this module safe for tests and
// any other context where the Supabase env vars aren't configured yet.
let lazyOrderServiceSingleton: OrderService | undefined
export const orderService: OrderService = new Proxy({} as OrderService, {
  get(_target, prop, _receiver) {
    if (!lazyOrderServiceSingleton) lazyOrderServiceSingleton = new OrderService()
    const value = Reflect.get(lazyOrderServiceSingleton as object, prop, lazyOrderServiceSingleton)
    return typeof value === 'function' ? value.bind(lazyOrderServiceSingleton) : value
  },
})
