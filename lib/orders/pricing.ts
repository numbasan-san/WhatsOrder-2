import type { OrderItem, Producto } from '@/lib/types'

export function normalizeName(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

function tokenize(s: string): string[] {
  return normalizeName(s).split(' ').filter((w) => w.length > 1)
}

/** Token-overlap similarity between a query and a target name. Higher = closer. */
export function matchScore(query: string, target: string): number {
  const q = tokenize(query)
  const t = tokenize(target)
  let score = 0
  for (const a of q) for (const b of t) {
    if (a === b) score += 3
    else if (b.includes(a) || a.includes(b)) score += 2
    else if (b.startsWith(a) || a.startsWith(b)) score += 1
  }
  return score
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
    let partial = exact
    if (!partial) {
      const scored = catalog
        .map((c) => ({ c, score: matchScore(req.name, c.name) }))
        .filter((s) => s.score >= 2)
        .sort((a, b) => b.score - a.score)
      partial = scored[0]?.c
    }
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
