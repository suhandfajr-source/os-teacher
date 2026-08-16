import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Lightweight check for session cookie (Optimistic Check)
  // Better Auth stores session in cookie. The actual validation is done in Server Components.
  const sessionCookie = request.cookies.get("better-auth.session_token")?.value || 
                        request.cookies.get("__Secure-better-auth.session_token")?.value;

  // Protect dashboard routes
  if (!sessionCookie && (pathname === '/' || pathname.startsWith('/pengaturan') || pathname.startsWith('/onboarding'))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // We do NOT redirect from /login or /register here to avoid stale-cookie loops.
  // Real validation happens server-side in layout/page components.
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
