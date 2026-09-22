import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { STUDENT_SESSION_COOKIE_NAME, verifyStudentSessionToken } from "@/modules/student-auth/student-session";

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. Proteksi optimistic area superadmin: /admin/* (Story 5 F3/G-9).
  //    Proxy TIDAK menulis DB (edge runtime) — audit denial lahir dari
  //    requireSuperAdmin() di layout/handler. Validasi role nyata di server.
  if (pathname.startsWith("/admin")) {
    const adminSessionCookie =
      request.cookies.get("better-auth.session_token")?.value ||
      request.cookies.get("__Secure-better-auth.session_token")?.value;

    if (!adminSessionCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // 1. Proteksi rute portal siswa: /siswa/portal/*
  if (pathname.startsWith("/siswa/portal")) {
    const studentCookie = request.cookies.get(STUDENT_SESSION_COOKIE_NAME);

    if (!studentCookie?.value) {
      return NextResponse.redirect(new URL("/portal-siswa", request.url));
    }

    const payload = verifyStudentSessionToken(studentCookie.value);
    if (!payload) {
      const response = NextResponse.redirect(new URL("/portal-siswa", request.url));
      response.cookies.delete(STUDENT_SESSION_COOKIE_NAME);
      return response;
    }
  }

  // 2. Lightweight check for session cookie (Optimistic Check)
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

