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
            maxOutputTokens: 512,
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
      
      const cleanedText = this.cleanJsonResponse(textResponse)
      console.log('Cleaned JSON:', cleanedText)
      
      try {
        const parsed = JSON.parse(cleanedText)
        return this.mapGeminiResponseToOrder(parsed)
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError)
        console.log('Raw response:', textResponse)
        return { products: [] }
      }
    } catch (error) {
      console.error('Gemini error:', error)
      return { products: [] }
    }
  }

  private buildPrompt(message: string): string {
    return `
Extract products and quantities from the message. Respond ONLY with valid JSON, no markdown, no extra text.

Message: "${message}"

Expected format:
{"products":[{"id":"product_name","quantity":number}],"customerName":"customer_name","deliveryAddress":"delivery_address"}
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
    
    // Remove trailing commas
    cleaned = cleaned.replace(/,\s*$/, '')
    
    // Fix missing closing braces
    let openBraces = (cleaned.match(/\{/g) || []).length
    let closeBraces = (cleaned.match(/\}/g) || []).length
    while (closeBraces < openBraces) {
      cleaned += '}'
      closeBraces++
    }
    
    return cleaned
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
    
    // Fallback: try to parse from 'items' object if products array is empty
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