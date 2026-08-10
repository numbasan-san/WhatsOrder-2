import { NextRequest, NextResponse } from 'next/server'
import { chatbotService } from '@/lib/services/chatbot-service'
import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'

const telegram = new TelegramAdapter()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Procesar mensaje de texto
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id.toString()
      const text = body.message.text
      
      console.log(`📩 Mensaje de ${chatId}: ${text}`)
      
      // Procesar con el chatbot
      const response = await chatbotService.handleMessage(chatId, text)
      
      // Enviar respuesta
      await telegram.sendSimpleMessage(chatId, response)
      
      return NextResponse.json({ status: 'ok' })
    }
    
    // Procesar callback de botones (fallback)
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

export async function GET() {
  return NextResponse.json({ status: 'webhook_active' })
}

async function handleCallback(callbackData: string, chatId: string, callbackId: string) {
  const parts = callbackData.split('_')
  const action = parts[0]

  if (action === 'confirm') {
    const response = await chatbotService.handleMessage(chatId, 'Sí')
    await telegram.sendSimpleMessage(chatId, response)
    await answerCallback(callbackId, 'Procesando...')
    return
  }

  if (action === 'cancel') {
    const response = await chatbotService.handleMessage(chatId, 'Cancelar')
    await telegram.sendSimpleMessage(chatId, response)
    await answerCallback(callbackId, 'Cancelado')
    return
  }

  if (action === 'contact') {
    await telegram.sendSimpleMessage(
      chatId,
      '📞 Un agente te contactará pronto. Mientras tanto, puedes escribirnos con más detalles.'
    )
    await answerCallback(callbackId, 'Soporte contactado')
    return
  }

  await answerCallback(callbackId, 'Opción no disponible')
}

async function answerCallback(callbackId: string, text: string) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const apiUrl = process.env.TELEGRAM_BOT_API_URL || `https://api.telegram.org/bot${token}`
    
    await fetch(
      `${apiUrl}/answerCallbackQuery`,
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