import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'
import { ERPAdapter } from '@/lib/adapters/erp-adapter'
import { GeminiAdapter } from '@/lib/adapters/gemini-adapter'
import { createClient } from '@/lib/supabase/server'

export interface Session {
  userId: string
  state: 'idle' | 'awaiting_order' | 'awaiting_address' | 'awaiting_confirmation' | 'awaiting_correction'
  cart: CartItem[]
  customerName?: string
  address?: string
  orderId?: string
  rawMessage?: string
}

export interface CartItem {
  id: string
  quantity: number
  price?: number
}

export class ChatbotService {
  private sessions: Map<string, Session> = new Map()
  private telegram: TelegramAdapter
  private erp: ERPAdapter
  private gemini: GeminiAdapter

  constructor() {
    this.telegram = new TelegramAdapter()
    this.erp = new ERPAdapter()
    this.gemini = new GeminiAdapter()
  }

  getSession(userId: string): Session {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        userId,
        state: 'idle',
        cart: []
      })
    }
    return this.sessions.get(userId)!
  }

  updateSession(userId: string, updates: Partial<Session>) {
    const session = this.getSession(userId)
    this.sessions.set(userId, { ...session, ...updates })
  }

  clearSession(userId: string) {
    this.sessions.set(userId, {
      userId,
      state: 'idle',
      cart: []
    })
  }

  async handleMessage(userId: string, message: string): Promise<string> {
    const session = this.getSession(userId)
    const lowerMsg = message.toLowerCase().trim()

    // Comandos especiales
    if (lowerMsg === '/start') {
      this.clearSession(userId)
      return this.getWelcomeMessage()
    }

    if (lowerMsg === '/cancel') {
      this.clearSession(userId)
      return '🔄 Pedido cancelado. Puedes comenzar de nuevo cuando quieras con /start'
    }

    if (lowerMsg === '/help') {
      return this.getHelpMessage()
    }

    if (lowerMsg === '/status') {
      return await this.getStatusMessage(userId)
    }

    // Manejar estados
    switch (session.state) {
      case 'idle':
        return await this.handleIdleState(userId, message)
      
      case 'awaiting_order':
        return await this.handleOrderState(userId, message)
      
      case 'awaiting_address':
        return await this.handleAddressState(userId, message)
      
      case 'awaiting_confirmation':
        return await this.handleConfirmationState(userId, message)
      
      case 'awaiting_correction':
        return await this.handleCorrectionState(userId, message)
      
      default:
        return 'No entiendo ese comando. Escribe /help para ver las opciones disponibles.'
    }
  }

  private async handleIdleState(userId: string, message: string): Promise<string> {
    try {
      const interpreted = await this.gemini.interpretMessage(message)
      
      if (interpreted.products && interpreted.products.length > 0) {
        const session = this.getSession(userId)
        session.cart = interpreted.products.map(p => ({
          id: p.id,
          quantity: p.quantity || 1,
          price: p.price || 0
        }))
        session.customerName = interpreted.customerName || 'Cliente'
        session.rawMessage = message
        session.state = 'awaiting_confirmation'
        this.updateSession(userId, session)
        
        const productList = interpreted.products
          .map((p, i) => `${i + 1}. ${p.id} — ${p.quantity || 1} unidad(es)`)
          .join('\n')
        
        return `📦 He identificado estos productos:\n\n${productList}\n\n${interpreted.customerName ? `👤 Cliente: ${interpreted.customerName}\n` : ''}${interpreted.deliveryAddress ? `📍 Dirección: ${interpreted.deliveryAddress}\n` : ''}\n\n¿Es correcto?\n\nResponde "Sí" para confirmar, "No" para corregir, o "Cancelar" para cancelar.`
      }
      
      return 'No pude identificar productos en tu mensaje. Por favor, intenta con un formato como:\n\n"Quiero 2 leches, 1 pan y 3 manzanas"\n\nO escribe /help para más ayuda.'
    } catch {
      return 'Ocurrió un error procesando tu mensaje. Por favor, intenta de nuevo.'
    }
  }

  private async handleOrderState(userId: string, message: string): Promise<string> {
    return this.handleIdleState(userId, message)
  }

  private async handleAddressState(userId: string, message: string): Promise<string> {
    const session = this.getSession(userId)
    session.address = message
    session.state = 'awaiting_confirmation'
    this.updateSession(userId, session)
    
    const productList = session.cart
      .map((item, i) => `${i + 1}. ${item.id} — ${item.quantity} unidad(es)`)
      .join('\n')
    
    return `✅ Dirección guardada: ${message}\n\n📦 Resumen del pedido:\n${productList}\n\n👤 Cliente: ${session.customerName || 'No especificado'}\n\n¿Deseas confirmar el pedido?\n\nResponde "Sí" para confirmar, "No" para corregir, o "Cancelar" para cancelar.`
  }

  private async handleConfirmationState(userId: string, message: string): Promise<string> {
    const lowerMsg = message.toLowerCase().trim()
    const session = this.getSession(userId)
    
    if (lowerMsg === 'si' || lowerMsg === 'sí' || lowerMsg === 'confirmar') {
      // Verificar si tiene dirección
      if (!session.address) {
        session.state = 'awaiting_address'
        this.updateSession(userId, session)
        return '📍 Por favor, ingresa tu dirección de entrega para continuar.'
      }
      return await this.confirmOrder(userId)
    }
    
    if (lowerMsg === 'no' || lowerMsg === 'corregir' || lowerMsg === 'modificar') {
      session.state = 'awaiting_correction'
      this.updateSession(userId, session)
      return '📝 Envía el pedido corregido con el formato:\n\n"Quiero 2 leches, 1 pan y 3 manzanas"\n\nO escribe /cancel para cancelar.'
    }
    
    if (lowerMsg === 'cancelar' || lowerMsg === 'cancel') {
      this.clearSession(userId)
      return '❌ Pedido cancelado. Puedes comenzar de nuevo con /start'
    }
    
    return '❓ No entendí tu respuesta. Responde "Sí" para confirmar, "No" para corregir, o "Cancelar" para cancelar.'
  }

  private async handleCorrectionState(userId: string, message: string): Promise<string> {
    const session = this.getSession(userId)
    
    try {
      const interpreted = await this.gemini.interpretMessage(message)
      
      if (interpreted.products && interpreted.products.length > 0) {
        session.cart = interpreted.products.map(p => ({
          id: p.id,
          quantity: p.quantity || 1,
          price: p.price || 0
        }))
        session.customerName = interpreted.customerName || session.customerName || 'Cliente'
        session.rawMessage = message
        
        // Si no tiene dirección, pedirla
        if (!session.address) {
          session.state = 'awaiting_address'
          this.updateSession(userId, session)
          const productList = interpreted.products
            .map((p, i) => `${i + 1}. ${p.id} — ${p.quantity || 1} unidad(es)`)
            .join('\n')
          return `✅ Pedido actualizado:\n\n${productList}\n\n📍 Por favor, ingresa tu dirección de entrega.`
        }
        
        session.state = 'awaiting_confirmation'
        this.updateSession(userId, session)
        
        const productList = interpreted.products
          .map((p, i) => `${i + 1}. ${p.id} — ${p.quantity || 1} unidad(es)`)
          .join('\n')
        
        return `✅ Pedido actualizado:\n\n${productList}\n\n👤 Cliente: ${session.customerName || 'No especificado'}\n📍 Dirección: ${session.address}\n\n¿Confirmas este pedido?\n\nResponde "Sí" para confirmar, "No" para corregir, o "Cancelar" para cancelar.`
      }
      
      return 'No pude identificar productos en tu mensaje. Intenta con un formato como:\n\n"Quiero 2 leches, 1 pan y 3 manzanas"\n\nO escribe /cancel para cancelar.'
    } catch {
      return 'Ocurrió un error. Por favor, intenta de nuevo o escribe /cancel para reiniciar.'
    }
  }

  private async confirmOrder(userId: string): Promise<string> {
    const session = this.getSession(userId)
    
    if (session.cart.length === 0) {
      this.clearSession(userId)
      return '❌ No hay productos en tu pedido. Comienza de nuevo con /start'
    }
    
    try {
      // Obtener precios del ERP
      const productDetails = await Promise.all(
        session.cart.map(async (item) => {
          const price = await this.erp.getPrice(item.id, userId)
          const stock = await this.erp.queryStock(item.id)
          return { ...item, price, stock }
        })
      )

      const total = productDetails.reduce(
        (sum, p) => sum + (p.price * p.quantity),
        0
      )

      // Crear el pedido en la base de datos
      const supabase = await createClient()
      
      const insertData = {
        customer_phone: userId,
        customer_name: session.customerName || null,
        items: productDetails.map(p => ({
          id: p.id,
          quantity: p.quantity,
          price: p.price,
          subtotal: p.price * p.quantity
        })),
        total: total,
        status: 'pending',
        source: 'telegram',
        delivery_address: session.address || null,
        notes: session.rawMessage || null
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

      const productList = session.cart
        .map((item, i) => `${i + 1}. ${item.id} — ${item.quantity} unidad(es)`)
        .join('\n')
      
      this.clearSession(userId)
      
      return `✅ ¡Pedido #${order.id.slice(0, 8)} confirmado!\n\n📦 Productos:\n${productList}\n\n👤 Cliente: ${session.customerName || 'No especificado'}\n📍 Dirección: ${session.address || 'No especificada'}\n\n💰 Total: $${total.toFixed(2)}\n\n📊 Un agente revisará tu pedido y te notificará cuando sea aprobado.\n\nGracias por tu compra! 🙌`
    } catch (error) {
      console.error('Error confirming order:', error)
      this.clearSession(userId)
      return '❌ Ocurrió un error al procesar tu pedido. Por favor, intenta de nuevo más tarde.'
    }
  }

  private async getStatusMessage(userId: string): Promise<string> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, status, total, created_at')
        .eq('customer_phone', userId)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error
      
      if (!data || data.length === 0) {
        return '📭 No tienes pedidos registrados.'
      }
      
      let message = '📋 Tus últimos pedidos:\n\n'
      
      data.forEach((order: any) => {
        const statusMap: Record<string, string> = {
          pending: '⏳ Pendiente',
          approved: '✅ Aprobado',
          rejected: '❌ Rechazado',
          delivered: '📦 Entregado'
        }
        const date = new Date(order.created_at).toLocaleDateString('es-DO')
        message += `#${order.id.slice(0, 8)} — ${statusMap[order.status] || order.status}\n`
        message += `💰 $${order.total?.toFixed(2) || '0.00'} — ${date}\n\n`
      })
      
      return message
    } catch {
      return '❌ No pude obtener el estado de tus pedidos. Por favor, intenta de nuevo.'
    }
  }

  private getWelcomeMessage(): string {
    return `👋 ¡Bienvenido a WhatsOrder!\n\nPuedes hacer tu pedido de forma natural:\n\n"Quiero 2 litros de leche, 1 pan y 3 manzanas"\n\nTe pediré confirmación y dirección antes de procesarlo.\n\nComandos disponibles:\n/help - Ver ayuda\n/status - Ver estado de tus pedidos\n/cancel - Cancelar pedido en curso`
  }

  private getHelpMessage(): string {
    return `📖 Ayuda de WhatsOrder:\n\n📝 Para hacer un pedido, escribe los productos que deseas:\n"Quiero 2 leches, 1 pan y 3 manzanas"\n\n📌 Te pediré:\n1. Confirmación del pedido\n2. Dirección de entrega\n\n📋 Comandos:\n/start - Iniciar el bot\n/status - Ver estado de tus pedidos\n/cancel - Cancelar pedido en curso\n/help - Ver esta ayuda`
  }
}

export const chatbotService = new ChatbotService()