import { cookies } from "next/headers";
import { prisma } from "@/lib/auth";
import {
  STUDENT_SESSION_COOKIE_NAME,
  THIRTY_DAYS_MS,
  signStudentSessionToken,
  verifyStudentSessionToken,
} from "./student-session-token";
import type { StudentSessionPayload } from "./student-session-token";

// Preserve the existing API for server callers; the proxy imports the pure module directly.
export {
  STUDENT_SESSION_COOKIE_NAME,
  DEV_ONLY_STUDENT_SESSION_SECRET,
  getStudentSessionSecret,
  signStudentSessionToken,
  verifyStudentSessionToken,
} from "./student-session-token";
export type { StudentSessionPayload } from "./student-session-token";

/**
 * Dummy Hash untuk perlindungan Timing Attack (B3 & F5).
 * Memiliki parameter scrypt valid (N=16384, r=8, p=1).
 * Dijamin berjalan asinkron ~50ms agar timing seragam saat NIS tidak ditemukan.
 */
export const DUMMY_HASH =
  "scrypt:16384:8:1:0123456789abcdef0123456789abcdef:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/**
 * Verifikasi sesi siswa di Server Components / Server Actions / Middleware (F3 & B4).
 * Memvalidasi signature token, memeriksa status aktif di DB, dan memastikan
 * token.pinUpdatedAt masih sinkron dengan student.pinUpdatedAt.
 */
export async function verifyStudentSession(): Promise<StudentSessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(STUDENT_SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return null;
    }

    const payload = verifyStudentSessionToken(sessionCookie.value);
    if (!payload) {
      return null;
    }

    // F3: Verifikasi status siswa dan validasi pinUpdatedAt di database
    const student = await prisma.student.findUnique({
      where: { id: payload.studentId },
      select: {
        id: true,
        status: true,
        accountStatus: true,
        pinUpdatedAt: true,
        school: { select: { deactivatedAt: true } }, // Story 5 F7 — fail-closed sekolah nonaktif
      },
    });

    if (!student) {
      return null;
    }

    // Siswa wajib ACTIVE (glosarium §9.2)
    if (student.status !== "ACTIVE" || student.accountStatus !== "ACTIVE") {
      return null;
    }

    // Story 5 F7: sekolah nonaktif → sesi existing siswa fail-closed seketika
    if (student.school?.deactivatedAt) {
      return null;
    }

    // F3: Jika PIN di-reset oleh guru (pinUpdatedAt berbeda), batalkan sesi seketika
    const dbPinUpdatedIso = student.pinUpdatedAt ? student.pinUpdatedAt.toISOString() : null;
    if (payload.pinUpdatedAt !== dbPinUpdatedIso) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Menulis cookie sesi siswa ke response store (HttpOnly, Secure in prod, SameSite=Lax).
 */
export async function setStudentSessionCookie(
  payload: Omit<StudentSessionPayload, "issuedAt" | "expiresAt">,
  options?: { persistent?: boolean }
): Promise<string> {
  const token = signStudentSessionToken(payload);

  try {
    const cookieStore = await cookies();
    cookieStore.set(STUDENT_SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      // rememberMe = false → cookie sesi (hilang saat browser ditutup);
      // default persisten (max cap 30 hari) menjaga perilaku lama.
      ...(options?.persistent === false ? {} : { maxAge: Math.floor(THIRTY_DAYS_MS / 1000) }),
    });
  } catch {
    // Graceful fallback jika dijalankan di luar Next.js request store (misal test runner)
  }

  return token;
}

/**
 * Menghapus cookie sesi siswa (Logout).
 * Sesi guru Better Auth tetap utuh tanpa terganggu (B4).
 */
export async function clearStudentSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(STUDENT_SESSION_COOKIE_NAME);
  } catch {
    // Graceful fallback jika di luar request context
  }
}

/**
 * Story 6 — Resolusi membership rombel untuk sesi siswa: prioritaskan enrollment
 * pada periode AKTIF (invariant §9.4 maks satu periode aktif per sekolah),
 * fallback row terbaru bila sekolah belum punya periode aktif.
 *
 * Dipakai loginStudent agar sesi pasca-rollover membawa periode baru, bukan
 * sekadar row dengan createdAt terbaru. Pola referensi: getStudentEnrollment
 * (src/modules/approvals/approvals.actions.ts).
 */
export async function resolveStudentSessionMembership(
  studentId: string
): Promise<{ classId: string; academicPeriodId: string } | null> {
  const activePeriodMembership = await prisma.classStudent.findFirst({
    where: { studentId, academicPeriod: { status: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    select: { classId: true, academicPeriodId: true },
  });
  if (activePeriodMembership) return activePeriodMembership;

  return prisma.classStudent.findFirst({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    select: { classId: true, academicPeriodId: true },
  });
}
