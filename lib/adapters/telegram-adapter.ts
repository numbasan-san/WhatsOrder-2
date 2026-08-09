export class TelegramAdapter {
  private apiUrl: string
  private botToken: string

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || ''
    this.apiUrl = process.env.TELEGRAM_BOT_API_URL || `https://api.telegram.org/bot${this.botToken}`
  }

  async sendSimpleMessage(chatId: string, text: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.apiUrl}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
          })
        }
      )

      return response.ok
    } catch {
      return false
    }
  }

  async sendInlineKeyboard(
    chatId: string,
    text: string,
    buttons: Array<Array<{ text: string; callbackData: string }>>
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.apiUrl}/sendMessage`,
        {
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
        }
      )

      return response.ok
    } catch {
      return false
    }
  }

  async answerCallbackQuery(callbackId: string, text: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.apiUrl}/answerCallbackQuery`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            callback_query_id: callbackId,
            text,
            show_alert: false
          })
        }
      )

      return response.ok
    } catch {
      return false
    }
  }
}
