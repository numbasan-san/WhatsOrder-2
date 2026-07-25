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
            temperature: 0.3,
            topK: 32,
            topP: 0.95,
            maxOutputTokens: 1024, // Aumentado de 512 a 1024
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
      
      console.log('Raw response length:', textResponse.length)
      console.log('Raw response:', textResponse)
      
      // Intentar reparar la respuesta antes de limpiar
      const repairedResponse = this.repairIncompleteJson(textResponse)
      const cleanedText = this.cleanJsonResponse(repairedResponse)
      
      console.log('Cleaned JSON:', cleanedText)
      
      try {
        const parsed = JSON.parse(cleanedText)
        return this.mapGeminiResponseToOrder(parsed)
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError)
        // Si falla, intentar con un enfoque más agresivo
        const fallbackResult = this.tryFallbackParsing(textResponse)
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
    // Prompt más corto y directo para ahorrar tokens
    return `
Extract products from: "${message}"
Return JSON: {"products":[{"id":"name","quantity":number}]}
Only return JSON, no other text.
`.trim()
  }

  private repairIncompleteJson(text: string): string {
    let repaired = text.trim()
    
    // Si está vacío, devolver objeto vacío
    if (!repaired || repaired.length === 0) {
      return '{"products":[]}'
    }
    
    // Contar llaves abiertas y cerradas
    let openBraces = (repaired.match(/\{/g) || []).length
    let closeBraces = (repaired.match(/\}/g) || []).length
    
    // Si falta el cierre del objeto principal
    if (openBraces > closeBraces) {
      // Si hay un "products:" pero no tiene contenido, cerrarlo
      if (repaired.includes('"products"')) {
        // Si termina con "products": y está incompleto
        if (repaired.endsWith('"products":') || repaired.endsWith('"products": ')) {
          repaired += '[]}'
        }
        // Si termina con "products": [ y está incompleto
        else if (repaired.endsWith('"products": [') || repaired.endsWith('"products": [')) {
          repaired += ']}'
        }
        // Si termina con "products": { y está incompleto
        else if (repaired.endsWith('"products": {') || repaired.endsWith('"products": {')) {
          repaired += '}}'
        }
        // Si termina con "products": [ y tiene algo pero no está cerrado
        else if (repaired.includes('"products": [') && !repaired.includes(']')) {
          repaired += ']}'
        }
        // Si termina con una coma
        else if (repaired.endsWith(',')) {
          repaired = repaired.slice(0, -1)
          // Cerrar las llaves faltantes
          openBraces = (repaired.match(/\{/g) || []).length
          closeBraces = (repaired.match(/\}/g) || []).length
          while (closeBraces < openBraces) {
            repaired += '}'
            closeBraces++
          }
        }
      }
    }
    
    // Si el JSON está completamente vacío o solo tiene llaves abiertas
    if (repaired === '{' || repaired === '{"') {
      return '{"products":[]}'
    }
    
    // Cerrar llaves faltantes
    openBraces = (repaired.match(/\{/g) || []).length
    closeBraces = (repaired.match(/\}/g) || []).length
    while (closeBraces < openBraces) {
      repaired += '}'
      closeBraces++
    }
    
    return repaired
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
    
    // Remove trailing commas
    cleaned = cleaned.replace(/,\s*$/, '')
    
    return cleaned
  }

  private tryFallbackParsing(rawText: string): InterpretedOrder | null {
    try {
      // Intentar extraer productos con regex
      const productPattern = /["']?id["']?\s*:\s*["']([^"']+)["']/i
      const matches = rawText.match(productPattern)
      
      if (matches) {
        const products: ProductItem[] = []
        // Intentar encontrar todos los IDs
        const allMatches = rawText.match(/["']?id["']?\s*:\s*["']([^"']+)["']/gi)
        if (allMatches) {
          allMatches.forEach((match: string) => {
            const idMatch = match.match(/["']([^"']+)["']/)
            if (idMatch) {
              products.push({
                id: this.normalizeProductName(idMatch[1]),
                quantity: 1,
                price: 0
              })
            }
          })
        }
        if (products.length > 0) {
          return { products }
        }
      }
      
      return null
    } catch {
      return null
    }
  }

  private mapGeminiResponseToOrder(geminiResponse: any): InterpretedOrder {
    const products: ProductItem[] = []
    
    if (Array.isArray(geminiResponse.products)) {
      geminiResponse.products.forEach((p: any) => {
        const id = p.id || p.name || p.product || p.producto || p.nombre
        const quantity = parseInt(p.quantity || p.cantidad || 1)
        if (id) {
          products.push({
            id: this.normalizeProductName(id),
            quantity: Math.max(1, quantity),
            price: 0
          })
        }
      })
    }
    
    if (products.length === 0 && geminiResponse.items) {
      Object.entries(geminiResponse.items).forEach(([key, value]) => {
        const quantity = typeof value === 'number' ? value : 1
        products.push({
          id: this.normalizeProductName(key),
          quantity: Math.max(1, quantity),
          price: 0
        })
      })
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