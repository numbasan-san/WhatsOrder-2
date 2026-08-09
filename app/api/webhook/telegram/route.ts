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
      
      console.log(`📩 Mensaje de ${chatId}: "${text}"`)
      console.log(`🔄 Llamando a chatbotService.handleMessage...`)
      
      try {
        const response = await chatbotService.handleMessage(chatId, text)
        console.log(`📤 Respuesta del chatbot: "${response}"`)
        
        if (response && response.length > 0) {
          console.log(`📤 Enviando respuesta a ${chatId}...`)
          const sent = await telegram.sendSimpleMessage(chatId, response)
          console.log(`✅ Mensaje enviado: ${sent}`)
        } else {
          console.error('❌ Respuesta vacía del chatbot')
        }
      } catch (error) {
        console.error('❌ Error en chatbotService:', error)
        await telegram.sendSimpleMessage(chatId, '⚠️ Ocurrió un error procesando tu mensaje.')
      }
      
      return NextResponse.json({ status: 'ok' })
    }
    
    if (body.callback_query) {
      console.log('🔄 Callback recibido:', body.callback_query.data)
      const chatId = body.callback_query.message.chat.id.toString()
      const data = body.callback_query.data
      
      await telegram.sendSimpleMessage(chatId, `✅ Recibido: ${data}`)
      
      return NextResponse.json({ status: 'ok' })
    }
    
    console.log('⚠️ Mensaje sin texto o sin estructura esperada')
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