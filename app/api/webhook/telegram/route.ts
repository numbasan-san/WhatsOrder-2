import { NextRequest, NextResponse } from 'next/server'
import { chatbotService } from '@/lib/services/chatbot-service'
import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'

const telegram = new TelegramAdapter()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('📨 Webhook recibido')
    
    // Procesar mensaje de texto
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id.toString()
      const text = body.message.text
      
      console.log(`📩 Mensaje de ${chatId}: ${text}`)
      
      // Obtener respuesta del chatbot
      console.log('🔄 Llamando a chatbotService.handleMessage...')
      const response = await chatbotService.handleMessage(chatId, text)
      console.log(`📤 Respuesta obtenida: "${response}"`)
      
      // Verificar que hay respuesta
      if (!response || response.length === 0) {
        console.error('❌ Respuesta vacía del chatbot')
        return NextResponse.json({ error: 'Empty response' }, { status: 500 })
      }
      
      // Enviar respuesta a Telegram
      console.log(`📤 Enviando mensaje a ${chatId}: ${response.substring(0, 50)}...`)
      const sent = await telegram.sendSimpleMessage(chatId, response)
      console.log(`✅ Mensaje enviado: ${sent}`)
      
      if (!sent) {
        console.error('❌ Falló el envío del mensaje a Telegram')
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
      }
      
      return NextResponse.json({ status: 'ok' })
    }
    
    return NextResponse.json({ status: 'no_action' })
  } catch (error) {
    console.error('❌ Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ status: 'webhook_active' })
}