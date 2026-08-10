import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Excluir webhooks y archivos estáticos
  const path = request.nextUrl.pathname;
  
  if (
    path.startsWith('/api/webhook') ||
    path.startsWith('/_next') ||
    path.includes('.')
  ) {
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhook).*)',
  ],
};