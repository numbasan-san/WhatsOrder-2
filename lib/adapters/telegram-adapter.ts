import { ExternalServiceAdapter, PedidoData, PedidoResponse } from './interfaces'

export class TelegramAdapter implements ExternalServiceAdapter {
  private botToken: string

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || ''
  }

  async sendSimpleMessage(chatId: string, text: string): Promise<boolean> {
    try {
      console.log('📤 Intentando enviar mensaje a Telegram:', { 
        chatId, 
        textLength: text.length 
      });

      // En el servidor, llamar directamente a Telegram
      if (typeof window === 'undefined') {
        return await this.sendDirectMessage(chatId, text);
      }

      // En el cliente, llamar a la API route (ruta correcta)
      const response = await fetch('/api/webhook/telegram/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Error en API route:', errorData);
        return false;
      }

      const data = await response.json();
      console.log('✅ Mensaje enviado correctamente:', data);
      return true;
    } catch (error) {
      console.error('❌ Error en sendSimpleMessage:', error);
      return false;
    }
  }

  private async sendDirectMessage(chatId: string, text: string): Promise<boolean> {
    try {
      if (!this.botToken) {
        console.error('❌ TELEGRAM_BOT_TOKEN no configurado');
        return false;
      }

      // Formatear el chatId si es necesario
      let formattedChatId = chatId;
      if (/^\d{10,}$/.test(chatId)) {
        if (!chatId.startsWith('1') && chatId.length === 10) {
          formattedChatId = `1${chatId}`;
        }
      }

      const apiUrl = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

      console.log('📡 Llamando a Telegram API (servidor)...');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: formattedChatId,
          text: text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('❌ Error de Telegram:', responseData);
        return false;
      }

      console.log('✅ Mensaje enviado correctamente a Telegram');
      return true;
    } catch (error) {
      console.error('❌ Error en sendDirectMessage:', error);
      return false;
    }
  }

  async send(data: PedidoData): Promise<PedidoResponse> {
    try {
      const chatId = this.formatPhoneToTelegramId(data.customerPhone);
      
      // Incluir el ID del pedido en el mensaje
      const orderId = data.orderId || `ORD-${Date.now()}`;
      const shortId = orderId.slice(0, 8);
      
      const message = this.buildOrderMessage(data, shortId);
      
      const success = await this.sendSimpleMessage(chatId, message);
      
      if (!success) {
        return {
          success: false,
          error: 'Error enviando mensaje de Telegram'
        };
      }

      return {
        success: true,
        orderId: orderId,
        message: 'Pedido enviado por Telegram'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  private buildOrderMessage(data: PedidoData, orderId: string): string {
    const productList = data.products
      .map((p, i) => `${i + 1}. <b>${p.id}</b> — ${p.quantity} unidad(es)`)
      .join('\n');

    const total = data.products.reduce(
      (sum, p) => sum + (p.price || 0) * p.quantity,
      0
    );

    return `
  🛒 <b>¡Nuevo Pedido!</b>
  📋 <b>ID:</b> #${orderId}

  📦 <b>Productos:</b>
  ${productList}

  ${total > 0 ? `💰 <b>Total:</b> $${total.toFixed(2)}` : ''}

  📍 <b>Dirección de entrega:</b>
  ${data.deliveryAddress || 'Por confirmar'}

  ${data.notes ? `📝 <b>Notas:</b>\n${data.notes}` : ''}

  ⏱ <i>Por favor confirma tu pedido usando los botones abajo</i>
    `.trim();
  }

  private formatPhoneToTelegramId(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    
    if (clean.startsWith('0')) {
      clean = clean.substring(1);
    }
    
    if (!clean.startsWith('1') && clean.length === 10) {
      clean = `1${clean}`;
    }
    
    return clean;
  }

  async queryStock(): Promise<any> {
    throw new Error('Telegram adapter no implementa stock queries');
  }

  async getPrice(): Promise<number> {
    throw new Error('Telegram adapter no implementa price queries');
  }

  async sendInlineKeyboard(
    chatId: string,
    text: string,
    buttons: Array<Array<{ text: string; callbackData: string }>>
  ): Promise<boolean> {
    try {
      // En cliente, usar API route
      if (typeof window !== 'undefined') {
        const response = await fetch('/api/webhook/telegram/notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            chatId, 
            text,
            buttons 
          }),
        });
        return response.ok;
      }

      // En servidor, llamar directamente
      if (!this.botToken) return false;

      const apiUrl = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const response = await fetch(apiUrl, {
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
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}