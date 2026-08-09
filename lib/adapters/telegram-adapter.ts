import { ExternalServiceAdapter, PedidoData, PedidoResponse } from './interfaces'

export class TelegramAdapter implements ExternalServiceAdapter {
  private apiUrl: string
  private botToken: string

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || ''
    this.apiUrl = process.env.TELEGRAM_BOT_API_URL || `https://api.telegram.org/bot${this.botToken}`
  }

  async send(data: PedidoData): Promise<PedidoResponse> {
    try {
      const chatId = this.formatPhoneToTelegramId(data.customerPhone)
      
      const response = await fetch(
        `${this.apiUrl}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: this.buildOrderMessage(data),
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Confirmar Pedido',
                    callback_data: `confirm_${data.orderId || 'temp'}`
                  },
                  {
                    text: 'Cancelar',
                    callback_data: `cancel_${data.orderId || 'temp'}`
                  }
                ],
                [
                  {
                    text: 'Contactar Soporte',
                    callback_data: 'contact_support'
                  }
                ]
              ]
            }
          })
        }
      )

      if (!response.ok) {
        const error = await response.text()
        return { 
          success: false, 
          error: `Telegram API Error: ${error}` 
        }
      }

      const result = await response.json()
      
      return {
        success: true,
        orderId: result.result?.message_id?.toString(),
        message: 'Pedido enviado por Telegram'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
    }
  }

  private buildOrderMessage(data: PedidoData): string {
    const productList = data.products
      .map((p, i) => `${i + 1}. <b>${p.id}</b> — ${p.quantity} unidad(es)`)
      .join('\n')

    const total = data.products.reduce(
      (sum, p) => sum + (p.price || 0) * p.quantity,
      0
    )

    return `
🛒 <b>¡Nuevo Pedido!</b>

📦 <b>Productos:</b>
${productList}

${total > 0 ? `💰 <b>Total:</b> $${total.toFixed(2)}` : ''}

📍 <b>Dirección de entrega:</b>
${data.deliveryAddress || 'Por confirmar'}

${data.notes ? `📝 <b>Notas:</b>\n${data.notes}` : ''}

⏱ <i>Por favor confirma tu pedido usando los botones abajo</i>
    `.trim()
  }

  private formatPhoneToTelegramId(phone: string): string {
    let clean = phone.replace(/\D/g, '')
    
    if (clean.startsWith('0')) {
      clean = clean.substring(1)
    }
    
    if (!clean.startsWith('1') && clean.length === 10) {
      clean = `1${clean}`
    }
    
    return clean
  }

  async getMessageStatus(messageId: string): Promise<{ success: boolean; status: string }> {
    try {
      const response = await fetch(
        `${this.apiUrl}/getMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message_id: parseInt(messageId)
          })
        }
      )

      if (!response.ok) {
        return { success: false, status: 'not_found' }
      }

      const data = await response.json()
      return { 
        success: true, 
        status: data.result?.date ? 'delivered' : 'unknown'
      }
    } catch {
      return { success: false, status: 'error' }
    }
  }

  async queryStock(): Promise<any> {
    throw new Error('Telegram adapter no implementa stock queries')
  }

  async getPrice(): Promise<number> {
    throw new Error('Telegram adapter no implementa price queries')
  }

async sendSimpleMessage(chatId: string, text: string): Promise<boolean> {
  try {
    console.log(`📤 sendSimpleMessage - chatId: ${chatId}`)
    console.log(`📤 sendSimpleMessage - text: ${text.substring(0, 30)}...`)
    console.log(`📤 sendSimpleMessage - token: ${this.botToken.substring(0, 10)}...`)
    console.log(`📤 sendSimpleMessage - apiUrl: ${this.apiUrl}`)
    
    const response = await fetch(
      `${this.apiUrl}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML'
        })
      }
    )
    
    const result = await response.text()
    console.log(`📥 Telegram response: ${result}`)
    
    return response.ok
  } catch (error) {
    console.error('❌ sendSimpleMessage error:', error)
    return false
  }
}

  async sendInlineKeyboard(
    chatId: string,
    text: string,
    buttons: Array<Array<{ text: string; callbackData: string }>>
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.apiUrl}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: buttons.map(row =>
                row.map(btn => ({
                  text: btn.text,
                  callback_data: btn.callbackData
                }))
              )
            }
          })
        }
      )

      return response.ok
    } catch {
      return false
    }
  }
}