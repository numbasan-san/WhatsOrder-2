import { createClient } from '@/lib/supabase/server'
import { Session, CartItem } from './chatbot-service'

export class SessionService {
  async getSession(userId: string): Promise<Session> {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('chatbot_sessions')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (error || !data) {
      // Si no existe, crear una nueva sesión
      const newSession = {
        user_id: userId,
        state: 'idle',
        cart: [],
        customer_name: null,
        address: null,
        order_id: null
      }
      
      await supabase
        .from('chatbot_sessions')
        .insert(newSession)
      
      return {
        userId: userId,
        state: 'idle',
        cart: [],
        customerName: undefined,
        address: undefined,
        orderId: undefined
      }
    }
    
    return {
      userId: data.user_id,
      state: data.state as any,
      cart: data.cart || [],
      customerName: data.customer_name || undefined,
      address: data.address || undefined,
      orderId: data.order_id || undefined
    }
  }

  async updateSession(userId: string, updates: Partial<Session>): Promise<void> {
    const supabase = await createClient()
    
    // Convertir Session a formato de BD
    const dbUpdate: any = {
      state: updates.state || 'idle',
      cart: updates.cart || [],
      customer_name: updates.customerName || null,
      address: updates.address || null,
      order_id: updates.orderId || null,
      updated_at: new Date().toISOString()
    }
    
    const { error } = await supabase
      .from('chatbot_sessions')
      .upsert({
        user_id: userId,
        ...dbUpdate
      })
    
    if (error) {
      console.error('❌ Error actualizando sesión:', error)
    }
  }

  async clearSession(userId: string): Promise<void> {
    const supabase = await createClient()
    
    await supabase
      .from('chatbot_sessions')
      .upsert({
        user_id: userId,
        state: 'idle',
        cart: [],
        customer_name: null,
        address: null,
        order_id: null,
        updated_at: new Date().toISOString()
      })
  }
}

export const sessionService = new SessionService()