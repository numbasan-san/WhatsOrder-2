import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { OrderService, OrderTransitionConflictError, type DraftResult } from '@/lib/services/order-service'
import { TelegramAdapter } from '@/lib/adapters/telegram-adapter'
import { claimUpdate } from '@/lib/telegram/idempotency'
import { checkAndConsumeRate } from '@/lib/telegram/rate-limit'
import { getConversation } from '@/lib/telegram/conversation'
import { checkEnvironmentVariables } from '@/lib/env-check'

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

const NEED_NAME_MESSAGE = '👤 ¿A nombre de quién registramos el pedido?'

const NEED_ADDRESS_MESSAGE = '📍 ¿A qué dirección lo enviamos?'

const SUPPORT_MESSAGE =
  '📞 Un agente te contactará pronto.\n\nMientras tanto, puedes escribirnos con más detalles de tu consulta.'

const AI_BUSY_MESSAGE =
  'El servicio de IA está experimentando alta demanda. Por favor, espera unos segundos y vuelve a intentar.'

const GENERIC_ERROR_MESSAGE = 'Ocurrió un error procesando tu pedido. Por favor, intenta de nuevo más tarde.'

// Saludos y palabras de ayuda que no son pedidos. Al recibirlos (sin una
// conversación activa) respondemos con la bienvenida en vez de intentar
// interpretarlos como productos y fallar con "No pude identificar productos".
const GREETING_RE =
  /^\s*(hola|holi|ola|buenas|buenos?\s+d[ií]as|buenas\s+tardes|buenas\s+noches|hey|hi|hello|saludos|qu[eé]\s+tal|men[uú]|ayuda|help|info|empezar|start)[\s!.¡]*$/i

function isGreeting(text: string): boolean {
  return GREETING_RE.test(text)
}

function unmatchedSuffix(unmatched?: string[], suggestions?: Record<string, string[]>): string {
  if (!unmatched || unmatched.length === 0) return ''
  const lines = unmatched.map((u) => {
    const s = suggestions?.[u]
    return s && s.length ? `${u} (¿quisiste decir: ${s.join(', ')}?)` : u
  })
  return `\n\n⚠️ No identifiqué: ${lines.join('; ')}`
}

async function sendDraftResult(telegram: TelegramAdapter, chatId: string, res: DraftResult): Promise<void> {
  if (res.status === 'no_items') {
    await telegram.sendSimpleMessage(chatId, NO_ITEMS_MESSAGE + unmatchedSuffix(res.unmatched, res.suggestions))
    return
  }

  if (res.status === 'need_name') {
    await telegram.sendSimpleMessage(chatId, NEED_NAME_MESSAGE + unmatchedSuffix(res.unmatched, res.suggestions))
    return
  }

  if (res.status === 'need_address') {
    await telegram.sendSimpleMessage(chatId, NEED_ADDRESS_MESSAGE + unmatchedSuffix(res.unmatched, res.suggestions))
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
    await telegram.sendSimpleMessage(chatId, unmatchedSuffix(res.unmatched, res.suggestions).trim())
  }
}

export async function POST(req: NextRequest) {
  try {
    // Fail fast and LOUD on misconfiguration. The specific missing var names go to the
    // server logs only (Vercel Functions logs) -- never to the HTTP response, since this
    // is a public endpoint and leaking which secrets are unset is an info-disclosure risk.
    // Returning 500 (not 200) makes Telegram retry and surfaces the failure in
    // getWebhookInfo, instead of the bot silently swallowing every message.
    const env = checkEnvironmentVariables()
    if (!env.valid) {
      console.error('Telegram webhook misconfigured — missing required env vars:', env.missing.join(', '))
      return NextResponse.json({ status: 'error' }, { status: 500 })
    }

    const expected = process.env.TELEGRAM_WEBHOOK_SECRET
    if (expected && req.headers.get('x-telegram-bot-api-secret-token') !== expected) {
      return NextResponse.json({ status: 'forbidden' }, { status: 401 })
    }

    const telegram = new TelegramAdapter()
    const body = await req.json()
    const updateId: number | undefined = body.update_id
    const supabase = createServiceClient()

    if (updateId != null && !(await claimUpdate(supabase, updateId))) {
      return NextResponse.json({ status: 'duplicate' })
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

        // Sin conversación activa, un saludo/ayuda no es un pedido: responde la bienvenida.
        if (!conv && isGreeting(text)) {
          await telegram.sendSimpleMessage(chatId, WELCOME_MESSAGE)
          return NextResponse.json({ status: 'greeting' })
        }

        const res =
          conv?.state === 'awaiting_name'
            ? await orderService.completeDraftWithName(chatId, text)
            : conv?.state === 'awaiting_address'
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
        if (error instanceof OrderTransitionConflictError) {
          // Lost a race with another concurrent callback (e.g. a double tap) — the
          // pedido was already moved out of the expected status. Harmless no-op:
          // no audit row was written and no duplicate notification was sent.
          console.error('Webhook callback lost a status-transition race (harmless):', error.message)
          await telegram.answerCallbackQuery(cb.id, 'Ya procesado')
        } else {
          console.error('Webhook callback-processing error:', error)
          await telegram.sendSimpleMessage(chatId, GENERIC_ERROR_MESSAGE)
          await telegram.answerCallbackQuery(cb.id, 'No se pudo procesar')
        }
      }
      return NextResponse.json({ status: 'ok' })
    }

    return NextResponse.json({ status: 'no_action' })
  } catch (error) {
    // Unexpected/systemic failure (e.g. a Supabase client that can't init, a thrown
    // adapter). Return 500 -- not 200 -- so Telegram retries and getWebhookInfo shows it,
    // rather than the update being silently dropped. Body stays generic; details are logged.
    console.error('Webhook error:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}

// GET para verificar el webhook (Telegram no requiere verificación como WhatsApp)
export async function GET() {
  return NextResponse.json({ status: 'webhook_active' })
}
