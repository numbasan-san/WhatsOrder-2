import { ExternalServiceAdapter, InterpretedOrder, ProductItem } from './interfaces'

export class GeminiAdapter implements ExternalServiceAdapter {
  private apiKey: string
  private model: string

  constructor() {
    this.apiKey = process.env.GEMINI_API_TOKEN || ''
    this.model = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
    
    if (!this.apiKey) {
      console.error('GEMINI_API_TOKEN no está configurada')
    }
  }

  async interpretMessage(message: string): Promise<InterpretedOrder> {
    if (!this.apiKey) {
      console.error('API Key faltante')
      return { products: [] }
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`
      
      console.log(`🔍 Usando modelo: ${this.model}`)
      
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
          }
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Gemini Error ${response.status}:`, errorText)
        throw new Error(`Gemini API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      const cleanedText = this.cleanJsonResponse(textResponse)
      
      try {
        const parsed = JSON.parse(cleanedText)
        return this.mapGeminiResponseToOrder(parsed)
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError)
        console.log('Raw:', textResponse)
        return { products: [] }
      }
    } catch (error) {
      console.error('Gemini Error:', error)
      return { products: [] }
    }
  }

  private buildPrompt(message: string): string {
    return `
Extrae productos y cantidades del mensaje. Responde SOLO JSON.

Mensaje: "${message}"

Formato: {"products":[{"id":"nombre","quantity":numero}],"customerName":"nombre","deliveryAddress":"direccion"}
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
    
    return cleaned
  }

  private mapGeminiResponseToOrder(geminiResponse: any): InterpretedOrder {
    const products: ProductItem[] = []
    
    if (Array.isArray(geminiResponse.products)) {
      geminiResponse.products.forEach((p: any) => {
        const id = p.id || p.name || p.product || p.producto
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

    return {
      products,
      customerName: geminiResponse.customerName || undefined,
      deliveryAddress: geminiResponse.deliveryAddress || undefined,
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
    throw new Error('Gemini no implementa send')
  }

  async queryStock(): Promise<any> {
    throw new Error('Gemini no implementa stock queries')
  }

  async getPrice(): Promise<number> {
    throw new Error('Gemini no implementa price queries')
  }
}