import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { OrderService, type DraftResult } from '@/lib/services/order-service'
import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'
import { alreadyProcessed, markProcessed } from '@/lib/telegram/idempotency'
import { checkAndConsumeRate } from '@/lib/telegram/rate-limit'
import { getConversation } from '@/lib/telegram/conversation'

const WELCOME_MESSAGE = [
  '👋 ¡Bienvenido a WhatsOrder!',
  '',
  'Envía tu pedido con el formato:',
  '"Quiero 2 leches, 1 pan, 3 manzanas, para la Calle Duarte 10"',
  '',
  '📍 No olvides incluir tu dirección para el delivery.',
].join('\n')

const NO_ITEMS_MESSAGE =
  'No pude identificar productos en tu mensaje. Por favor, intenta de nuevo con un formato claro.\n\n' +
  'Ejemplo: "Quiero 2 litros de leche, 1 pan y 3 manzanas"'

const NEED_ADDRESS_MESSAGE = '📍 ¿A qué dirección lo enviamos?'

const SUPPORT_MESSAGE =
  '📞 Un agente te contactará pronto.\n\nMientras tanto, puedes escribirnos con más detalles de tu consulta.'

const AI_BUSY_MESSAGE =
  'El servicio de IA está experimentando alta demanda. Por favor, espera unos segundos y vuelve a intentar.'

const GENERIC_ERROR_MESSAGE = 'Ocurrió un error procesando tu pedido. Por favor, intenta de nuevo más tarde.'

function unmatchedSuffix(unmatched?: string[]): string {
  if (!unmatched || unmatched.length === 0) return ''
  return `\n\n⚠️ No identifiqué: ${unmatched.join(', ')}`
}

async function sendDraftResult(telegram: TelegramAdapter, chatId: string, res: DraftResult): Promise<void> {
  if (res.status === 'no_items') {
    await telegram.sendSimpleMessage(chatId, NO_ITEMS_MESSAGE + unmatchedSuffix(res.unmatched))
    return
  }

  if (res.status === 'need_address') {
    await telegram.sendSimpleMessage(chatId, NEED_ADDRESS_MESSAGE + unmatchedSuffix(res.unmatched))
    return
  }

  // status === 'created'
  if (!res.pedidoId || !res.summary) return
  await telegram.sendInlineKeyboard(chatId, res.summary, [
    [
      { text: 'Confirmar Pedido', callbackData: `confirm_${res.pedidoId}` },
      { text: 'Cancelar', callbackData: `cancel_${res.pedidoId}` },
    ],
    [{ text: 'Contactar Soporte', callbackData: 'contact_support' }],
  ])
  if (res.unmatched && res.unmatched.length > 0) {
    await telegram.sendSimpleMessage(chatId, `⚠️ No identifiqué: ${res.unmatched.join(', ')}`)
  }
}

export async function POST(req: NextRequest) {
  const telegram = new TelegramAdapter()

  try {
    const body = await req.json()
    const updateId: number | undefined = body.update_id
    const supabase = createServiceClient()

    if (updateId != null) {
      if (await alreadyProcessed(supabase, updateId)) {
        return NextResponse.json({ status: 'duplicate' })
      }
      await markProcessed(supabase, updateId)
    }

    const orderService = new OrderService(supabase)

    if (body.message?.text) {
      const chatId = String(body.message.chat.id)
      const text: string = body.message.text

      if (text.startsWith('/start')) {
        await telegram.sendSimpleMessage(chatId, WELCOME_MESSAGE)
        return NextResponse.json({ status: 'ok' })
      }

      const rate = await checkAndConsumeRate(supabase, chatId)
      if (!rate.allowed) {
        await telegram.sendSimpleMessage(
          chatId,
          `⏳ Has alcanzado el límite de pedidos. Espera ${rate.retryAfterSec} segundos antes de intentar de nuevo.`,
        )
        return NextResponse.json({ status: 'rate_limited' })
      }

      try {
        const conv = await getConversation(supabase, chatId)
        const res =
          conv?.state === 'awaiting_address'
            ? await orderService.completeDraftWithAddress(chatId, text)
            : await orderService.createDraftFromMessage(chatId, text)

        await sendDraftResult(telegram, chatId, res)
        return NextResponse.json({ status: 'processed', result: res.status })
      } catch (error) {
        console.error('Webhook order-processing error:', error)
        const message = error instanceof Error ? error.message : String(error)
        await telegram.sendSimpleMessage(chatId, message.includes('429') ? AI_BUSY_MESSAGE : GENERIC_ERROR_MESSAGE)
        return NextResponse.json({ status: 'error' })
      }
    }

    if (body.callback_query) {
      const cb = body.callback_query
      const chatId = String(cb.message.chat.id)
      const data: string = cb.data ?? ''
      const parts = data.split('_')
      const action = parts[0]
      const id = parts.slice(1).join('_')

      try {
        if (action === 'confirm' && id) {
          await orderService.confirmOrder(id)
          await telegram.sendSimpleMessage(chatId, '✅ Pedido en revisión. Te notificaremos cuando sea aprobado.')
          await telegram.answerCallbackQuery(cb.id, 'Confirmado')
        } else if (action === 'cancel' && id) {
          await orderService.cancelOrder(id)
          await telegram.sendSimpleMessage(chatId, '❌ Pedido cancelado. Si fue un error, puedes hacer un nuevo pedido.')
          await telegram.answerCallbackQuery(cb.id, 'Cancelado')
        } else if (action === 'contact') {
          await telegram.sendSimpleMessage(chatId, SUPPORT_MESSAGE)
          await telegram.answerCallbackQuery(cb.id, 'Soporte contactado')
        } else {
          await telegram.answerCallbackQuery(cb.id, 'Opción no disponible')
        }
      } catch (error) {
        console.error('Webhook callback-processing error:', error)
        await telegram.sendSimpleMessage(chatId, GENERIC_ERROR_MESSAGE)
        await telegram.answerCallbackQuery(cb.id, 'No se pudo procesar')
      }
      return NextResponse.json({ status: 'ok' })
    }

    return NextResponse.json({ status: 'no_action' })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ status: 'error' })
  }
}

// GET para verificar el webhook (Telegram no requiere verificación como WhatsApp)
export async function GET() {
  return NextResponse.json({ status: 'webhook_active' })
}
