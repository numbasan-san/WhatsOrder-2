import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Excluir rutas públicas
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