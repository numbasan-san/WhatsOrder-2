// Interfaz unificada para servicios externos
export interface ExternalServiceAdapter {
  send(data: PedidoData): Promise<PedidoResponse>
  queryStock(productId: string): Promise<StockInfo>
  getPrice(productId: string, customerId: string): Promise<number>
  interpretMessage?(message: string): Promise<InterpretedOrder>
}

export interface PedidoData {
  orderId: string
  customerPhone: string
  products: ProductItem[]
  deliveryAddress: string
  notes?: string
}

export interface ProductItem {
  price: number
  id: string
  quantity: number
}

export interface PedidoResponse {
  success: boolean
  orderId?: string
  message?: string
  error?: string
}

export interface StockInfo {
  productId: string
  quantity: number
  available: boolean
}

export interface InterpretedOrder {
  products: ProductItem[]
  customerName?: string
  deliveryAddress?: string
  total?: number
}