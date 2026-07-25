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
        return this.mapGeminiResponseToOrder(parsed)
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError)
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
    return `
Extract products from: "${message}"
Return JSON: {"products":[{"id":"name","quantity":number}]}
Only return JSON, no other text.
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
    // 1. Remove trailing commas
    cleaned = cleaned.replace(/,\s*}/g, '}')
    cleaned = cleaned.replace(/,\s*\]/g, ']')
    
    // 2. Fix extra quotes at the end (like ...null"})
    cleaned = cleaned.replace(/"\s*}$/g, '}')
    cleaned = cleaned.replace(/"\s*\]\s*}$/g, ']}')
    
    // 3. Remove any trailing quotes that don't belong
    cleaned = cleaned.replace(/"+/g, (match) => {
      // If there are multiple quotes in a row, keep only one
      return '"'
    })
    
    // 4. Fix null values with quotes
    cleaned = cleaned.replace(/"null"/g, 'null')
    cleaned = cleaned.replace(/"undefined"/g, 'null')
    
    // 5. Ensure proper closing
    let openBraces = (cleaned.match(/\{/g) || []).length
    let closeBraces = (cleaned.match(/\}/g) || []).length
    
    // If there's an extra closing brace, remove it
    while (closeBraces > openBraces) {
      const lastBraceIndex = cleaned.lastIndexOf('}')
      if (lastBraceIndex > 0) {
        cleaned = cleaned.substring(0, lastBraceIndex) + cleaned.substring(lastBraceIndex + 1)
        closeBraces--
      } else {
        break
      }
    }
    
    // If there's a missing closing brace, add it
    while (closeBraces < openBraces) {
      cleaned += '}'
      closeBraces++
    }
    
    // 6. Final cleanup: ensure it starts with { and ends with }
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
      
      // Try to extract product names and quantities using regex
      const productMatches = rawText.matchAll(/["']?id["']?\s*:\s*["']([^"']+)["']/gi)
      const quantityMatches = rawText.matchAll(/["']?quantity["']?\s*:\s*(\d+)/gi)
      
      const ids: string[] = []
      const quantities: number[] = []
      
      for (const match of productMatches) {
        ids.push(match[1])
      }
      
      for (const match of quantityMatches) {
        quantities.push(parseInt(match[1]))
      }
      
      // If we have IDs, use them
      if (ids.length > 0) {
        ids.forEach((id, index) => {
          const quantity = quantities[index] || 1
          products.push({
            id: this.normalizeProductName(id),
            quantity: Math.max(1, quantity),
            price: 0
          })
        })
        return { products }
      }
      
      // Try to find any quoted strings that might be products
      const stringMatches = rawText.match(/["']([^"']+)["']/g)
      if (stringMatches && stringMatches.length > 0) {
        stringMatches.forEach((match) => {
          const cleanMatch = match.replace(/["']/g, '')
          if (cleanMatch.length > 1 && 
              !['products', 'id', 'quantity', 'customerName', 'deliveryAddress', 'null', 'true', 'false'].includes(cleanMatch.toLowerCase())) {
            products.push({
              id: this.normalizeProductName(cleanMatch),
              quantity: 1,
              price: 0
            })
          }
        })
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