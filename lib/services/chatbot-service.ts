import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'
import { ERPAdapter } from '@/lib/adapters/erp-adapter'
import { GeminiAdapter } from '@/lib/adapters/gemini-adapter'
import { createClient } from '@/lib/supabase/server'

export interface Session {
  userId: string
  state: 'idle' | 'awaiting_order' | 'awaiting_address' | 'awaiting_confirmation' | 'awaiting_correction' | 'awaiting_name'
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
      return 'Pedido cancelado. Puedes comenzar de nuevo cuando quieras con /start'
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
      
      case 'awaiting_name':
        return await this.handleNameState(userId, message)
      
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
        session.customerName = interpreted.customerName || undefined
        session.rawMessage = message
        
        // Validar productos contra el ERP
        const validation = await this.erp.validateCart(session.cart.map(item => ({
          id: item.id,
          quantity: item.quantity
        })))

        if (!validation.valid) {
          let errorMessage = 'Algunos productos no estan disponibles:\n\n'
          
          if (validation.invalidItems.length > 0) {
            errorMessage += 'Productos no encontrados:\n'
            validation.invalidItems.forEach(item => {
              errorMessage += `  - ${item.id}`
              if (item.suggestions && item.suggestions.length > 0) {
                errorMessage += ` (Quizas quisiste decir: ${item.suggestions.join(', ')})`
              }
              errorMessage += '\n'
            })
            errorMessage += '\n'
          }

          if (validation.stockIssues.length > 0) {
            errorMessage += 'Problemas de stock:\n'
            validation.stockIssues.forEach(item => {
              const product = validation.products.find(p => p.id === item.id)
              errorMessage += `  - ${product?.name || item.id}: solicitaste ${item.requested}, disponible ${item.available}\n`
            })
            errorMessage += '\n'
          }

          errorMessage += 'Por favor, corrige tu pedido y vuelve a intentarlo.'
          return errorMessage
        }

        // Si pasa la validación, actualizar el carrito con IDs reales y precios
        session.cart = validation.products.map(p => ({
          id: p.id,
          quantity: session.cart.find(item => 
            this.erp.findProduct(item.id).then(result => result?.id === p.id)
          )?.quantity || 1,
          price: p.price
        }))

        // Si ya tiene nombre, pasar a confirmación; si no, preguntar nombre
        if (session.customerName) {
          session.state = 'awaiting_confirmation'
          this.updateSession(userId, session)
          return this.buildConfirmationMessage(session)
        } else {
          session.state = 'awaiting_name'
          this.updateSession(userId, session)
          return this.buildProductListMessage(session) + '\n\nCual es tu nombre?'
        }
      }
      
      return 'No pude identificar productos en tu mensaje. Por favor, intenta con un formato como:\n\n"Quiero 2 leches, 1 pan y 3 manzanas"\n\nO escribe /help para mas ayuda.'
    } catch (error) {
      console.error('Error en handleIdleState:', error)
      return 'Ocurrio un error procesando tu mensaje. Por favor, intenta de nuevo.'
    }
  }

  private async handleOrderState(userId: string, message: string): Promise<string> {
    return this.handleIdleState(userId, message)
  }

  private async handleNameState(userId: string, message: string): Promise<string> {
    const session = this.getSession(userId)
    const name = message.trim()
    
    if (name.length < 2) {
      return 'Por favor, ingresa un nombre valido (minimo 2 caracteres).'
    }
    
    session.customerName = name
    session.state = 'awaiting_confirmation'
    this.updateSession(userId, session)
    
    return this.buildConfirmationMessage(session)
  }

  private async handleAddressState(userId: string, message: string): Promise<string> {
    const session = this.getSession(userId)
    session.address = message
    session.state = 'awaiting_confirmation'
    this.updateSession(userId, session)
    
    return this.buildConfirmationMessage(session)
  }

  private async handleConfirmationState(userId: string, message: string): Promise<string> {
    const lowerMsg = message.toLowerCase().trim()
    const session = this.getSession(userId)
    
    if (lowerMsg === 'si' || lowerMsg === 'sí' || lowerMsg === 'confirmar') {
      if (!session.customerName) {
        session.state = 'awaiting_name'
        this.updateSession(userId, session)
        return 'Por favor, ingresa tu nombre para continuar.'
      }
      if (!session.address) {
        session.state = 'awaiting_address'
        this.updateSession(userId, session)
        return 'Por favor, ingresa tu direccion de entrega para continuar.'
      }
      return await this.confirmOrder(userId)
    }
    
    if (lowerMsg === 'no' || lowerMsg === 'corregir' || lowerMsg === 'modificar') {
      session.state = 'awaiting_correction'
      this.updateSession(userId, session)
      return 'Envia el pedido corregido con el formato:\n\n"Quiero 2 leches, 1 pan y 3 manzanas"\n\nO escribe /cancel para cancelar.'
    }
    
    if (lowerMsg === 'cancelar' || lowerMsg === 'cancel') {
      this.clearSession(userId)
      return 'Pedido cancelado. Puedes comenzar de nuevo con /start'
    }
    
    return 'No entendi tu respuesta. Responde "Si" para confirmar, "No" para corregir, o "Cancelar" para cancelar.'
  }

  private async handleCorrectionState(userId: string, message: string): Promise<string> {
    const session = this.getSession(userId)
    
    try {
      const interpreted = await this.gemini.interpretMessage(message)
      
      if (interpreted.products && interpreted.products.length > 0) {
        const newCart = interpreted.products.map(p => ({
          id: p.id,
          quantity: p.quantity || 1,
          price: p.price || 0
        }))
        
        // Validar productos contra el ERP
        const validation = await this.erp.validateCart(newCart.map(item => ({
          id: item.id,
          quantity: item.quantity
        })))

        if (!validation.valid) {
          let errorMessage = 'Algunos productos no estan disponibles:\n\n'
          
          if (validation.invalidItems.length > 0) {
            errorMessage += 'Productos no encontrados:\n'
            validation.invalidItems.forEach(item => {
              errorMessage += `  - ${item.id}`
              if (item.suggestions && item.suggestions.length > 0) {
                errorMessage += ` (Quizas quisiste decir: ${item.suggestions.join(', ')})`
              }
              errorMessage += '\n'
            })
            errorMessage += '\n'
          }

          if (validation.stockIssues.length > 0) {
            errorMessage += 'Problemas de stock:\n'
            validation.stockIssues.forEach(item => {
              const product = validation.products.find(p => p.id === item.id)
              errorMessage += `  - ${product?.name || item.id}: solicitaste ${item.requested}, disponible ${item.available}\n`
            })
            errorMessage += '\n'
          }

          errorMessage += 'Por favor, corrige tu pedido y vuelve a intentarlo.'
          return errorMessage
        }

        session.cart = validation.products.map(p => ({
          id: p.id,
          quantity: newCart.find(item => 
            this.erp.findProduct(item.id).then(result => result?.id === p.id)
          )?.quantity || 1,
          price: p.price
        }))
        session.customerName = interpreted.customerName || session.customerName || undefined
        session.rawMessage = message
        
        if (!session.customerName) {
          session.state = 'awaiting_name'
          this.updateSession(userId, session)
          return this.buildProductListMessage(session) + '\n\nCual es tu nombre?'
        }
        
        if (!session.address) {
          session.state = 'awaiting_address'
          this.updateSession(userId, session)
          return this.buildProductListMessage(session) + '\n\nPor favor, ingresa tu direccion de entrega.'
        }
        
        session.state = 'awaiting_confirmation'
        this.updateSession(userId, session)
        return this.buildConfirmationMessage(session)
      }
      
      return 'No pude identificar productos en tu mensaje. Intenta con un formato como:\n\n"Quiero 2 leches, 1 pan y 3 manzanas"\n\nO escribe /cancel para cancelar.'
    } catch (error) {
      console.error('Error en handleCorrectionState:', error)
      return 'Ocurrio un error. Por favor, intenta de nuevo o escribe /cancel para reiniciar.'
    }
  }

  private buildProductListMessage(session: Session): string {
    const productList = session.cart
      .map((item, i) => `${i + 1}. ${item.id} — ${item.quantity} unidad(es)`)
      .join('\n')
    
    return `He identificado estos productos:\n\n${productList}`
  }

  private buildConfirmationMessage(session: Session): string {
    const productList = session.cart
      .map((item, i) => `${i + 1}. ${item.id} — ${item.quantity} unidad(es)`)
      .join('\n')
    
    return `Resumen del pedido:\n\n${productList}\n\n👤 Cliente: ${session.customerName || 'No especificado'}\n📍 Direccion: ${session.address || 'No especificada'}\n\nDeseas confirmar el pedido?\n\nResponde "Si" para confirmar, "No" para corregir, o "Cancelar" para cancelar.`
  }

  private async confirmOrder(userId: string): Promise<string> {
    const session = this.getSession(userId)
    
    if (session.cart.length === 0) {
      this.clearSession(userId)
      return 'No hay productos en tu pedido. Comienza de nuevo con /start'
    }
    
    try {
      const total = session.cart.reduce(
        (sum, p) => sum + (p.price || 0) * p.quantity,
        0
      )

      const supabase = await createClient()
      
      const insertData = {
        customer_phone: userId,
        customer_name: session.customerName || null,
        items: session.cart.map(p => ({
          id: p.id,
          quantity: p.quantity,
          price: p.price || 0,
          subtotal: (p.price || 0) * p.quantity
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
      
      return `Pedido #${order.id.slice(0, 8)} confirmado!\n\nProductos:\n${productList}\n\n👤 Cliente: ${session.customerName || 'No especificado'}\n📍 Direccion: ${session.address || 'No especificada'}\n\n💰 Total: $${total.toFixed(2)}\n\nUn agente revisara tu pedido y te notificara cuando sea aprobado.\n\nGracias por tu compra!`
    } catch (error) {
      console.error('Error confirming order:', error)
      this.clearSession(userId)
      return 'Ocurrio un error al procesar tu pedido. Por favor, intenta de nuevo mas tarde.'
    }
  }

  private async getStatusMessage(userId: string): Promise<string> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, status, total, created_at, customer_name')
        .eq('customer_phone', userId)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error
      
      if (!data || data.length === 0) {
        return 'No tienes pedidos registrados.'
      }
      
      let message = 'Tus ultimos pedidos:\n\n'
      
      data.forEach((order: any) => {
        const statusMap: Record<string, string> = {
          pending: 'Pendiente',
          approved: 'Aprobado',
          rejected: 'Rechazado',
          delivered: 'Entregado'
        }
        const date = new Date(order.created_at).toLocaleDateString('es-DO')
        const customerName = order.customer_name || 'Cliente'
        message += `#${order.id.slice(0, 8)} — ${statusMap[order.status] || order.status}\n`
        message += `👤 ${customerName} — $${order.total?.toFixed(2) || '0.00'} — ${date}\n\n`
      })
      
      return message
    } catch {
      return 'No pude obtener el estado de tus pedidos. Por favor, intenta de nuevo.'
    }
  }

  private getWelcomeMessage(): string {
    return 'Bienvenido a WhatsOrder!\n\nPuedes hacer tu pedido de forma natural:\n\n"Quiero 2 litros de leche, 1 pan y 3 manzanas"\n\nTe preguntare tu nombre, direccion y confirmacion antes de procesarlo.\n\nComandos disponibles:\n/help - Ver ayuda\n/status - Ver estado de tus pedidos\n/cancel - Cancelar pedido en curso'
  }

  private getHelpMessage(): string {
    return 'Ayuda de WhatsOrder:\n\nPara hacer un pedido, escribe los productos que deseas:\n"Quiero 2 leches, 1 pan y 3 manzanas"\n\nTe preguntare:\n1. Tu nombre\n2. Direccion de entrega\n3. Confirmacion del pedido\n\nComandos:\n/start - Iniciar el bot\n/status - Ver estado de tus pedidos\n/cancel - Cancelar pedido en curso\n/help - Ver esta ayuda'
  }
}

export const chatbotService = new ChatbotService()