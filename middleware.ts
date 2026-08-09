import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Excluir webhooks, archivos estáticos y la API
  const path = request.nextUrl.pathname;
  
  // Permitir acceso a todas las rutas sin restricciones
  // (puedes agregar autenticación aquí después)
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhook).*)',
  ],
};