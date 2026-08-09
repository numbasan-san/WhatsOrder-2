// Interfaz unificada para servicios externos
export interface ExternalServiceAdapter {
  send(): Promise<unknown>
  queryStock(productId: string): Promise<StockInfo>
  getPrice(productId: string): Promise<number>
}

export interface StockInfo {
  productId: string
  quantity: number
  available: boolean
}
