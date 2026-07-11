import { NextRequest, NextResponse } from 'next/server'
import { orderService } from '@/lib/services/order-service'
import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'

const telegram = new TelegramAdapter()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Procesar mensaje de texto
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id.toString()
      const text = body.message.text

      // Comandos especiales
      if (text.startsWith('/start')) {
        await telegram.sendSimpleMessage(
          chatId,
          '👋 ¡Bienvenido a WhatsOrder!\n\n' +
          'Envía tu pedido con el formato:\n' +
          '"Quiero 2 leches, 1 pan, 3 manzanas"\n\n' +
          '📍 No olvides incluir tu dirección para el delivery.'
        )
        return NextResponse.json({ status: 'ok' })
      }

      if (text.startsWith('/status') && body.message.reply_to_message) {
        // Consultar estado de pedido
        const repliedMsg = body.message.reply_to_message
        if (repliedMsg?.text?.includes('Pedido')) {
          await telegram.sendSimpleMessage(
            chatId,
            '📊 Tu pedido está en proceso de revisión.\n' +
            'Te notificaremos cuando sea aprobado.'
          )
        }
        return NextResponse.json({ status: 'ok' })
      }

      // Procesar pedido normal
      const result = await orderService.processTelegramOrder(text, chatId)
      
      return NextResponse.json({ status: 'processed', result })
    }

    // Procesar callback de botones
    if (body.callback_query) {
      const callback = body.callback_query
      const chatId = callback.message.chat.id.toString()
      const data = callback.data
      
      await handleCallback(data, chatId, callback.id)
      
      return NextResponse.json({ status: 'ok' })
    }

    return NextResponse.json({ status: 'no_action' })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET para verificar el webhook (Telegram no requiere verificación como WhatsApp)
export async function GET() {
  return NextResponse.json({ status: 'webhook_active' })
}

// Manejar callbacks de botones inline
async function handleCallback(callbackData: string, chatId: string, callbackId: string) {
  const parts = callbackData.split('_')
  const action = parts[0]
  const orderId = parts[1]

  // Confirmar pedido
  if (action === 'confirm' && orderId) {
    // Buscar el pedido en la BD y aprobarlo
    const result = await orderService.approveOrder(orderId, 'telegram_bot')
    
    if (result) {
      await telegram.sendSimpleMessage(
        chatId,
        `✅ ¡Pedido #${orderId} confirmado! \n\n📦 Prepara tu pedido, estará en camino pronto.`
      )
    } else {
      await telegram.sendSimpleMessage(
        chatId,
        `❌ No pude confirmar el pedido #${orderId}. Por favor, contacta a soporte.`
      )
    }
    
    await answerCallback(callbackId, 'Pedido confirmado ✅')
    return
  }

  // Cancelar pedido
  if (action === 'cancel' && orderId) {
    await orderService.rejectOrder(orderId, 'telegram_bot', 'Cancelado por el cliente')
    
    await telegram.sendSimpleMessage(
      chatId,
      `❌ Pedido #${orderId} cancelado.\n\nSi fue un error, puedes hacer un nuevo pedido.`
    )
    
    await answerCallback(callbackId, 'Pedido cancelado ❌')
    return
  }

  // Contactar soporte
  if (action === 'contact') {
    await telegram.sendSimpleMessage(
      chatId,
      '📞 Un agente te contactará pronto.\n\n' +
      'Mientras tanto, puedes escribirnos con más detalles de tu consulta.'
    )
    
    await answerCallback(callbackId, 'Soporte contactado 📞')
    return
  }

  // Respuesta por defecto
  await answerCallback(callbackId, 'Opción no disponible')
}

// Responder a los callbacks (requerido por Telegram)
async function answerCallback(callbackId: string, text: string) {
  try {
    await fetch(
      `${process.env.TELEGRAM_BOT_API_URL}/answerCallbackQuery`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackId,
          text: text,
          show_alert: false
        })
      }
    )
  } catch (error) {
    console.error('Error answering callback:', error)
  }
}