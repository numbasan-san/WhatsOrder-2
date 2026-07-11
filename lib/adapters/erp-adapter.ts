import { ExternalServiceAdapter, StockInfo, PedidoData, PedidoResponse } from './interfaces'

export class ERPAdapter implements ExternalServiceAdapter {
  private erpUrl: string
  private apiKey: string

  constructor() {
    this.erpUrl = process.env.ERP_API_URL || 'http://localhost:3000/mock-erp'
    this.apiKey = process.env.ERP_API_KEY || ''
  }

  async queryStock(productId: string): Promise<StockInfo> {
    try {
      const response = await fetch(`${this.erpUrl}/stock/${productId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        return {
          productId,
          quantity: Math.floor(Math.random() * 100),
          available: true
        }
      }

      return await response.json()
    } catch (error) {
      console.warn('ERP no disponible, usando mock')
      return {
        productId,
        quantity: 50,
        available: true
      }
    }
  }

  async getPrice(productId: string, customerId: string): Promise<number> {
    try {
      const response = await fetch(
        `${this.erpUrl}/price/${productId}?customer=${customerId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          }
        }
      )

      if (!response.ok) {
        return Math.round((Math.random() * 100 + 10) * 100) / 100
      }

      const data = await response.json()
      return data.price
    } catch (error) {
      console.warn('ERP no disponible, usando mock')
      return Math.round((Math.random() * 100 + 10) * 100) / 100
    }
  }

  async send(data: PedidoData): Promise<PedidoResponse> {
    try {
      const response = await fetch(`${this.erpUrl}/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        throw new Error(`ERP Error: ${await response.text()}`)
      }

      const result = await response.json()
      return {
        success: true,
        orderId: result.orderId,
        message: 'Pedido creado en ERP'
      }
    } catch (error) {
      return {
        success: true,
        orderId: `ORD-${Date.now()}`,
        message: 'Pedido creado (mock)'
      }
    }
  }
}