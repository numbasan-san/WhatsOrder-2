import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { CatalogService } from '@/lib/catalog/catalog-service'
import { matchItemsToCatalog, orderTotal, buildOrderSummary } from '@/lib/orders/pricing'
import { canTransition } from '@/lib/orders/order-state'
import { GeminiAdapter } from '@/lib/adapters/gemini-adapter'
import { ERPAdapter } from '@/lib/adapters/erp-adapter'
import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'
import { getConversation, setConversation, clearConversation } from '@/lib/telegram/conversation'
import type { OrderItem, OrderStatus, Pedido } from '@/lib/types'

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
      throw new Error(`No se puede pasar el pedido ${pedidoId} de '${order.status}' a '${to}'`)
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
