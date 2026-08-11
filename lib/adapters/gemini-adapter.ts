import { ExternalServiceAdapter } from './interfaces'
import { buildCatalogPrompt, parseGeminiOrder, type ParsedOrder } from './gemini-parse'

export class GeminiAdapter implements ExternalServiceAdapter {
  private apiKey: string
  private model: string

  constructor() {
    this.apiKey = process.env.GEMINI_API_TOKEN || ''
    this.model = process.env.GEMINI_MODEL || 'gemini-flash-latest'

    if (!this.apiKey) {
      console.error('GEMINI_API_TOKEN is not configured')
    }
  }

  async interpret(message: string, catalogNames: string[]): Promise<ParsedOrder> {
    if (!this.apiKey) {
      console.error('API Key is missing')
      return { items: [], deliveryAddress: null, customerName: null }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`
    const prompt = buildCatalogPrompt(message, catalogNames)

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topK: 32,
          topP: 0.95,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      if (response.status === 429) {
        throw new Error(`429: Gemini rate limit excedido - ${errorText}`)
      }
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    return parseGeminiOrder(textResponse, message)
  }

  async send(): Promise<never> {
    throw new Error('GeminiAdapter no implementa send')
  }

  async queryStock(): Promise<never> {
    throw new Error('GeminiAdapter no implementa stock queries')
  }

  async getPrice(): Promise<number> {
    throw new Error('GeminiAdapter no implementa price queries')
  }
}
