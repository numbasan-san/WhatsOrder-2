import { ExternalServiceAdapter, InterpretedOrder, ProductItem } from './interfaces'

export class GeminiAdapter implements ExternalServiceAdapter {
  private apiKey: string
  private model: string

  constructor() {
    this.apiKey = process.env.GEMINI_API_TOKEN || ''
    this.model = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
    
    if (!this.apiKey) {
      console.error('GEMINI_API_TOKEN is not configured')
    }
  }

  async interpretMessage(message: string): Promise<InterpretedOrder> {
    if (!this.apiKey) {
      console.error('API Key is missing')
      return { products: [] }
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`
      
      console.log(`Using model: ${this.model}`)
      
      const prompt = this.buildPrompt(message)
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.1, // Reducir temperatura para respuestas más consistentes
            topK: 32,
            topP: 0.95,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          }
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Gemini API Error ${response.status}:`, errorText)
        throw new Error(`Gemini API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      
      console.log('Raw response:', textResponse)
      
      const cleanedText = this.cleanJsonResponse(textResponse)
      console.log('Cleaned JSON:', cleanedText)
      
      try {
        const parsed = JSON.parse(cleanedText)
        return this.mapGeminiResponseToOrder(parsed, message)
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError)
        const fallbackResult = this.tryFallbackParsing(message)
        if (fallbackResult) {
          return fallbackResult
        }
        return { products: [] }
      }
    } catch (error) {
      console.error('Gemini error:', error)
      return { products: [] }
    }
  }

  private buildPrompt(message: string): string {
    return `
Extrae los productos y cantidades del siguiente mensaje:

"${message}"

Reglas:
1. Cada producto debe tener un ID (nombre del producto) y una cantidad.
2. Si el usuario dice "2 habichuelas", la cantidad es 2.
3. Si el usuario dice "un plátano" o "1 plátano", la cantidad es 1.
4. Si no se especifica cantidad, asume 1.
5. Los números pueden estar en palabras (uno, dos, tres) o en dígitos (1, 2, 3).

Devuelve SOLO JSON con este formato:
{"products":[{"id":"nombre_del_producto","quantity":numero}]}

Ejemplo de entrada: "Quiero 2 habichuelas, 3 plátanos y 1 leche"
Ejemplo de salida: {"products":[{"id":"habichuelas","quantity":2},{"id":"plátanos","quantity":3},{"id":"leche","quantity":1}]}

Importante: Cada producto debe tener su cantidad correcta. No uses 1 por defecto si el usuario especificó otra cantidad.
`.trim()
  }

  private cleanJsonResponse(text: string): string {
    let cleaned = text.trim()
    
    // Remove markdown code blocks
    cleaned = cleaned.replace(/```json\s*/g, '')
    cleaned = cleaned.replace(/```\s*/g, '')
    
    // Remove text before the first {
    const firstBracket = cleaned.indexOf('{')
    if (firstBracket > 0) {
      cleaned = cleaned.substring(firstBracket)
    }
    
    // Remove text after the last }
    const lastBracket = cleaned.lastIndexOf('}')
    if (lastBracket > 0 && lastBracket < cleaned.length - 1) {
      cleaned = cleaned.substring(0, lastBracket + 1)
    }
    
    // Fix common JSON issues:
    cleaned = cleaned.replace(/,\s*}/g, '}')
    cleaned = cleaned.replace(/,\s*\]/g, ']')
    cleaned = cleaned.replace(/"\s*}$/g, '}')
    cleaned = cleaned.replace(/"\s*\]\s*}$/g, ']}')
    cleaned = cleaned.replace(/"+/g, '"')
    cleaned = cleaned.replace(/"null"/g, 'null')
    cleaned = cleaned.replace(/"undefined"/g, 'null')
    
    // Ensure proper closing
    let openBraces = (cleaned.match(/\{/g) || []).length
    let closeBraces = (cleaned.match(/\}/g) || []).length
    
    while (closeBraces > openBraces) {
      const lastBraceIndex = cleaned.lastIndexOf('}')
      if (lastBraceIndex > 0) {
        cleaned = cleaned.substring(0, lastBraceIndex) + cleaned.substring(lastBraceIndex + 1)
        closeBraces--
      } else {
        break
      }
    }
    
    while (closeBraces < openBraces) {
      cleaned += '}'
      closeBraces++
    }
    
    if (!cleaned.startsWith('{')) {
      const firstBrace = cleaned.indexOf('{')
      if (firstBrace > 0) {
        cleaned = cleaned.substring(firstBrace)
      }
    }
    if (!cleaned.endsWith('}')) {
      const lastBrace = cleaned.lastIndexOf('}')
      if (lastBrace > 0) {
        cleaned = cleaned.substring(0, lastBrace + 1)
      } else {
        cleaned += '}'
      }
    }
    
    return cleaned
  }

  private tryFallbackParsing(rawText: string): InterpretedOrder | null {
    try {
      const products: ProductItem[] = []
      
      // Patrón para capturar "cantidad + producto"
      // Ejemplos: "2 habichuelas", "3 plátanos", "un pan", "1 leche"
      const patterns = [
        // Número + producto: "2 habichuelas", "3 plátanos"
        /(\d+)\s*([a-záéíóúñ\s]+)/gi,
        // Palabra numérica + producto: "dos habichuelas", "tres plátanos"
        /(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*([a-záéíóúñ\s]+)/gi,
        // "un/una" + producto: "un pan", "una leche"
        /un\s*([a-záéíóúñ\s]+)/gi,
        /una\s*([a-záéíóúñ\s]+)/gi
      ]

      // Mapeo de palabras numéricas a números
      const numMap: Record<string, number> = {
        'uno': 1, 'una': 1, 'un': 1,
        'dos': 2, 'tres': 3, 'cuatro': 4,
        'cinco': 5, 'seis': 6, 'siete': 7,
        'ocho': 8, 'nueve': 9, 'diez': 10
      }

      // Primero intentar con el patrón de número + producto
      const matches = rawText.matchAll(/(\d+)\s*([a-záéíóúñ\s]+?)(?:,|\.|;|$|y)/gi)
      for (const match of matches) {
        const quantity = parseInt(match[1])
        const product = match[2].trim().toLowerCase()
        if (product && product.length > 1 && !this.isStopWord(product)) {
          products.push({
            id: this.normalizeProductName(product),
            quantity: Math.max(1, quantity),
            price: 0
          })
        }
      }

      // Si no encontramos nada con números, buscar con palabras
      if (products.length === 0) {
        const wordMatches = rawText.matchAll(/(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*([a-záéíóúñ\s]+?)(?:,|\.|;|$|y)/gi)
        for (const match of wordMatches) {
          const quantity = numMap[match[1].toLowerCase()] || 1
          const product = match[2].trim().toLowerCase()
          if (product && product.length > 1 && !this.isStopWord(product)) {
            products.push({
              id: this.normalizeProductName(product),
              quantity: Math.max(1, quantity),
              price: 0
            })
          }
        }
      }

      // Si aún no hay productos, buscar "un/una" + producto
      if (products.length === 0) {
        const singleMatches = rawText.matchAll(/(?:un|una)\s*([a-záéíóúñ\s]+?)(?:,|\.|;|$|y)/gi)
        for (const match of singleMatches) {
          const product = match[1].trim().toLowerCase()
          if (product && product.length > 1 && !this.isStopWord(product)) {
            products.push({
              id: this.normalizeProductName(product),
              quantity: 1,
              price: 0
            })
          }
        }
      }

      if (products.length > 0) {
        // Limpiar productos duplicados (sumar cantidades)
        const cleanProducts: Record<string, ProductItem> = {}
        for (const p of products) {
          if (cleanProducts[p.id]) {
            cleanProducts[p.id].quantity += p.quantity
          } else {
            cleanProducts[p.id] = p
          }
        }
        return { products: Object.values(cleanProducts) }
      }

      return null
    } catch (e) {
      console.error('Fallback parsing error:', e)
      return null
    }
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['quiero', 'deseo', 'necesito', 'por favor', 'favor', 'gracias', 'buenas', 'hola', 'comprar', 'llevar', 'pedir']
    return stopWords.some(sw => word.includes(sw))
  }

  private mapGeminiResponseToOrder(geminiResponse: any, originalMessage?: string): InterpretedOrder {
    const products: ProductItem[] = []
    
    if (Array.isArray(geminiResponse.products)) {
      geminiResponse.products.forEach((p: any) => {
        const id = p.id || p.name || p.product || p.producto || p.nombre
        // Si la cantidad es undefined o null, intentar extraer del mensaje original
        let quantity = parseInt(p.quantity || p.cantidad || 1)
        if (isNaN(quantity) || quantity < 1) quantity = 1
        
        if (id) {
          products.push({
            id: this.normalizeProductName(id),
            quantity: Math.max(1, quantity),
            price: 0
          })
        }
      })
    }
    
    // Si no se encontraron productos, intentar con fallback
    if (products.length === 0 && originalMessage) {
      const fallback = this.tryFallbackParsing(originalMessage)
      if (fallback) return fallback
    }

    return {
      products,
      customerName: geminiResponse.customerName || geminiResponse.cliente || undefined,
      deliveryAddress: geminiResponse.deliveryAddress || geminiResponse.direccion || undefined,
    }
  }

  private normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, '_')
  }

  async send(): Promise<any> {
    throw new Error('Gemini adapter does not implement send method')
  }

  async queryStock(): Promise<any> {
    throw new Error('Gemini adapter does not implement stock queries')
  }

  async getPrice(): Promise<number> {
    throw new Error('Gemini adapter does not implement price queries')
  }
}