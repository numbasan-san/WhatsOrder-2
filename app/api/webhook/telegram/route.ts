import { NextRequest, NextResponse } from 'next/server'
import { chatbotService } from '@/lib/services/chatbot-service'
import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'

const telegram = new TelegramAdapter()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('📨 Webhook recibido')
    
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id.toString()
      const text = body.message.text
      
      console.log(`📩 Mensaje de ${chatId}: ${text}`)
      
      const response = await chatbotService.handleMessage(chatId, text)
      console.log(`📤 Respuesta: ${response?.substring(0, 50)}...`)
      
      if (!response || response.length === 0) {
        console.error('❌ Respuesta vacía')
        return NextResponse.json({ error: 'Empty response' }, { status: 500 })
      }
      
      // Enviar mensaje
      // NOTA: se envía status 200 aún con errores para evitar reintentos
      console.log(`📤 Enviando a ${chatId}...`)
      const sent = await telegram.sendSimpleMessage(chatId, response)
      console.log(`✅ Mensaje enviado: ${sent}`)
      
      if (!sent) {
        console.error('❌ Falló el envío a Telegram')
        return NextResponse.json({ 
          status: 'error', 
          message: 'Failed to send to Telegram' 
        }, { status: 200 })
      }
      
      return NextResponse.json({ status: 'ok' })
    }
    
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