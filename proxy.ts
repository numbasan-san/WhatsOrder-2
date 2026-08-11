import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Excluir webhooks y archivos estáticos
  if (
    pathname.startsWith('/api/webhook') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Crear cliente de Supabase para verificar sesión
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            NextResponse.next().cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // Rutas públicas (no requieren autenticación)
  const publicRoutes = ['/login', '/api/auth'];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Determinar la respuesta
  let response: NextResponse;

  // Si no está autenticado y no está en ruta pública → redirigir a login
  if (!session && !isPublicRoute) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirectedFrom', pathname);
    response = NextResponse.redirect(url);
  }
  // Si está autenticado y está en login → redirigir a dashboard
  else if (session && pathname === '/login') {
    response = NextResponse.redirect(new URL('/dashboard', request.url));
  }
  // Respuesta normal
  else {
    response = NextResponse.next();
  }

  // ============================================
  // HEADERS DE SEGURIDAD MEJORADOS
  // ============================================

  const isProduction = process.env.NODE_ENV === 'production';

  // 1. CSP (Content Security Policy) - CORREGIDO sin wildcards
  // Nota: 'unsafe-inline' y 'unsafe-eval' son necesarios para Next.js en desarrollo
  response.headers.set(
    'Content-Security-Policy',
    `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' 
        https://telegram.org 
        https://*.telegram.org;
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: blob: 
        https://telegram.org 
        https://*.telegram.org 
        https://*.supabase.co;
      font-src 'self' data:;
      connect-src 'self' 
        https://api.telegram.org 
        https://generativelanguage.googleapis.com 
        https://*.supabase.co 
        https://*.supabase.com;
      frame-src 'none';
      worker-src 'self' blob:;
      base-uri 'self';
      form-action 'self';
      object-src 'none';
      upgrade-insecure-requests;
    `.replace(/\s+/g, ' ').trim()
  );

  // 2. HSTS (Forzar HTTPS - solo en producción)
  if (isProduction) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // 3. Prevenir sniffing de MIME types
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // 4. Prevenir clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // 5. Controlar información de referer
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 6. Restringir APIs del navegador
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );

  // 7. Prevenir cacheo de información sensible
  response.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  // 8. Eliminar headers que revelan información del servidor
  response.headers.delete('X-Powered-By');
  response.headers.delete('Server');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhook).*)',
  ],
};