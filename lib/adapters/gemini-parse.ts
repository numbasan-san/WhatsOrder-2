export function cleanJsonResponse(text: string): string {
  let c = text.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '')
  const first = c.indexOf('{'); if (first > 0) c = c.slice(first)
  const last = c.lastIndexOf('}'); if (last >= 0) c = c.slice(0, last + 1)
  c = c.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']')
  return c.trim()
}

export interface ParsedOrder {
  items: { name: string; quantity: number }[]
  deliveryAddress: string | null
  customerName: string | null
}

const NUM_WORDS: Record<string, number> = {
  uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, veinte: 20,
}

/** Map a spanish number word (uno..veinte) to its integer, or null if not a number word. */
export function wordToNumber(word: string): number | null {
  const n = NUM_WORDS[word.trim().toLowerCase()]
  return n ?? null
}

/**
 * Recover a quantity for `name` from the raw customer `message` when the model
 * omitted it: a digit or spanish number-word appearing just before the product word.
 */
export function quantityFromMessage(name: string, message: string): number | null {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase()
  if (!first) return null
  const msg = message.toLowerCase()
  const digit = msg.match(new RegExp(`(\\d+)\\s+[^,.;]*${first}`))
  if (digit) return Math.max(1, parseInt(digit[1], 10))
  const numWords = Object.keys(NUM_WORDS).join('|')
  const word = msg.match(new RegExp(`(${numWords})\\s+[^,.;]*${first}`))
  if (word) { const n = wordToNumber(word[1]); if (n) return n }
  return null
}

export function parseGeminiOrder(raw: string, sourceMessage = ''): ParsedOrder {
  const empty: ParsedOrder = { items: [], deliveryAddress: null, customerName: null }
  let obj: any
  try { obj = JSON.parse(cleanJsonResponse(raw)) } catch { return empty }
  const arr = Array.isArray(obj.items) ? obj.items : Array.isArray(obj.products) ? obj.products : []
  const items = arr
    .map((p: any) => {
      const name = String(p.name ?? p.id ?? p.product ?? p.producto ?? p.nombre ?? '').trim()
      const rawQty = parseInt(p.quantity ?? p.cantidad ?? '')
      const quantity = Number.isFinite(rawQty) && rawQty > 0
        ? rawQty
        : (sourceMessage ? quantityFromMessage(name, sourceMessage) ?? 1 : 1)
      return { name, quantity: Math.max(1, quantity) }
    })
    .filter((p: any) => p.name.length > 0)
  return {
    items,
    deliveryAddress: obj.deliveryAddress ?? obj.direccion ?? null,
    customerName: obj.customerName ?? obj.cliente ?? obj.nombre ?? null,
  }
}

export function buildCatalogPrompt(message: string, catalogNames: string[]): string {
  return [
    'Eres un asistente que extrae pedidos de comestibles de un mensaje en español.',
    'Catálogo disponible (usa el nombre EXACTO del catálogo cuando coincida):',
    catalogNames.map((n) => `- ${n}`).join('\n'),
    `Mensaje del cliente: "${message}"`,
    'Devuelve SOLO JSON con esta forma:',
    '{"items":[{"name":"<nombre del catálogo o del mensaje>","quantity":<entero>}],"direccion":<string o null>,"customerName":<string o null>}',
    'No incluyas texto fuera del JSON.',
  ].join('\n')
}
