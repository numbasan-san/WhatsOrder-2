import { NextRequest, NextResponse } from 'next/server'
import { chatbotService } from '@/lib/services/chatbot-service'
import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'

const telegram = new TelegramAdapter()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('📨 Webhook recibido')
    console.log('📨 Body completo:', JSON.stringify(body, null, 2))
    
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id.toString()
      const text = body.message.text
      
      console.log(`📩 Mensaje de ${chatId}: ${text}`)
      
      console.log('🔄 Llamando a chatbotService...')
      const response = await chatbotService.handleMessage(chatId, text)
      console.log(`📤 Respuesta del chatbot: "${response}"`)
      console.log(`📤 Longitud de respuesta: ${response?.length || 0}`)
      
      if (!response || response.length === 0) {
        console.error('❌ Respuesta vacía del chatbot')
        // Enviar mensaje de error genérico
        await telegram.sendSimpleMessage(chatId, '⚠️ Ocurrió un error procesando tu mensaje. Por favor, intenta de nuevo.')
        return NextResponse.json({ status: 'error_empty_response' }, { status: 200 })
      }
      
      // Enviar mensaje a Telegram
      console.log(`📤 Enviando a ${chatId}...`)
      const sent = await telegram.sendSimpleMessage(chatId, response)
      console.log(`✅ Mensaje enviado: ${sent}`)
      
      if (!sent) {
        console.error('❌ Falló el envío a Telegram')
        // Intentar enviar un mensaje de error sin parse_mode
        try {
          await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: '⚠️ Error al procesar tu mensaje. Por favor, intenta de nuevo.'
              })
            }
          )
        } catch (e) {
          console.error('❌ Fallback también falló:', e)
        }
        return NextResponse.json({ status: 'error_send_failed' }, { status: 200 })
      }
      
      return NextResponse.json({ status: 'ok' })
    }
    
    console.log('ℹ️ Sin mensaje de texto')
    return NextResponse.json({ status: 'no_action' })
  } catch (error) {
    console.error('❌ Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 200 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ status: 'webhook_active' })
}