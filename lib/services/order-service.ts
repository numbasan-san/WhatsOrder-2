import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'
import { ERPAdapter } from '@/lib/adapters/erp-adapter'
import { GeminiAdapter } from '@/lib/adapters/gemini-adapter'
import { createClient } from '@/lib/supabase/server'

// Rate Limiter por usuario
class UserRateLimiter {
  private userLimits: Map<string, { count: number; resetTime: number }> = new Map()
  private limit: number = 3
  private window: number = 60000

  canProcess(userId: string): boolean {
    const now = Date.now()
    const userLimit = this.userLimits.get(userId)
    
    if (!userLimit || now > userLimit.resetTime) {
      this.userLimits.set(userId, { count: 1, resetTime: now + this.window })
      return true
    }
    
    if (userLimit.count < this.limit) {
      userLimit.count++
      return true
    }
    
    return false
  }

  getRemainingTime(userId: string): number {
    const userLimit = this.userLimits.get(userId)
    if (!userLimit) return 0
    return Math.max(0, Math.ceil((userLimit.resetTime - Date.now()) / 1000))
  }
}

const rateLimiter = new UserRateLimiter()

export class OrderService {
  private telegram: TelegramAdapter
  private erp: ERPAdapter
  private gemini: GeminiAdapter

  constructor() {
    this.telegram = new TelegramAdapter()
    this.erp = new ERPAdapter()
    this.gemini = new GeminiAdapter()
  }

  async processTelegramOrder(message: string, chatId: string) {
    try {
      if (!rateLimiter.canProcess(chatId)) {
        const remainingTime = rateLimiter.getRemainingTime(chatId)
        await this.telegram.sendSimpleMessage(
          chatId,
          `Has alcanzado el limite de pedidos. Espera ${remainingTime} segundos antes de intentar de nuevo.`
        )
        return {
          success: false,
          error: 'Rate limit excedido',
          retryAfter: remainingTime
        }
      }

      let interpreted
      try {
        interpreted = await this.gemini.interpretMessage(message)
      } catch (error: any) {
        if (error.message?.includes('429') || error.message?.includes('rate limit')) {
          await this.telegram.sendSimpleMessage(
            chatId,
            'El servicio de IA esta experimentando alta demanda. Por favor, espera unos segundos y vuelve a intentar.'
          )
          return {
            success: false,
            error: 'Gemini rate limit excedido',
            retryAfter: 15
          }
        }
        throw error
      }
      
      if (!interpreted.products || interpreted.products.length === 0) {
        await this.telegram.sendSimpleMessage(
          chatId,
          'No pude identificar productos en tu mensaje. Por favor, intenta de nuevo con un formato claro.\n\n' +
          'Ejemplo: "Quiero 2 litros de leche, 1 pan y 3 manzanas"'
        )
        return {
          success: false,
          error: 'No se pudieron identificar productos en el mensaje'
        }
      }

      const productDetails = await Promise.all(
        interpreted.products.map(async (product: { id: string; quantity: number }) => {
          const stock = await this.erp.queryStock(product.id)
          const price = await this.erp.getPrice(product.id, chatId)
          return { ...product, stock, price }
        })
      )

      const total = productDetails.reduce(
        (sum, p) => sum + (p.price * p.quantity),
        0
      )

      const supabase = await createClient()
      
      const insertData = {
        customer_phone: chatId,
        customer_name: interpreted.customerName || null,
        items: productDetails,
        total: total,
        status: 'pending',
        source: 'telegram',
        delivery_address: interpreted.deliveryAddress || null
      }
      
      console.log('Inserting order:', insertData)
      
      const { data: order, error } = await supabase
        .from('pedidos')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error('Supabase insert error:', error)
        throw error
      }

      await this.telegram.send({
        customerPhone: chatId,
        products: interpreted.products,
        deliveryAddress: interpreted.deliveryAddress || 'Por confirmar',
        notes: `Total: $${total.toFixed(2)}`,
        orderId: order.id
      })

      return {
        success: true,
        orderId: order.id,
        total,
        message: 'Pedido creado correctamente'
      }
    } catch (error) {
      console.error('Error procesando pedido:', error)
      
      let errorMessage = 'Ocurrio un error procesando tu pedido. Por favor, intenta de nuevo mas tarde.'
      if (error instanceof Error) {
        if (error.message.includes('429')) {
          errorMessage = 'El servicio de IA esta sobrecargado. Espera unos segundos y vuelve a intentar.'
        } else if (error.message.includes('timeout')) {
          errorMessage = 'El servidor esta tardando en responder. Por favor, intenta de nuevo.'
        }
      }
      
      await this.telegram.sendSimpleMessage(chatId, errorMessage)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error procesando pedido'
      }
    }
  }

  async getPendingOrders() {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw error
    return data
  }

  async getOrderById(orderId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', orderId)
      .single()

    if (error) throw error
    return data
  }

  async approveOrder(orderId: string, csrId: string) {
    const supabase = await createClient()
    
    const { data: order, error: fetchError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', orderId)
      .single()

    if (fetchError) throw fetchError

    const { data, error } = await supabase
      .from('pedidos')
      .update({ 
        status: 'approved', 
        approved_by: csrId,
        approved_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single()

    if (error) throw error

    const telegram = new TelegramAdapter()
    await telegram.sendSimpleMessage(
      order.customer_phone,
      `Tu pedido #${orderId.slice(0, 8)} ha sido aprobado. Estara en camino pronto. Gracias por tu compra.`
    )

    return data
  }

  async rejectOrder(orderId: string, csrId: string, reason?: string) {
    const supabase = await createClient()
    
    const { data: order, error: fetchError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', orderId)
      .single()

    if (fetchError) throw fetchError

    const { data, error } = await supabase
      .from('pedidos')
      .update({ 
        status: 'rejected', 
        approved_by: csrId,
        notes: reason || 'Pedido rechazado'
      })
      .eq('id', orderId)
      .select()
      .single()

    if (error) throw error

    const telegram = new TelegramAdapter()
    await telegram.sendSimpleMessage(
      order.customer_phone,
      `Tu pedido #${orderId.slice(0, 8)} ha sido rechazado. ${reason ? `Motivo: ${reason}` : 'Por favor, contacta a soporte para mas informacion.'}`
    )

    return data
  }

  async getOrdersByCustomer(phoneNumber: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('customer_phone', phoneNumber)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error
    return data
  }

  async getOrderStats() {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('pedidos')
      .select('status, total, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    const stats = {
      total: data.length,
      pending: data.filter(o => o.status === 'pending').length,
      approved: data.filter(o => o.status === 'approved').length,
      rejected: data.filter(o => o.status === 'rejected').length,
      totalRevenue: data.reduce((sum, o) => sum + (o.total || 0), 0)
    }

    return stats
  }
}

export const orderService = new OrderService()