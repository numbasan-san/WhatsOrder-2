import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'
import { orderService } from './order-service'

export interface Session {
  userId: string
  state: 'idle' | 'awaiting_order' | 'awaiting_address' | 'awaiting_confirmation'
  cart: CartItem[]
  customerName?: string
  address?: string
  orderId?: string
  retryCount?: number
}

export interface CartItem {
  id: string
  quantity: number
  price?: number
}

export class ChatbotService {
  private sessions: Map<string, Session> = new Map()
  private telegram: TelegramAdapter
  private rateLimitResetTimes: Map<string, number> = new Map()

  constructor() {
    this.telegram = new TelegramAdapter()
  }

  getSession(userId: string): Session {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        userId,
        state: 'idle',
        cart: [],
        retryCount: 0
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
      cart: [],
      retryCount: 0
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
      return 'Pedido cancelado. Puedes comenzar de nuevo cuando quieras.'
    }

    if (lowerMsg === '/help') {
      return this.getHelpMessage()
    }

    if (lowerMsg === '/status') {
      return await this.getStatusMessage(userId)
    }

    // Verificar si estamos en espera por rate limit
    const resetTime = this.rateLimitResetTimes.get(userId)
    if (resetTime && Date.now() < resetTime) {
      const remainingSeconds = Math.ceil((resetTime - Date.now()) / 1000)
      return `El servicio de IA está sobrecargado. Por favor, espera ${remainingSeconds} segundos antes de intentar de nuevo.`
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
      
      default:
        return 'No entiendo ese comando. Escribe /help para ver las opciones disponibles.'
    }
  }

  private async callGeminiWithRetry(userId: string, message: string) {
    const gemini = (orderService as any).gemini
    const session = this.getSession(userId)
    
    try {
      const result = await gemini.interpretMessage(message)
      // Resetear contador de reintentos en éxito
      session.retryCount = 0
      this.updateSession(userId, session)
      return result
    } catch (error: any) {
      // Si es error 429 (rate limit)
      if (error.message?.includes('429') || error.message?.includes('rate limit') || error.message?.includes('quota')) {
        // Extraer tiempo de espera del mensaje de error si existe
        let waitTime = 60 // por defecto 60 segundos
        const match = error.message.match(/retry in ([\d.]+)s/)
        if (match) {
          waitTime = Math.ceil(parseFloat(match[1])) + 2 // +2 segundos de margen
        }
        
        // Guardar tiempo de reset para este usuario
        this.rateLimitResetTimes.set(userId, Date.now() + (waitTime * 1000))
        
        // Incrementar contador de reintentos
        session.retryCount = (session.retryCount || 0) + 1
        this.updateSession(userId, session)
        
        // Si ya hemos intentado demasiadas veces, sugerir esperar
        if (session.retryCount && session.retryCount > 3) {
          throw new Error(`DEMASIADOS_REINTENTOS: Espera ${waitTime} segundos`)
        }
        
        throw new Error(`RATE_LIMIT: ${waitTime}`)
      }
      throw error
    }
  }

  private async handleIdleState(userId: string, message: string): Promise<string> {
    try {
      const interpreted = await this.callGeminiWithRetry(userId, message)
      
      if (interpreted.products && interpreted.products.length > 0) {
        const session = this.getSession(userId)
        session.cart = interpreted.products.map((p: any) => ({
          id: p.id,
          quantity: p.quantity || 1,
          price: p.price || 0
        }))
        session.customerName = interpreted.customerName || 'Cliente'
        session.state = 'awaiting_address'
        this.updateSession(userId, session)
        
        const productList = interpreted.products
          .map((p: any, i: number) => `${i + 1}. ${p.id} — ${p.quantity || 1} unidad(es)`)
          .join('\n')
        
        return `He identificado estos productos:\n\n${productList}\n\nPor favor, confírmame tu dirección de entrega.`
      }
      
      return 'No pude identificar productos en tu mensaje. Por favor, intenta con un formato como:\n\n"Quiero 2 leches, 1 pan y 3 manzanas"\n\nO escribe /help para más ayuda.'
    } catch (error: any) {
      if (error.message?.includes('RATE_LIMIT') || error.message?.includes('DEMASIADOS_REINTENTOS')) {
        const waitTime = error.message.match(/(\d+)/)?.[1] || '60'
        return `El servicio de IA está experimentando alta demanda. Por favor, espera ${waitTime} segundos y vuelve a intentar con /start.\n\nMientras tanto, puedes usar /status para ver tus pedidos.`
      }
      return 'Ocurrió un error procesando tu mensaje. Por favor, intenta de nuevo más tarde.'
    }
  }

  private async handleOrderState(userId: string, message: string): Promise<string> {
    // Similar a handleIdleState pero con mensaje de "actualizado"
    try {
      const interpreted = await this.callGeminiWithRetry(userId, message)
      const session = this.getSession(userId)
      
      if (interpreted.products && interpreted.products.length > 0) {
        session.cart = interpreted.products.map((p: any) => ({
          id: p.id,
          quantity: p.quantity || 1,
          price: p.price || 0
        }))
        session.customerName = interpreted.customerName || session.customerName || 'Cliente'
        session.state = 'awaiting_address'
        this.updateSession(userId, session)
        
        const productList = interpreted.products
          .map((p: any, i: number) => `${i + 1}. ${p.id} — ${p.quantity || 1} unidad(es)`)
          .join('\n')
        
        return `Productos actualizados:\n\n${productList}\n\nAhora, confírmame tu dirección de entrega.`
      }
      
      return 'No pude identificar productos en tu mensaje. Intenta con un formato como:\n\n"Quiero 2 leches, 1 pan y 3 manzanas"'
    } catch (error: any) {
      if (error.message?.includes('RATE_LIMIT') || error.message?.includes('DEMASIADOS_REINTENTOS')) {
        return 'El servicio de IA está sobrecargado. Espera un minuto y vuelve a intentar.'
      }
      return 'Ocurrió un error. Por favor, intenta de nuevo o escribe /cancel para reiniciar.'
    }
  }

  private async handleAddressState(userId: string, message: string): Promise<string> {
    const session = this.getSession(userId)
    session.address = message
    session.state = 'awaiting_confirmation'
    this.updateSession(userId, session)
    
    const productList = session.cart
      .map((item, i) => `${i + 1}. ${item.id} — ${item.quantity} unidad(es)`)
      .join('\n')
    
    return `Dirección guardada: ${message}\n\nResumen del pedido:\n${productList}\n\n¿Deseas confirmar el pedido?\n\nResponde "Sí" para confirmar, "No" para cancelar, o escribe /cancel para reiniciar.`
  }

  private async handleConfirmationState(userId: string, message: string): Promise<string> {
    const lowerMsg = message.toLowerCase().trim()
    const session = this.getSession(userId)
    
    if (lowerMsg === 'si' || lowerMsg === 'sí' || lowerMsg === 'confirmar') {
      return await this.confirmOrder(userId)
    }
    
    if (lowerMsg === 'no' || lowerMsg === 'cancelar') {
      this.clearSession(userId)
      return 'Pedido cancelado. Puedes comenzar de nuevo cuando quieras.'
    }
    
    return 'No entendí tu respuesta. Responde "Sí" para confirmar o "No" para cancelar.'
  }

  private async confirmOrder(userId: string): Promise<string> {
    const session = this.getSession(userId)
    
    if (session.cart.length === 0) {
      this.clearSession(userId)
      return 'No hay productos en tu pedido. Comienza de nuevo.'
    }
    
    try {
      const result = await orderService.processTelegramOrder(
        `Pedido de ${session.customerName}: ${session.cart.map(i => `${i.id} x${i.quantity}`).join(', ')}`,
        userId
      )
      
      if (result.success) {
        const orderId = result.orderId
        const productList = session.cart
          .map((item, i) => `${i + 1}. ${item.id} — ${item.quantity} unidad(es)`)
          .join('\n')
        
        this.clearSession(userId)
        
        return `¡Pedido #${orderId} confirmado!\n\nProductos:\n${productList}\n\nDirección: ${session.address}\n\nTotal: $${result.total?.toFixed(2) || '0.00'}\n\nUn agente revisará tu pedido y te notificará cuando sea aprobado.`
      }
      
      this.clearSession(userId)
      return 'Ocurrió un error al procesar tu pedido. Por favor, intenta de nuevo más tarde.'
    } catch {
      this.clearSession(userId)
      return 'Ocurrió un error al procesar tu pedido. Por favor, intenta de nuevo más tarde.'
    }
  }

  private async getStatusMessage(userId: string): Promise<string> {
    try {
      const orders = await orderService.getOrdersByCustomer(userId)
      
      if (!orders || orders.length === 0) {
        return 'No tienes pedidos registrados.'
      }
      
      const recentOrders = orders.slice(0, 5)
      let message = 'Tus pedidos recientes:\n\n'
      
      recentOrders.forEach((order: any) => {
        const statusMap: Record<string, string> = {
          pending: 'Pendiente',
          approved: 'Aprobado',
          rejected: 'Rechazado'
        }
        message += `#${order.id.slice(0, 8)} — ${statusMap[order.status] || order.status}\n`
        message += `$${order.total?.toFixed(2) || '0.00'}\n\n`
      })
      
      if (orders.length > 5) {
        message += `Y ${orders.length - 5} pedidos más.`
      }
      
      return message
    } catch {
      return 'No pude obtener el estado de tus pedidos. Por favor, intenta de nuevo.'
    }
  }

  private getWelcomeMessage(): string {
    return `¡Bienvenido a WhatsOrder!\n\nPuedes hacer tu pedido de forma natural:\n\n"Quiero 2 litros de leche, 1 pan y 3 manzanas"\n\nComandos disponibles:\n/help - Ver ayuda\n/status - Ver estado de tus pedidos\n/cancel - Cancelar pedido en curso`
  }

  private getHelpMessage(): string {
    return `Ayuda de WhatsOrder:\n\nPara hacer un pedido, escribe los productos que deseas:\n"Quiero 2 leches, 1 pan y 3 manzanas"\n\nLuego te pediré la dirección de entrega.\n\nComandos:\n/start - Iniciar el bot\n/status - Ver estado de tus pedidos\n/cancel - Cancelar pedido en curso\n/help - Ver esta ayuda`
  }
}

export const chatbotService = new ChatbotService()