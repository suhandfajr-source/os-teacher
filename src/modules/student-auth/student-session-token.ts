import { createHmac, timingSafeEqual } from "node:crypto";

// Shared by the proxy and server session helpers. Keep this module database-free.
export const STUDENT_SESSION_COOKIE_NAME = "klassa_student_session";
export const DEV_ONLY_STUDENT_SESSION_SECRET =
  "dev-only-student-session-secret-min-32-chars-long-do-not-use-in-production";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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
