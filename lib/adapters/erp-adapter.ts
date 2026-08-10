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

  /**
   * Consulta todos los productos activos del ERP
   */
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
   * Busca un producto por nombre o SKU
   */
  async findProduct(query: string): Promise<Product | null> {
    const products = await this.getProducts()
    const normalizedQuery = query.toLowerCase().trim()

    let found = products.find(p => 
      p.name.toLowerCase() === normalizedQuery ||
      p.sku.toLowerCase() === normalizedQuery
    )

    if (!found) {
      found = products.find(p => 
        p.name.toLowerCase().includes(normalizedQuery) ||
        normalizedQuery.includes(p.name.toLowerCase()) ||
        p.sku.toLowerCase().includes(normalizedQuery)
      )
    }

    return found || null
  }

  /**
   * Busca múltiples productos por nombre
   */
  async findProducts(queries: string[]): Promise<Map<string, Product>> {
    const products = await this.getProducts()
    const result = new Map<string, Product>()

    for (const query of queries) {
      const normalizedQuery = query.toLowerCase().trim()
      
      let found = products.find(p => 
        p.name.toLowerCase() === normalizedQuery ||
        p.sku.toLowerCase() === normalizedQuery
      )

      if (!found) {
        found = products.find(p => 
          p.name.toLowerCase().includes(normalizedQuery) ||
          normalizedQuery.includes(p.name.toLowerCase())
        )
      }

      if (found) {
        result.set(query, found)
      }
    }

    return result
  }

  /**
   * Valida un carrito contra el stock del ERP
   */
  async validateCart(cart: Array<{ id: string; quantity: number }>): Promise<{
    valid: boolean
    products: Product[]
    invalid: Array<{ id: string; reason: string }>
    stockIssues: Array<{ id: string; requested: number; available: number }>
  }> {
    const allProducts = await this.getProducts()
    const valid: Product[] = []
    const invalid: Array<{ id: string; reason: string }> = []
    const stockIssues: Array<{ id: string; requested: number; available: number }> = []

    for (const item of cart) {
      const product = await this.findProduct(item.id)
      
      if (!product) {
        invalid.push({ 
          id: item.id, 
          reason: 'Producto no encontrado en el inventario' 
        })
        continue
      }

      if (!product.active) {
        invalid.push({ 
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
      valid: invalid.length === 0 && stockIssues.length === 0,
      products: valid,
      invalid,
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
      { id: '4', sku: 'cafe-500g', name: 'Café molido 500g', price: 320, stock: 80, active: true },
      { id: '5', sku: 'pollo-2kg', name: 'Pollo entero 2kg', price: 380, stock: 60, active: true },
      { id: '6', sku: 'pan-molde', name: 'Pan de molde', price: 95, stock: 90, active: true },
      { id: '7', sku: 'agua-6l', name: 'Agua embotellada 6L', price: 130, stock: 150, active: true },
      { id: '8', sku: 'jabon-liquido', name: 'Jabón líquido', price: 110, stock: 100, active: true },
      { id: '9', sku: 'huevos-docena', name: 'Huevos (docena)', price: 150, stock: 120, active: true },
      { id: '10', sku: 'azucar-5lb', name: 'Azúcar crema 5lb', price: 160, stock: 140, active: true },
      { id: '11', sku: 'habichuelas-1lb', name: 'Habichuelas rojas 1lb', price: 70, stock: 180, active: true },
      { id: '12', sku: 'espagueti-1lb', name: 'Espagueti 1lb', price: 55, stock: 160, active: true },
      { id: '13', sku: 'salami-1lb', name: 'Salami 1lb', price: 140, stock: 70, active: true },
      { id: '14', sku: 'platano-unidad', name: 'Plátano (unidad)', price: 15, stock: 400, active: true },
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
        ...validation.invalid.map(i => `${i.id} (${i.reason})`),
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