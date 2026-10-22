import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEV_ONLY_STUDENT_SESSION_SECRET,
  STUDENT_SESSION_COOKIE_NAME,
  THIRTY_DAYS_MS,
  getStudentSessionSecret,
  signStudentSessionToken,
  verifyStudentSessionToken,
} from "../student-session-token";
import proxy from "@/proxy";

// These imports must never be needed by either the token module or the proxy.
vi.mock("@/lib/auth", () => { throw new Error("Proxy must not initialize auth/database"); });
vi.mock("next/headers", () => { throw new Error("Token verification must not load next/headers"); });
vi.mock("@prisma/client", () => { throw new Error("Proxy must not load Prisma"); });
vi.mock("@prisma/adapter-pg", () => { throw new Error("Proxy must not load PrismaPg"); });
vi.mock("pg", () => { throw new Error("Proxy must not load pg"); });
vi.mock("better-auth", () => { throw new Error("Proxy must not initialize Better Auth"); });

const SECRET = "test-only-student-token-secret-at-least-32-characters";
const NOW = Date.UTC(2026, 9, 22, 12);
const DAY = 24 * 60 * 60 * 1000;
const student = {
  studentId: "student-test",
  schoolId: "school-test",
  classId: "class-test",
  academicPeriodId: "period-test",
  nis: "001",
  fullName: "Test Student",
  pinUpdatedAt: null,
};

// Independent encoder: verifies compatibility with the existing wire format.
function signedPayload(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STUDENT_SESSION_SECRET", SECRET);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("Database-free student token and proxy", () => {
  it("preserves the signed wire format without initializing database/auth dependencies", () => {
    const expected = { ...student, issuedAt: NOW, expiresAt: NOW + 7 * DAY };
    expect(signStudentSessionToken(student)).toBe(signedPayload(expected));
    expect(verifyStudentSessionToken(signedPayload(expected))).toEqual(expected);
  });

  it("rejects a changed payload, same-length signature tampering and a wrong secret", () => {
    const token = signStudentSessionToken(student);
    const [payload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ ...student, studentId: "attacker" })).toString("base64url");
    const tamperedSignature = (signature[0] === "a" ? "b" : "a") + signature.slice(1);
    expect(verifyStudentSessionToken(`${tamperedPayload}.${signature}`)).toBeNull();
    expect(verifyStudentSessionToken(`${payload}.${tamperedSignature}`)).toBeNull();
    expect(verifyStudentSessionToken(token, `${SECRET}-wrong`)).toBeNull();
  });

  it.each(["", "not-a-token", "a.b.c", "a.b"])("rejects malformed token %j", (token) => {
    expect(verifyStudentSessionToken(token)).toBeNull();
  });

  it("keeps the inclusive expiry boundary and rejects one millisecond later", () => {
    const token = signedPayload({ ...student, issuedAt: NOW - DAY, expiresAt: NOW });
    expect(verifyStudentSessionToken(token)).not.toBeNull();
    vi.setSystemTime(NOW + 1);
    expect(verifyStudentSessionToken(token)).toBeNull();
  });

  it("keeps the absolute 30-day boundary even if the signed expiry is in the future", () => {
    const token = signedPayload({ ...student, issuedAt: NOW - THIRTY_DAYS_MS, expiresAt: NOW + DAY });
    expect(verifyStudentSessionToken(token)).not.toBeNull();
    vi.setSystemTime(NOW + 1);
    expect(verifyStudentSessionToken(token)).toBeNull();
  });

  it.each([undefined, "", "too-short"])("fails closed in production with secret %j", (secret) => {
    const token = signStudentSessionToken(student, SECRET);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STUDENT_SESSION_SECRET", secret);
    expect(() => getStudentSessionSecret()).toThrow("FATAL: STUDENT_SESSION_SECRET");
    expect(() => signStudentSessionToken(student)).toThrow("FATAL: STUDENT_SESSION_SECRET");
    expect(() => verifyStudentSessionToken(token)).toThrow("FATAL: STUDENT_SESSION_SECRET");
  });

  it("preserves the development fallback and accepts configured production secrets", () => {
    vi.stubEnv("STUDENT_SESSION_SECRET", undefined);
    expect(getStudentSessionSecret()).toBe(DEV_ONLY_STUDENT_SESSION_SECRET);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STUDENT_SESSION_SECRET", SECRET);
    expect(verifyStudentSessionToken(signStudentSessionToken(student))).not.toBeNull();
  });

  it("allows a signed student cookie through proxy without auth/DB initialization", () => {
    const request = new NextRequest("https://example.test/siswa/portal", {
      headers: { cookie: `${STUDENT_SESSION_COOKIE_NAME}=${signStudentSessionToken(student)}` },
    });
    expect(proxy(request).headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects missing/invalid student sessions and clears an invalid cookie", () => {
    const missing = proxy(new NextRequest("https://example.test/siswa/portal"));
    expect(missing.headers.get("location")).toBe("https://example.test/portal-siswa");
    const invalid = proxy(new NextRequest("https://example.test/siswa/portal", {
      headers: { cookie: `${STUDENT_SESSION_COOKIE_NAME}=invalid` },
    }));
    expect(invalid.headers.get("location")).toBe("https://example.test/portal-siswa");
    expect(invalid.cookies.get(STUDENT_SESSION_COOKIE_NAME)?.value).toBe("");
  });

  it("preserves optimistic teacher/admin checks and leaves login reachable", () => {
    for (const path of ["/", "/admin", "/pengaturan/setup", "/onboarding"]) {
      expect(proxy(new NextRequest(`https://example.test${path}`)).headers.get("location"))
        .toBe("https://example.test/login");
    }
    for (const cookieName of ["better-auth.session_token", "__Secure-better-auth.session_token"]) {
      const request = new NextRequest("https://example.test/admin", {
        headers: { cookie: `${cookieName}=optimistic-cookie` },
      });
      expect(proxy(request).headers.get("x-middleware-next")).toBe("1");
    }
    expect(proxy(new NextRequest("https://example.test/login")).headers.get("x-middleware-next")).toBe("1");
  });
});
