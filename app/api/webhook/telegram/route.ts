import { NextRequest, NextResponse } from 'next/server'
import { chatbotService } from '@/lib/services/chatbot-service'
import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'

const telegram = new TelegramAdapter()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('📨 Webhook recibido:', JSON.stringify(body, null, 2))
    
    // Procesar mensaje de texto
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id.toString()
      const text = body.message.text
      
      console.log(`📩 Mensaje de ${chatId}: ${text}`)
      
      // Verificar que la respuesta no está vacía
      const response = await chatbotService.handleMessage(chatId, text)
      console.log(`📤 Respuesta para ${chatId}:`, response)
      
      if (response && response.length > 0) {
        await telegram.sendSimpleMessage(chatId, response)
        console.log(`✅ Mensaje enviado a ${chatId}`)
      } else {
        console.warn(`⚠️ Respuesta vacía para ${chatId}`)
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