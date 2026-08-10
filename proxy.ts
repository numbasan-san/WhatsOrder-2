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

  // Si no está autenticado y no está en ruta pública → redirigir a login
  if (!session && !isPublicRoute) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(url);
  }

  // Si está autenticado y está en login → redirigir a dashboard
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/webhook (webhook endpoints - no autenticación)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/webhook).*)',
  ],
};