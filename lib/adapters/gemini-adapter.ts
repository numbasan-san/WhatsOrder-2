import { ExternalServiceAdapter, InterpretedOrder, ProductItem } from './interfaces'

export class GeminiAdapter implements ExternalServiceAdapter {
  private apiUrl: string
  private apiKey: string
  private model: string

  constructor() {
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta'
    this.apiKey = process.env.GEMINI_API_TOKEN || ''
    this.model = process.env.GEMINI_MODEL || 'models/gemini-2.0-flash'
  }

  async interpretMessage(message: string): Promise<InterpretedOrder> {
    return this.retryWithBackoff(
      () => this.callGeminiAPI(message),
      3 // Intentos máximos
    )
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error: any) {
        lastError = error
        
        // Verificar si es error 429
        const isRateLimit = error.message?.includes('429') || 
                            error.message?.includes('rate limit') ||
                            error.message?.includes('quota')
        
        if (!isRateLimit || attempt === maxRetries - 1) {
          throw error
        }
        
        // Calcular delay con backoff exponencial + jitter
        const baseDelay = Math.min(1000 * Math.pow(2, attempt), 30000) // 1s, 2s, 4s, 8s, 16s, 30s max
        const jitter = Math.random() * 1000 // 0-1000ms
        const delay = baseDelay + jitter
        
        console.log(`⚠️ Rate limit (429). Reintentando en ${(delay/1000).toFixed(1)}s (intento ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError || new Error('Máximo de reintentos alcanzado')
  }

  private async callGeminiAPI(message: string): Promise<InterpretedOrder> {
    const prompt = this.buildPrompt(message)
    
    const response = await fetch(
      `${this.apiUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { 
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            topK: 32,
            topP: 0.95,
            maxOutputTokens: 512, // Reducir para ahorrar tokens
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API Error:', response.status, errorText)
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const cleanedText = this.cleanJsonResponse(textResponse)
    
    try {
      const parsed = JSON.parse(cleanedText)
      return this.mapGeminiResponseToOrder(parsed)
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError)
      return { products: [] }
    }
  }

  private buildPrompt(message: string): string {
    // Prompt optimizado para usar menos tokens
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

  // Métodos requeridos
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