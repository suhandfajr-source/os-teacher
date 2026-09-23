import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/auth";

export const STUDENT_SESSION_COOKIE_NAME = "klassa_student_session";
export const DEV_ONLY_STUDENT_SESSION_SECRET =
  "dev-only-student-session-secret-min-32-chars-long-do-not-use-in-production";

/**
 * Dummy Hash untuk perlindungan Timing Attack (B3 & F5).
 * Memiliki parameter scrypt valid (N=16384, r=8, p=1).
 * Dijamin berjalan asinkron ~50ms agar timing seragam saat NIS tidak ditemukan.
 */
export const DUMMY_HASH =
  "scrypt:16384:8:1:0123456789abcdef0123456789abcdef:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface StudentSessionPayload {
  studentId: string;
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  nis: string;
  fullName: string;
  pinUpdatedAt: string | null; // ISO string untuk invalidasi saat PIN di-reset
  issuedAt: number; // timestamp ms
  expiresAt: number; // timestamp ms (sliding 7 hari)
}

/**
 * Resolusi secret sesi siswa.
 * Wajib fail-fast di production jika tidak diset atau kurang dari 32 karakter (B4 & Story 1b parity).
 */
export function getStudentSessionSecret(): string {
  const secret = process.env.STUDENT_SESSION_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (!secret || secret.length < 32) {
      throw new Error(
        "FATAL: STUDENT_SESSION_SECRET must be set and at least 32 characters in production."
      );
    }
    return secret;
  }

  return secret || DEV_ONLY_STUDENT_SESSION_SECRET;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

/**
 * Membuat token sesi bertanda-tangan HMAC-SHA256 (tamper-evident).
 */
export function signStudentSessionToken(
  payload: Omit<StudentSessionPayload, "issuedAt" | "expiresAt">,
  secret?: string
): string {
  const resolvedSecret = secret || getStudentSessionSecret();
  const now = Date.now();

  const fullPayload: StudentSessionPayload = {
    ...payload,
    issuedAt: now,
    expiresAt: now + SEVEN_DAYS_MS,
  };

  const payloadJson = JSON.stringify(fullPayload);
  const encodedPayload = base64UrlEncode(payloadJson);

  const hmac = createHmac("sha256", resolvedSecret);
  hmac.update(encodedPayload);
  const signature = hmac.digest("base64url");

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifikasi integritas token sesi siswa (signature + masa berlaku).
 * Menggunakan crypto.timingSafeEqual untuk mencegah timing attacks pada signature.
 */
export function verifyStudentSessionToken(
  token: string,
  secret?: string
): StudentSessionPayload | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  const resolvedSecret = secret || getStudentSessionSecret();

  try {
    const hmac = createHmac("sha256", resolvedSecret);
    hmac.update(encodedPayload);
    const expectedSignature = hmac.digest("base64url");

    const sigBuf = Buffer.from(signature, "utf8");
    const expectedBuf = Buffer.from(expectedSignature, "utf8");

    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payloadJson = base64UrlDecode(encodedPayload);
    const payload: StudentSessionPayload = JSON.parse(payloadJson);

    // Cek masa berlaku token
    const now = Date.now();
    if (now > payload.expiresAt) {
      return null;
    }

    // Cek absolute maximum lifespan 30 hari
    if (now - payload.issuedAt > THIRTY_DAYS_MS) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

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
  payload: Omit<StudentSessionPayload, "issuedAt" | "expiresAt">
): Promise<string> {
  const token = signStudentSessionToken(payload);

  try {
    const cookieStore = await cookies();
    cookieStore.set(STUDENT_SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(THIRTY_DAYS_MS / 1000), // Max cap 30 hari
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
