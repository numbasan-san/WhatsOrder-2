import type { OrderItem, Producto } from '@/lib/types'

export function normalizeName(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

export function matchItemsToCatalog(
  requested: { name: string; quantity: number }[],
  catalog: Producto[],
): { items: OrderItem[]; unmatched: string[] } {
  const items: OrderItem[] = []
  const unmatched: string[] = []
  for (const req of requested) {
    const n = normalizeName(req.name)
    const exact = catalog.find((c) => normalizeName(c.name) === n)
    const partial = exact ?? catalog.find((c) => {
      const cn = normalizeName(c.name)
      return cn.includes(n) || n.includes(cn.split(' ')[0])
    })
    if (!partial) { unmatched.push(req.name); continue }
    const quantity = Math.max(1, Math.floor(req.quantity || 1))
    items.push({
      sku: partial.sku, product: partial.name, quantity,
      price: partial.price, subtotal: Math.round(partial.price * quantity * 100) / 100,
    })
  }
  return { items, unmatched }
}

export function orderTotal(items: OrderItem[]): number {
  return Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100
}

const fmt = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })

export function buildOrderSummary(items: OrderItem[], total: number, address: string | null): string {
  const lines = items.map((i, n) => `${n + 1}. <b>${i.product}</b> — ${i.quantity} x ${fmt.format(i.price)} = ${fmt.format(i.subtotal)}`).join('\n')
  return [
    '🛒 <b>Resumen de tu pedido</b>', '', lines, '',
    `💰 <b>Total:</b> ${fmt.format(total)}`, '',
    `📍 <b>Dirección:</b> ${address ?? 'Por confirmar'}`, '',
    '¿Confirmamos tu pedido?',
  ].join('\n')
}
