// lib/adapters/gemini-adapter.ts

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
      
      // 🔥 PROMPT MEJORADO
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
            temperature: 0.0, // 🔥 Cambiado a 0.0 para respuestas más determinísticas
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
        const result = this.mapGeminiResponseToOrder(parsed, message)
        console.log('📦 Productos extraídos:', result.products)
        return result
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError)
        const fallbackResult = this.tryFallbackParsing(message)
        if (fallbackResult) {
          console.log('📦 Fallback productos:', fallbackResult.products)
          return fallbackResult
        }
        return { products: [] }
      }
    } catch (error) {
      console.error('Gemini error:', error)
      return { products: [] }
    }
  }

  // 🔥 PROMPT MEJORADO
  private buildPrompt(message: string): string {
    return `
Eres un asistente que extrae productos y cantidades de mensajes de compras.

Mensaje del usuario: "${message}"

INSTRUCCIONES IMPORTANTES:
1. Extrae CADA producto y su CANTIDAD específica.
2. Si el usuario dice "2 huevos", la cantidad es 2.
3. Si el usuario dice "3 agua", la cantidad es 3.
4. Si el usuario dice "4 azúcar", la cantidad es 4.
5. Si el usuario dice "un pan", la cantidad es 1.
6. Si el usuario dice "1 leche", la cantidad es 1.
7. SIEMPRE usa el número que el usuario especificó. NO asumas 1 por defecto.
8. Los números pueden estar en palabras (uno, dos, tres) o en dígitos (1, 2, 3).

RESPONDE SOLO CON JSON en este formato EXACTO:
{"products":[{"id":"nombre_del_producto","quantity":numero}]}

EJEMPLOS:
- Entrada: "Quiero 2 huevos, 3 agua y 4 azúcar"
- Salida: {"products":[{"id":"huevos","quantity":2},{"id":"agua","quantity":3},{"id":"azúcar","quantity":4}]}

- Entrada: "Necesito 5 leches y 2 panes"
- Salida: {"products":[{"id":"leches","quantity":5},{"id":"panes","quantity":2}]}

- Entrada: "un café y dos galletas"
- Salida: {"products":[{"id":"café","quantity":1},{"id":"galletas","quantity":2}]}

RESPONDE SOLO CON JSON. NO agregues texto adicional.
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

  // 🔥 FALLBACK MEJORADO - Ahora extrae correctamente las cantidades
  private tryFallbackParsing(rawText: string): InterpretedOrder | null {
    try {
      const products: ProductItem[] = []
      
      // 🔥 Patrón mejorado para capturar "número + producto" o "palabra_numérica + producto"
      // Ejemplos: "2 huevos", "3 agua", "4 azúcar", "dos huevos", "tres agua"
      
      // Mapeo de palabras numéricas a números (expandido)
      const numMap: Record<string, number> = {
        'uno': 1, 'una': 1, 'un': 1,
        'dos': 2,
        'tres': 3,
        'cuatro': 4,
        'cinco': 5,
        'seis': 6,
        'siete': 7,
        'ocho': 8,
        'nueve': 9,
        'diez': 10,
        'once': 11,
        'doce': 12,
        'trece': 13,
        'catorce': 14,
        'quince': 15,
        'veinte': 20,
        'treinta': 30,
        'cuarenta': 40,
        'cincuenta': 50,
        'sesenta': 60,
        'setenta': 70,
        'ochenta': 80,
        'noventa': 90,
        'cien': 100,
      }

      // 🔥 Patrón: número + producto (prioridad alta)
      // Ejemplo: "2 huevos", "3 agua", "4 azúcar"
      const numberPattern = /(\d+)\s*([a-záéíóúñ\s]+?)(?:,|\.|;|$|y|,| y)/gi
      let match
      while ((match = numberPattern.exec(rawText)) !== null) {
        const quantity = parseInt(match[1])
        let product = match[2].trim().toLowerCase()
        // Limpiar producto (eliminar palabras comunes al final)
        product = product.replace(/\s*(por favor|gracias|buenas|hola|quiero|deseo|necesito|comprar|llevar|pedir)$/i, '').trim()
        if (product && product.length > 1 && !this.isStopWord(product)) {
          products.push({
            id: this.normalizeProductName(product),
            quantity: Math.max(1, quantity),
            price: 0
          })
        }
      }

      // 🔥 Si no encontramos con números, buscar con palabras numéricas
      if (products.length === 0) {
        const wordPattern = /(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien)\s*([a-záéíóúñ\s]+?)(?:,|\.|;|$|y|,| y)/gi
        while ((match = wordPattern.exec(rawText)) !== null) {
          const quantity = numMap[match[1].toLowerCase()] || 1
          let product = match[2].trim().toLowerCase()
          product = product.replace(/\s*(por favor|gracias|buenas|hola|quiero|deseo|necesito|comprar|llevar|pedir)$/i, '').trim()
          if (product && product.length > 1 && !this.isStopWord(product)) {
            products.push({
              id: this.normalizeProductName(product),
              quantity: Math.max(1, quantity),
              price: 0
            })
          }
        }
      }

      // 🔥 Si aún no hay productos, buscar "un/una" + producto
      if (products.length === 0) {
        const singlePattern = /(?:un|una)\s*([a-záéíóúñ\s]+?)(?:,|\.|;|$|y|,| y)/gi
        while ((match = singlePattern.exec(rawText)) !== null) {
          let product = match[1].trim().toLowerCase()
          product = product.replace(/\s*(por favor|gracias|buenas|hola|quiero|deseo|necesito|comprar|llevar|pedir)$/i, '').trim()
          if (product && product.length > 1 && !this.isStopWord(product)) {
            products.push({
              id: this.normalizeProductName(product),
              quantity: 1,
              price: 0
            })
          }
        }
      }

      // 🔥 Si aún no hay productos, buscar cualquier palabra que parezca un producto
      if (products.length === 0) {
        // Buscar patrones como "quiero X" o "necesito X"
        const genericPattern = /(?:quiero|deseo|necesito|comprar|llevar|pedir)\s+([a-záéíóúñ\s]+?)(?:,|\.|;|$|y|,| y)/gi
        while ((match = genericPattern.exec(rawText)) !== null) {
          let product = match[1].trim().toLowerCase()
          product = product.replace(/\s*(por favor|gracias|buenas|hola|quiero|deseo|necesito|comprar|llevar|pedir)$/i, '').trim()
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
        // Limpiar productos duplicados (sumar cantidades)
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
        console.log('🔧 Fallback result:', result)
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
        // 🔥 Asegurar que la cantidad se extrae correctamente
        let quantity = parseInt(p.quantity || p.cantidad || 0)
        // Si quantity es 0, intentar extraer del mensaje original
        if (quantity === 0 && originalMessage) {
          // Buscar "número + producto" en el mensaje original
          const regex = new RegExp(`(\\d+)\\s*${this.normalizeProductName(id)}`, 'i')
          const match = originalMessage.match(regex)
          if (match) {
            quantity = parseInt(match[1])
          } else {
            // Buscar "palabra_numérica + producto"
            const numMap: Record<string, number> = {
              'uno': 1, 'una': 1, 'un': 1,
              'dos': 2, 'tres': 3, 'cuatro': 4,
              'cinco': 5, 'seis': 6, 'siete': 7,
              'ocho': 8, 'nueve': 9, 'diez': 10
            }
            for (const [word, num] of Object.entries(numMap)) {
              const wordRegex = new RegExp(`${word}\\s*${this.normalizeProductName(id)}`, 'i')
              if (wordRegex.test(originalMessage)) {
                quantity = num
                break
              }
            }
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