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

export function parseGeminiOrder(raw: string): ParsedOrder {
  const empty: ParsedOrder = { items: [], deliveryAddress: null, customerName: null }
  let obj: any
  try { obj = JSON.parse(cleanJsonResponse(raw)) } catch { return empty }
  const arr = Array.isArray(obj.items) ? obj.items : Array.isArray(obj.products) ? obj.products : []
  const items = arr
    .map((p: any) => ({
      name: String(p.name ?? p.id ?? p.product ?? p.producto ?? p.nombre ?? '').trim(),
      quantity: Math.max(1, parseInt(p.quantity ?? p.cantidad ?? 1) || 1),
    }))
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
