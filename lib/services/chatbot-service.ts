import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'
import { orderService, OrderService } from './order-service'
import { GeminiAdapter } from '@/lib/adapters/gemini-adapter'
import { sessionService } from './session-service'

export interface Session {
  userId: string
  state: 'idle' | 'awaiting_order' | 'awaiting_address' | 'awaiting_confirmation'
  cart: CartItem[]
  customerName?: string
  address?: string
  orderId?: string
}

export interface CartItem {
  id: string
  quantity: number
  price?: number
}

export class ChatbotService {
  private telegram: TelegramAdapter
  private gemini: GeminiAdapter

  constructor() {
    this.telegram = new TelegramAdapter()
    this.gemini = new GeminiAdapter()
  }

  async getSession(userId: string): Promise<Session> {
    return await sessionService.getSession(userId)
  }

  async updateSession(userId: string, updates: Partial<Session>): Promise<void> {
    await sessionService.updateSession(userId, updates)
    console.log(`📝 Sesión actualizada para ${userId}:`, {
      state: updates.state,
      cartLength: updates.cart?.length
    })
  }

  async clearSession(userId: string): Promise<void> {
    await sessionService.clearSession(userId)
    console.log(`🧹 Sesión limpiada para ${userId}`)
  }

  async handleMessage(userId: string, message: string): Promise<string> {
    const session = await this.getSession(userId)
    console.log(`📊 Sesión para ${userId}:`, {
      state: session.state,
      cartLength: session.cart.length,
      address: session.address,
      customerName: session.customerName
    })
    
    const lowerMsg = message.toLowerCase().trim()

    // Comandos especiales
    if (lowerMsg === '/start') {
      await this.clearSession(userId)
      return this.getWelcomeMessage(userId)
    }

    if (lowerMsg === '/cancel') {
      await this.clearSession(userId)
      return '🔄 Pedido cancelado. Puedes comenzar de nuevo cuando quieras.'
    }

    if (lowerMsg === '/help') {
      return this.getHelpMessage()
    }

    if (lowerMsg === '/status') {
      return await this.getStatusMessage(userId)
    }

    // Manejar estados
    switch (session.state) {
      case 'awaiting_confirmation':
        console.log('🔍 Estado: awaiting_confirmation')
        return await this.handleConfirmationState(userId, message)
      
      case 'awaiting_address':
        console.log('🔍 Estado: awaiting_address')
        return await this.handleAddressState(userId, message)
      
      case 'awaiting_order':
        console.log('🔍 Estado: awaiting_order')
        return await this.handleOrderState(userId, message)
      
      case 'idle':
        console.log('🔍 Estado: idle')
        return await this.handleIdleState(userId, message)
      
      default:
        return 'No entiendo ese comando. Escribe /help para ver las opciones disponibles.'
    }
  }

  private async handleIdleState(userId: string, message: string): Promise<string> {
    try {
      console.log(`🔄 Procesando mensaje en idle: "${message}"`)
      const interpreted = await this.gemini.interpretMessage(message)
      console.log(`📦 Productos identificados: ${JSON.stringify(interpreted.products)}`)
      
      if (interpreted.products && interpreted.products.length > 0) {
        const session = await this.getSession(userId)
        session.cart = interpreted.products.map((p: any) => ({
          id: p.id,
          quantity: p.quantity || 1,
          price: p.price || 0
        }))
        session.customerName = interpreted.customerName || 'Cliente'
        session.state = 'awaiting_address'
        await this.updateSession(userId, session)
        
        const productList = interpreted.products
          .map((p: any, i: number) => `${i + 1}. ${p.id} — ${p.quantity || 1} unidad(es)`)
          .join('\n')
        
        return `📦 He identificado estos productos:\n\n${productList}\n\n📍 Por favor, confírmame tu dirección de entrega.`
      }
      
      return 'No pude identificar productos en tu mensaje. Por favor, intenta con un formato como:\n\n"Quiero 2 leches, 1 pan y 3 manzanas"\n\nO escribe /help para más ayuda.'
    } catch (error) {
      console.error('❌ Error en handleIdleState:', error)
      return 'Ocurrió un error procesando tu mensaje. Por favor, intenta de nuevo.'
    }
  }

  private async handleOrderState(userId: string, message: string): Promise<string> {
    const session = await this.getSession(userId)
    console.log(`🔄 Procesando mensaje en order: "${message}"`)
    
    try {
      const interpreted = await this.gemini.interpretMessage(message)
      
      if (interpreted.products && interpreted.products.length > 0) {
        session.cart = interpreted.products.map((p: any) => ({
          id: p.id,
          quantity: p.quantity || 1,
          price: p.price || 0
        }))
        session.customerName = interpreted.customerName || session.customerName || 'Cliente'
        session.state = 'awaiting_address'
        await this.updateSession(userId, session)
        
        const productList = interpreted.products
          .map((p: any, i: number) => `${i + 1}. ${p.id} — ${p.quantity || 1} unidad(es)`)
          .join('\n')
        
        return `✅ Productos actualizados:\n\n${productList}\n\n📍 Ahora, confírmame tu dirección de entrega.`
      }
      
      return 'No pude identificar productos en tu mensaje. Intenta con un formato como:\n\n"Quiero 2 leches, 1 pan y 3 manzanas"'
    } catch {
      return 'Ocurrió un error. Por favor, intenta de nuevo o escribe /cancel para reiniciar.'
    }
  }

  private async handleAddressState(userId: string, message: string): Promise<string> {
    const session = await this.getSession(userId)
    console.log(`📝 Guardando dirección: "${message}"`)
    
    session.address = message
    session.state = 'awaiting_confirmation'
    await this.updateSession(userId, session)
    
    const productList = session.cart
      .map((item, i) => `${i + 1}. ${item.id} — ${item.quantity} unidad(es)`)
      .join('\n')
    
    return `✅ Dirección guardada: ${message}\n\n📦 Resumen del pedido:\n${productList}\n\n¿Deseas confirmar el pedido?\n\nResponde "Sí" para confirmar, "No" para cancelar, o escribe /cancel para reiniciar.`
  }

  private async handleConfirmationState(userId: string, message: string): Promise<string> {
    const lowerMsg = message.toLowerCase().trim()
    const session = await this.getSession(userId)
    
    console.log(`📝 Confirmación recibida: "${message}"`)
    console.log(`📊 Estado actual: ${session.state}`)
    console.log(`🛒 Carrito: ${JSON.stringify(session.cart)}`)
    
    if (lowerMsg === 'si' || lowerMsg === 'sí' || lowerMsg === 'confirmar') {
      console.log('✅ Confirmando pedido...')
      return await this.confirmOrder(userId)
    }
    
    if (lowerMsg === 'no' || lowerMsg === 'cancelar') {
      await this.clearSession(userId)
      return '❌ Pedido cancelado. Puedes comenzar de nuevo cuando quieras.'
    }
    
    return '❓ No entendí tu respuesta. Responde "Sí" para confirmar o "No" para cancelar.'
  }

  private async confirmOrder(userId: string): Promise<string> {
    const session = await this.getSession(userId)
    console.log(`📦 Confirmando pedido para ${userId}`)
    console.log(`🛒 Productos: ${JSON.stringify(session.cart)}`)
    
    if (session.cart.length === 0) {
      await this.clearSession(userId)
      return '❌ No hay productos en tu pedido. Comienza de nuevo.'
    }
    
    try {
      const result = await orderService.processTelegramOrder(
        `Pedido de ${session.customerName}: ${session.cart.map((i: CartItem) => `${i.id} x${i.quantity}`).join(', ')}`,
        userId
      )
      
      console.log(`📊 Resultado: ${JSON.stringify(result)}`)
      
      if (result.success) {
        const orderId = result.orderId
        const productList = session.cart
          .map((item: CartItem, i: number) => `${i + 1}. ${item.id} — ${item.quantity} unidad(es)`)
          .join('\n')
        
        await this.clearSession(userId)
        
        return `✅ ¡Pedido #${orderId} confirmado!\n\n📦 Productos:\n${productList}\n\n📍 Dirección: ${session.address}\n\n📊 Total: $${result.total?.toFixed(2) || '0.00'}\n\nUn agente revisará tu pedido y te notificará cuando sea aprobado.`
      }
      
      await this.clearSession(userId)
      return '❌ Ocurrió un error al procesar tu pedido. Por favor, intenta de nuevo más tarde.'
    } catch (error) {
      console.error('❌ Error confirmando pedido:', error)
      await this.clearSession(userId)
      return '❌ Ocurrió un error al procesar tu pedido. Por favor, intenta de nuevo más tarde.'
    }
  }

  private async getStatusMessage(userId: string): Promise<string> {
    try {
      const orders = await orderService.getOrdersByCustomer(userId)
      
      if (!orders || orders.length === 0) {
        return '📭 No tienes pedidos registrados.'
      }
      
      const recentOrders = orders.slice(0, 5)
      let message = '📋 Tus pedidos recientes:\n\n'
      
      recentOrders.forEach((order: any) => {
        const statusMap: Record<string, string> = {
          pending: '⏳ Pendiente',
          approved: '✅ Aprobado',
          rejected: '❌ Rechazado'
        }
        message += `#${order.id.slice(0, 8)} — ${statusMap[order.status] || order.status}\n`
        message += `💰 $${order.total?.toFixed(2) || '0.00'}\n\n`
      })
      
      if (orders.length > 5) {
        message += `Y ${orders.length - 5} pedidos más.`
      }
      
      return message
    } catch {
      return '❌ No pude obtener el estado de tus pedidos. Por favor, intenta de nuevo.'
    }
  }

  private getWelcomeMessage(userId: string): string {
    return `👋 ¡Bienvenido a WhatsOrder!\n\nPuedes hacer tu pedido de forma natural:\n\n"Quiero 2 litros de leche, 1 pan y 3 manzanas"\n\nComandos disponibles:\n/help - Ver ayuda\n/status - Ver estado de tus pedidos\n/cancel - Cancelar pedido en curso`
  }

  private getHelpMessage(): string {
    return `📖 Ayuda de WhatsOrder:\n\n📝 Para hacer un pedido, escribe los productos que deseas:\n"Quiero 2 leches, 1 pan y 3 manzanas"\n\n📌 Luego te pediré la dirección de entrega.\n\n📋 Comandos:\n/start - Iniciar el bot\n/status - Ver estado de tus pedidos\n/cancel - Cancelar pedido en curso\n/help - Ver esta ayuda`
  }
}

export const chatbotService = new ChatbotService()