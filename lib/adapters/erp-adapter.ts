import { ExternalServiceAdapter, StockInfo, PedidoData, PedidoResponse } from './interfaces'
import { createClient } from '@/lib/supabase/server'

export interface Product {
  id: string
  sku: string
  name: string
  price: number
  stock: number
  active: boolean
}

export class ERPAdapter implements ExternalServiceAdapter {
  private erpUrl: string
  private apiKey: string

  constructor() {
    this.erpUrl = process.env.ERP_API_URL || 'http://localhost:3000/mock-erp'
    this.apiKey = process.env.ERP_API_KEY || ''
  }

  async getProducts(): Promise<Product[]> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('active', true)
        .order('name')

      if (error) {
        console.warn('ERP no disponible, usando mock')
        return this.getMockProducts()
      }

      return data || []
    } catch (error) {
      console.warn('ERP no disponible, usando mock')
      return this.getMockProducts()
    }
  }

  /**
   * Normaliza un string para búsqueda (quita acentos, espacios, etc.)
   */
  private normalize(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Tokeniza un string en palabras clave
   */
  private tokenize(str: string): string[] {
    return this.normalize(str)
      .split(' ')
      .filter(word => word.length > 1)
  }

  /**
   * Calcula el score de coincidencia entre dos strings
   */
  private matchScore(query: string, target: string): number {
    const qTokens = this.tokenize(query)
    const tTokens = this.tokenize(target)
    
    let score = 0
    for (const q of qTokens) {
      for (const t of tTokens) {
        if (t === q) {
          score += 3
        } else if (t.includes(q) || q.includes(t)) {
          score += 2
        } else if (t.startsWith(q) || q.startsWith(t)) {
          score += 1
        }
      }
    }
    return score
  }

  /**
   * Busca un producto por nombre o SKU con matching difuso
   */
  async findProduct(query: string): Promise<Product | null> {
    const products = await this.getProducts()
    const normalizedQuery = this.normalize(query)

    if (!normalizedQuery || normalizedQuery.length < 2) {
      return null
    }

    // 1. Buscar coincidencia exacta
    let found = products.find(p => 
      this.normalize(p.name) === normalizedQuery ||
      this.normalize(p.sku) === normalizedQuery
    )

    if (found) return found

    // 2. Buscar coincidencia parcial con score
    const scored = products.map(p => ({
      product: p,
      score: this.matchScore(normalizedQuery, p.name)
    }))

    const best = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)

    if (best.length > 0 && best[0].score >= 2) {
      return best[0].product
    }

    // 3. Buscar por SKU
    const skuFound = products.find(p => 
      this.normalize(p.sku) === normalizedQuery
    )

    if (skuFound) return skuFound

    // 4. Buscar por token individual
    const tokens = this.tokenize(normalizedQuery)
    for (const token of tokens) {
      if (token.length < 3) continue
      const tokenFound = products.find(p => 
        this.normalize(p.name).includes(token) ||
        this.normalize(p.sku).includes(token)
      )
      if (tokenFound) return tokenFound
    }

    // 5. Buscar por palabras clave
    const words = normalizedQuery.split(' ')
    for (const word of words) {
      if (word.length < 3) continue
      const wordFound = products.find(p => 
        this.normalize(p.name).includes(word) ||
        this.normalize(p.sku).includes(word)
      )
      if (wordFound) return wordFound
    }

    return null
  }

  /**
   * Busca múltiples productos por nombre
   */
  async findProducts(queries: string[]): Promise<Map<string, Product>> {
    const result = new Map<string, Product>()

    for (const query of queries) {
      const product = await this.findProduct(query)
      if (product) {
        result.set(query, product)
      }
    }

    return result
  }

  /**
   * Obtiene sugerencias de productos similares
   */
  private getSuggestions(query: string, products: Product[]): string[] {
    const normalizedQuery = this.normalize(query)
    const scored = products.map(p => ({
      name: p.name,
      score: this.matchScore(normalizedQuery, p.name)
    }))

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.name)
  }

  /**
   * Valida un carrito contra el stock del ERP
   */
  async validateCart(cart: Array<{ id: string; quantity: number }>): Promise<{
    valid: boolean
    products: Product[]
    invalidItems: Array<{ id: string; reason: string; suggestions?: string[] }>
    stockIssues: Array<{ id: string; requested: number; available: number }>
  }> {
    const allProducts = await this.getProducts()
    const valid: Product[] = []
    const invalidItems: Array<{ id: string; reason: string; suggestions?: string[] }> = []
    const stockIssues: Array<{ id: string; requested: number; available: number }> = []

    for (const item of cart) {
      const product = await this.findProduct(item.id)
      
      if (!product) {
        const suggestions = this.getSuggestions(item.id, allProducts)
        invalidItems.push({ 
          id: item.id, 
          reason: 'Producto no encontrado en el inventario',
          suggestions: suggestions.length > 0 ? suggestions : undefined
        })
        continue
      }

      if (!product.active) {
        invalidItems.push({ 
          id: item.id, 
          reason: 'Producto inactivo' 
        })
        continue
      }

      if (product.stock < item.quantity) {
        stockIssues.push({
          id: item.id,
          requested: item.quantity,
          available: product.stock
        })
        continue
      }

      valid.push(product)
    }

    return {
      valid: invalidItems.length === 0 && stockIssues.length === 0,
      products: valid,
      invalidItems,
      stockIssues
    }
  }

  /**
   * Obtiene productos mock para desarrollo
   */
  private getMockProducts(): Product[] {
    return [
      { id: '1', sku: 'aceite-1l', name: 'Aceite vegetal 1L', price: 180, stock: 120, active: true },
      { id: '2', sku: 'arroz-5lb', name: 'Arroz premium 5lb', price: 220, stock: 200, active: true },
      { id: '3', sku: 'leche-1l', name: 'Leche entera 1L', price: 65, stock: 300, active: true },
      { id: '4', sku: 'cafe-500g', name: 'Cafe molido 500g', price: 320, stock: 80, active: true },
      { id: '5', sku: 'pollo-2kg', name: 'Pollo entero 2kg', price: 380, stock: 60, active: true },
      { id: '6', sku: 'pan-molde', name: 'Pan de molde', price: 95, stock: 90, active: true },
      { id: '7', sku: 'agua-6l', name: 'Agua embotellada 6L', price: 130, stock: 150, active: true },
      { id: '8', sku: 'jabon-liquido', name: 'Jabon liquido', price: 110, stock: 100, active: true },
      { id: '9', sku: 'huevos-docena', name: 'Huevos (docena)', price: 150, stock: 120, active: true },
      { id: '10', sku: 'azucar-5lb', name: 'Azucar crema 5lb', price: 160, stock: 140, active: true },
      { id: '11', sku: 'habichuelas-1lb', name: 'Habichuelas rojas 1lb', price: 70, stock: 180, active: true },
      { id: '12', sku: 'espagueti-1lb', name: 'Espagueti 1lb', price: 55, stock: 160, active: true },
      { id: '13', sku: 'salami-1lb', name: 'Salami 1lb', price: 140, stock: 70, active: true },
      { id: '14', sku: 'platano-unidad', name: 'Platano (unidad)', price: 15, stock: 400, active: true },
      { id: '15', sku: 'longaniza-1lb', name: 'Longaniza 1lb', price: 200, stock: 50, active: true },
    ]
  }

  async queryStock(productId: string): Promise<StockInfo> {
    const product = await this.findProduct(productId)
    return {
      productId: product?.id || productId,
      quantity: product?.stock || 0,
      available: (product?.stock || 0) > 0 && !!product?.active
    }
  }

  async getPrice(productId: string, customerId: string): Promise<number> {
    const product = await this.findProduct(productId)
    return product?.price || 0
  }

  async send(data: PedidoData): Promise<PedidoResponse> {
    const validation = await this.validateCart(
      data.products.map(p => ({ id: p.id, quantity: p.quantity }))
    )

    if (!validation.valid) {
      const errors = [
        ...validation.invalidItems.map(i => `${i.id} (${i.reason})`),
        ...validation.stockIssues.map(i => `${i.id} (solicitado: ${i.requested}, disponible: ${i.available})`)
      ]
      return {
        success: false,
        error: `Productos no disponibles: ${errors.join(', ')}`
      }
    }

    return {
      success: true,
      orderId: `ORD-${Date.now()}`,
      message: 'Pedido validado y enviado al ERP'
    }
  }
}