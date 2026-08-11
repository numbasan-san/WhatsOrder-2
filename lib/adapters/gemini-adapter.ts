import { ExternalServiceAdapter, InterpretedOrder, ProductItem } from './interfaces'

export class GeminiAdapter implements ExternalServiceAdapter {
  private apiKey: string
  private model: string

  constructor() {
    this.apiKey = process.env.GEMINI_API_TOKEN || ''
    this.model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    
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
      const fallbackResult = this.tryFallbackParsing(message)
      if (fallbackResult && fallbackResult.products.length > 0) {
        console.log('✅ Usando fallback (extracción local):', fallbackResult.products)
        return fallbackResult
      }

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
            temperature: 0.0,
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
        const retryFallback = this.tryFallbackParsing(message)
        if (retryFallback) return retryFallback
        return { products: [] }
      }

      const data = await response.json()
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      
      console.log('Raw Gemini response:', textResponse)
      
      const cleanedText = this.cleanJsonResponse(textResponse)
      console.log('Cleaned JSON:', cleanedText)
      
      try {
        const parsed = JSON.parse(cleanedText)
        const result = this.mapGeminiResponseToOrder(parsed, message)
        console.log('📦 Productos extraídos por Gemini:', result.products)
        return result
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError)
        const retryFallback = this.tryFallbackParsing(message)
        if (retryFallback) return retryFallback
        return { products: [] }
      }
    } catch (error) {
      console.error('Gemini error:', error)
      const fallbackResult = this.tryFallbackParsing(message)
      if (fallbackResult) return fallbackResult
      return { products: [] }
    }
  }

  private buildPrompt(message: string): string {
    return `
Extrae los productos y cantidades del siguiente mensaje:

"${message}"

REGLAS ESTRICTAS:
1. Cada producto DEBE tener su cantidad exacta del mensaje.
2. Si dice "2 huevos" → {"id":"huevos","quantity":2}
3. Si dice "3 agua" → {"id":"agua","quantity":3}
4. Si dice "4 azúcar" → {"id":"azúcar","quantity":4}
5. NO uses 1 por defecto. Usa el número que el usuario escribió.

RESPONDE SOLO CON JSON:
{"products":[{"id":"producto","quantity":numero}]}

EJEMPLO:
Entrada: "Quiero 2 huevos, 3 agua y 4 azúcar"
Salida: {"products":[{"id":"huevos","quantity":2},{"id":"agua","quantity":3},{"id":"azúcar","quantity":4}]}
`.trim()
  }

  private cleanJsonResponse(text: string): string {
    let cleaned = text.trim()
    cleaned = cleaned.replace(/```json\s*/g, '')
    cleaned = cleaned.replace(/```\s*/g, '')
    
    const firstBracket = cleaned.indexOf('{')
    if (firstBracket > 0) cleaned = cleaned.substring(firstBracket)
    
    const lastBracket = cleaned.lastIndexOf('}')
    if (lastBracket > 0) cleaned = cleaned.substring(0, lastBracket + 1)
    
    cleaned = cleaned.replace(/,\s*}/g, '}')
    cleaned = cleaned.replace(/,\s*\]/g, ']')
    
    let openBraces = (cleaned.match(/\{/g) || []).length
    let closeBraces = (cleaned.match(/\}/g) || []).length
    while (closeBraces < openBraces) {
      cleaned += '}'
      closeBraces++
    }
    
    return cleaned
  }

  private tryFallbackParsing(rawText: string): InterpretedOrder | null {
    try {
      console.log('🔧 Ejecutando fallback parsing...')
      const products: ProductItem[] = []
      
      const numMap: Record<string, number> = {
        'uno': 1, 'una': 1, 'un': 1,
        'dos': 2, 'tres': 3, 'cuatro': 4,
        'cinco': 5, 'seis': 6, 'siete': 7,
        'ocho': 8, 'nueve': 9, 'diez': 10,
        'once': 11, 'doce': 12, 'trece': 13,
        'catorce': 14, 'quince': 15, 'veinte': 20
      }

      const numberPattern = /(\d+)\s*([a-záéíóúñ\s]+?)(?=,|\.|;|$|y|,| y)/gi
      let match
      while ((match = numberPattern.exec(rawText)) !== null) {
        const quantity = parseInt(match[1])
        let product = match[2].trim().toLowerCase()
        product = product.replace(/\s*(por favor|gracias|buenas|hola|quiero|deseo|necesito|comprar|llevar|pedir|y)$/i, '').trim()
        if (product && product.length > 1 && !this.isStopWord(product)) {
          products.push({
            id: this.normalizeProductName(product),
            quantity: Math.max(1, quantity),
            price: 0
          })
        }
      }

      if (products.length === 0) {
        const wordPattern = /(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)\s*([a-záéíóúñ\s]+?)(?=,|\.|;|$|y|,| y)/gi
        while ((match = wordPattern.exec(rawText)) !== null) {
          const quantity = numMap[match[1].toLowerCase()] || 1
          let product = match[2].trim().toLowerCase()
          product = product.replace(/\s*(por favor|gracias|buenas|hola|quiero|deseo|necesito|comprar|llevar|pedir|y)$/i, '').trim()
          if (product && product.length > 1 && !this.isStopWord(product)) {
            products.push({
              id: this.normalizeProductName(product),
              quantity: Math.max(1, quantity),
              price: 0
            })
          }
        }
      }

      if (products.length === 0) {
        const singlePattern = /(?:un|una)\s*([a-záéíóúñ\s]+?)(?=,|\.|;|$|y|,| y)/gi
        while ((match = singlePattern.exec(rawText)) !== null) {
          let product = match[1].trim().toLowerCase()
          product = product.replace(/\s*(por favor|gracias|buenas|hola|quiero|deseo|necesito|comprar|llevar|pedir|y)$/i, '').trim()
          if (product && product.length > 1 && !this.isStopWord(product)) {
            products.push({
              id: this.normalizeProductName(product),
              quantity: 1,
              price: 0
            })
          }
        }
      }

      if (products.length === 0) {
        const genericPattern = /(?:quiero|deseo|necesito|comprar|llevar|pedir)\s+([a-záéíóúñ\s]+?)(?=,|\.|;|$|y|,| y)/gi
        while ((match = genericPattern.exec(rawText)) !== null) {
          let product = match[1].trim().toLowerCase()
          product = product.replace(/\s*(por favor|gracias|buenas|hola|quiero|deseo|necesito|comprar|llevar|pedir|y)$/i, '').trim()
          if (product && product.length > 2 && !this.isStopWord(product)) {
            products.push({
              id: this.normalizeProductName(product),
              quantity: 1,
              price: 0
            })
          }
        }
      }

      if (products.length > 0) {
        const cleanProducts: Record<string, ProductItem> = {}
        for (const p of products) {
          const key = p.id
          if (cleanProducts[key]) {
            cleanProducts[key].quantity += p.quantity
          } else {
            cleanProducts[key] = { ...p }
          }
        }
        const result = { products: Object.values(cleanProducts) }
        console.log('🔧 Fallback result:', JSON.stringify(result))
        return result
      }

      return null
    } catch (e) {
      console.error('Fallback parsing error:', e)
      return null
    }
  }

  private isStopWord(word: string): boolean {
    const stopWords = [
      'quiero', 'deseo', 'necesito', 'por favor', 'favor', 'gracias', 
      'buenas', 'hola', 'comprar', 'llevar', 'pedir', 'quisiera',
      'me gustaría', 'me podrías', 'me puedes', 'puedes', 'podrías',
      'regalar', 'dar', 'traer', 'mandar', 'enviar'
    ]
    return stopWords.some(sw => word.includes(sw))
  }

  private mapGeminiResponseToOrder(geminiResponse: any, originalMessage?: string): InterpretedOrder {
    const products: ProductItem[] = []
    
    if (Array.isArray(geminiResponse.products)) {
      geminiResponse.products.forEach((p: any) => {
        const id = p.id || p.name || p.product || p.producto || p.nombre
        let quantity = parseInt(p.quantity || p.cantidad || 0)
        
        if (quantity === 0 && originalMessage) {
          const regex = new RegExp(`(\\d+)\\s*${this.normalizeProductName(id)}`, 'i')
          const match = originalMessage.match(regex)
          if (match) {
            quantity = parseInt(match[1])
          }
        }
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