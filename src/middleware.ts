import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { STUDENT_SESSION_COOKIE_NAME, verifyStudentSessionToken } from "@/modules/student-auth/student-session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proteksi rute portal siswa: /siswa/portal/*
  if (pathname.startsWith("/siswa/portal")) {
    const sessionCookie = request.cookies.get(STUDENT_SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      const loginUrl = new URL("/siswa", request.url);
      return NextResponse.redirect(loginUrl);
    }

    const payload = verifyStudentSessionToken(sessionCookie.value);
    if (!payload) {
      const loginUrl = new URL("/siswa", request.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(STUDENT_SESSION_COOKIE_NAME);
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/siswa/portal/:path*"],
};
