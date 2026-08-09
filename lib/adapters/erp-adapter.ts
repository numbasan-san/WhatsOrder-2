import type { SupabaseClient } from '@supabase/supabase-js'
import { ExternalServiceAdapter, StockInfo } from './interfaces'

export class ERPAdapter implements ExternalServiceAdapter {
  constructor(private supabase: SupabaseClient) {}
  async queryStock(productId: string): Promise<StockInfo> {
    const { data } = await this.supabase.from('productos').select('sku,stock').eq('sku', productId).maybeSingle()
    if (!data) return { productId, quantity: 0, available: false }
    return { productId, quantity: data.stock, available: data.stock > 0 }
  }
  async getPrice(productId: string): Promise<number> {
    const { data } = await this.supabase.from('productos').select('price').eq('sku', productId).maybeSingle()
    if (!data) throw new Error(`Sin precio para ${productId}`)
    return data.price
  }
  async send(): Promise<never> { throw new Error('ERPAdapter.send no implementado') }
}