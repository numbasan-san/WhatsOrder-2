import { ExternalServiceAdapter, InterpretedOrder, ProductItem } from './interfaces'

export class GeminiAdapter implements ExternalServiceAdapter {
  private apiUrl: string
  private apiKey: string
  private model: string

  constructor() {
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta'
    this.apiKey = process.env.GEMINI_API_TOKEN || ''
    this.model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  }

  async interpretMessage(message: string): Promise<InterpretedOrder> {
    try {
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
              maxOutputTokens: 1024,
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
        const error = await response.text()
        console.error('Gemini API Error:', error)
        throw new Error(`Gemini API Error: ${error}`)
      }

      const data = await response.json()
      
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      const cleanedText = this.cleanJsonResponse(textResponse)
      
      try {
        const parsed = JSON.parse(cleanedText)
        return this.mapGeminiResponseToOrder(parsed)
      } catch (parseError) {
        console.error('Error parsing Gemini response:', parseError)
        console.log('Raw response:', textResponse)
        return { products: [] }
      }
    } catch (error) {
      console.error('Gemini Error:', error)
      return { products: [] }
    }
  }

  private buildPrompt(message: string): string {
    return `
Eres un asistente de pedidos de supermercado. Tu tarea es interpretar mensajes de clientes y extraer la información del pedido.

INSTRUCCIONES:
1. Extrae los productos y cantidades del mensaje
2. Identifica nombres de productos (sin importar mayúsculas/minúsculas)
3. Las cantidades pueden ser números o palabras (ej: "uno", "dos", "tres")
4. Si el cliente menciona direcciones o nombres, extráelos también
5. Responde SOLO en formato JSON válido, sin texto adicional

MENSAJE DEL CLIENTE:
"${message}"

FORMATO DE RESPUESTA ESPERADO:
{
  "products": [
    { "id": "nombre_del_producto", "quantity": cantidad_numerica }
  ],
  "customerName": "nombre_del_cliente_si_mencionado",
  "deliveryAddress": "dirección_si_mencionada",
  "notes": "notas_adicionales_si_hay"
}

EJEMPLOS:
- "Quiero 2 litros de leche y 1 pan" → {"products":[{"id":"leche","quantity":2},{"id":"pan","quantity":1}]}
- "Necesito 3 manzanas, 1 jamón y 2 quesos" → {"products":[{"id":"manzanas","quantity":3},{"id":"jamón","quantity":1},{"id":"quesos","quantity":2}]}
- "Para Juan, 5 huevos, dirección Calle Principal 123" → {"products":[{"id":"huevos","quantity":5}],"customerName":"Juan","deliveryAddress":"Calle Principal 123"}

AHORA, procesa el mensaje del cliente y devuelve SOLO el JSON.
`.trim()
  }

  private cleanJsonResponse(text: string): string {
    let cleaned = text.trim()
    
    cleaned = cleaned.replace(/```json\s*/g, '')
    cleaned = cleaned.replace(/```\s*/g, '')
    
    const firstBracket = cleaned.indexOf('{')
    if (firstBracket > 0) {
      cleaned = cleaned.substring(firstBracket)
    }
    
    const lastBracket = cleaned.lastIndexOf('}')
    if (lastBracket > 0 && lastBracket < cleaned.length - 1) {
      cleaned = cleaned.substring(0, lastBracket + 1)
    }
    
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
    } else if (geminiResponse.items) {
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
      total: geminiResponse.total || undefined
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

  async interpretStockQuery(query: string): Promise<{ productId: string; productName: string }> {
    try {
      const prompt = `
Eres un asistente que interpreta consultas de stock.
Extrae el nombre del producto de esta consulta: "${query}"
Responde SOLO en JSON: {"productId": "nombre_normalizado", "productName": "nombre_original"}
`.trim()

      const response = await fetch(
        `${this.apiUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 100 }
          })
        }
      )

      if (!response.ok) throw new Error('Gemini API Error')

      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      const parsed = JSON.parse(this.cleanJsonResponse(text))
      
      return {
        productId: this.normalizeProductName(parsed.productId || parsed.productName || ''),
        productName: parsed.productName || parsed.productId || ''
      }
    } catch (error) {
      console.error('Error interpreting stock query:', error)
      return { productId: '', productName: '' }
    }
  }

  async batchInterpretMessages(messages: string[]): Promise<InterpretedOrder[]> {
    const results = await Promise.all(
      messages.map(msg => this.interpretMessage(msg))
    )
    return results
  }

  async send(): Promise<any> {
    throw new Error('Gemini adapter no implementa send - usa WhatsApp/Telegram')
  }

  async queryStock(): Promise<any> {
    throw new Error('Gemini adapter no implementa stock queries - usa ERP')
  }

  async getPrice(): Promise<number> {
    throw new Error('Gemini adapter no implementa price queries - usa ERP')
  }
}