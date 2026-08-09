import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Refreshes the Supabase session cookie on every matched request and
// redirects unauthenticated users away from /dashboard to /login.
// The matcher below already excludes /api/webhook and static assets,
// so the webhook stays completely un-gated.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhook).*)',
  ],
};