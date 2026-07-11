import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'
import { ERPAdapter } from '@/lib/adapters/erp-adapter'
import { GeminiAdapter } from '@/lib/adapters/gemini-adapter'
import { createClient } from '@/lib/supabase/server'

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
      // 1. Interpretar mensaje con Gemini
      const interpreted = await this.gemini.interpretMessage(message)
      
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

      // 2. Verificar stock y obtener precios
      const productDetails = await Promise.all(
        interpreted.products.map(async (product: { id: string; quantity: number }) => {
          const stock = await this.erp.queryStock(product.id)
          const price = await this.erp.getPrice(product.id, chatId)
          return { ...product, stock, price }
        })
      )

      // 3. Calcular total
      const total = productDetails.reduce(
        (sum, p) => sum + (p.price * p.quantity),
        0
      )

      // 4. Guardar en base de datos
      const supabase = await createClient()
      const { data: order, error } = await supabase
        .from('pedidos')
        .insert({
          customer_phone: chatId,
          customer_name: interpreted.customerName || null,
          items: productDetails,
          total: total,
          status: 'pending',
          source: 'telegram',
          delivery_address: interpreted.deliveryAddress || null,
          raw_message: message // ← Guardar mensaje original para auditoría
        })
        .select()
        .single()

      if (error) throw error

      // 5. Enviar confirmación por Telegram con botones
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
      
      await this.telegram.sendSimpleMessage(
        chatId,
        'Ocurrió un error procesando tu pedido. Por favor, intenta de nuevo más tarde.'
      )
      
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
    
    // Obtener el pedido para enviar confirmación
    const { data: order, error: fetchError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', orderId)
      .single()

    if (fetchError) throw fetchError

    // Actualizar estado
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

    // Enviar notificación de aprobación por Telegram
    const telegram = new TelegramAdapter()
    await telegram.sendSimpleMessage(
      order.customer_phone,
      `¡Tu pedido #${orderId.slice(0, 8)} ha sido aprobado!\n\n📦 Estará en camino pronto.\n\nGracias por tu compra! 🙌`
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

    // Enviar notificación de rechazo por Telegram
    const telegram = new TelegramAdapter()
    await telegram.sendSimpleMessage(
      order.customer_phone,
      `Tu pedido #${orderId.slice(0, 8)} ha sido rechazado.\n\n${reason ? `Motivo: ${reason}` : 'Por favor, contacta a soporte para más información.'}\n\nDisculpa las molestias. 🙏`
    )

    return data
  }

  // Método adicional: Obtener pedidos por cliente
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

  // Método adicional: Obtener estadísticas
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