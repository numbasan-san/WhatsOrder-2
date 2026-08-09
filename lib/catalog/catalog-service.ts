import type { Producto } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export class CatalogService {
  constructor(private supabase: SupabaseClient) {}
  async getActive(): Promise<Producto[]> {
    const { data, error } = await this.supabase.from('productos').select('*').eq('active', true).order('name')
    if (error) throw error
    return (data ?? []) as Producto[]
  }
}
