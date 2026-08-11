import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chatId, text } = body;

    console.log('📤 Enviando mensaje a Telegram:', { chatId, textLength: text?.length });

    if (!chatId || !text) {
      return NextResponse.json(
        { error: 'chatId y text son requeridos' },
        { status: 400 }
      );
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('❌ TELEGRAM_BOT_TOKEN no configurado');
      return NextResponse.json(
        { error: 'Bot token no configurado' },
        { status: 500 }
      );
    }

    // Formatear el chatId si es necesario
    let formattedChatId = chatId;
    // Si el chatId es un número de teléfono (10+ dígitos), lo formateamos
    if (/^\d{10,}$/.test(chatId)) {
      // Para números de teléfono, Telegram espera el formato con el código de país
      if (!chatId.startsWith('1') && chatId.length === 10) {
        formattedChatId = `1${chatId}`;
      }
    }

    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    console.log('📡 Llamando a Telegram API...');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: formattedChatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const responseData = await response.json();
    console.log('📩 Respuesta de Telegram:', responseData);

    if (!response.ok) {
      console.error('❌ Error de Telegram:', responseData);
      return NextResponse.json(
        { error: responseData.description || 'Error enviando mensaje' },
        { status: response.status }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: responseData 
    });
  } catch (error) {
    console.error('❌ Error en API de Telegram:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET para verificar que la ruta existe
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Telegram notify API is working',
    botTokenConfigured: !!process.env.TELEGRAM_BOT_TOKEN
  });
}