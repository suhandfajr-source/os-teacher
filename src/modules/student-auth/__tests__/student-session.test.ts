import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @/lib/auth
vi.mock("@/lib/auth", () => ({
  prisma: {
    student: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock next/headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

import { prisma } from "@/lib/auth";
import {
  signStudentSessionToken,
  verifyStudentSessionToken,
  verifyStudentSession,
  setStudentSessionCookie,
  clearStudentSessionCookie,
  STUDENT_SESSION_COOKIE_NAME,
  getStudentSessionSecret,
  DEV_ONLY_STUDENT_SESSION_SECRET,
} from "../student-session";

describe("Student Session Engine (B4 & F3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStudentSessionSecret", () => {
    it("returns dev fallback in development/test", () => {
      delete process.env.STUDENT_SESSION_SECRET;
      const secret = getStudentSessionSecret();
      expect(secret).toBe(DEV_ONLY_STUDENT_SESSION_SECRET);
      expect(secret.length).toBeGreaterThanOrEqual(32);
    });

    it("fails fast in production when secret is absent or shorter than 32 chars", () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.STUDENT_SESSION_SECRET;
      try {
        (process.env as any).NODE_ENV = "production";
        delete process.env.STUDENT_SESSION_SECRET;

        expect(() => getStudentSessionSecret()).toThrow("FATAL: STUDENT_SESSION_SECRET");

        process.env.STUDENT_SESSION_SECRET = "short-secret";
        expect(() => getStudentSessionSecret()).toThrow("FATAL: STUDENT_SESSION_SECRET");

        process.env.STUDENT_SESSION_SECRET = "a-very-secure-production-secret-with-more-than-32-chars";
        expect(getStudentSessionSecret()).toBe(process.env.STUDENT_SESSION_SECRET);
      } finally {
        (process.env as any).NODE_ENV = origEnv;
        process.env.STUDENT_SESSION_SECRET = origSecret;
      }
    });
  });

  describe("signStudentSessionToken & verifyStudentSessionToken", () => {
    const samplePayload = {
      studentId: "std_123",
      schoolId: "sch_456",
      classId: "cls_789",
      academicPeriodId: "prd_101",
      nis: "2024001A",
      fullName: "Ahmad Siswa",
      pinUpdatedAt: new Date("2026-09-21T10:00:00Z").toISOString(),
    };

    it("signs and successfully verifies valid token", () => {
      const token = signStudentSessionToken(samplePayload);
      expect(token).toContain(".");

      const verified = verifyStudentSessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.studentId).toBe("std_123");
      expect(verified?.nis).toBe("2024001A");
      expect(verified?.pinUpdatedAt).toBe(samplePayload.pinUpdatedAt);
      expect(verified?.expiresAt).toBeGreaterThan(Date.now());
    });

    it("rejects token with tampered payload", () => {
      const token = signStudentSessionToken(samplePayload);
      const [payloadPart, sigPart] = token.split(".");

      // Tamper payload
      const tamperedPayload = Buffer.from(
        JSON.stringify({ ...samplePayload, studentId: "std_hacker" })
      ).toString("base64url");

      const tamperedToken = `${tamperedPayload}.${sigPart}`;
      expect(verifyStudentSessionToken(tamperedToken)).toBeNull();
    });

    it("rejects token with tampered signature", () => {
      const token = signStudentSessionToken(samplePayload);
      const [payloadPart] = token.split(".");
      const forgedToken = `${payloadPart}.forgedSignature1234567890`;
      expect(verifyStudentSessionToken(forgedToken)).toBeNull();
    });

    it("rejects token signed with different secret", () => {
      const token = signStudentSessionToken(samplePayload, "different-secret-min-32-chars-long-12345");
      expect(verifyStudentSessionToken(token, "another-secret-min-32-chars-long-67890")).toBeNull();
    });

    it("rejects expired token", () => {
      const token = signStudentSessionToken(samplePayload);
      const [payloadPart, sigPart] = token.split(".");
      const decoded = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));

      // Set expiry to past
      decoded.expiresAt = Date.now() - 1000;
      const expiredEncoded = Buffer.from(JSON.stringify(decoded)).toString("base64url");

      // Re-sign expired payload to simulate genuine expired token
      const hmac = require("node:crypto").createHmac("sha256", DEV_ONLY_STUDENT_SESSION_SECRET);
      hmac.update(expiredEncoded);
      const expiredSignature = hmac.digest("base64url");

      const expiredToken = `${expiredEncoded}.${expiredSignature}`;
      expect(verifyStudentSessionToken(expiredToken)).toBeNull();
    });
  });

  describe("verifyStudentSession (DB binding & F3 pinUpdatedAt invalidation)", () => {
    const pinUpdatedDate = new Date("2026-09-21T10:00:00Z");
    const samplePayload = {
      studentId: "std_123",
      schoolId: "sch_456",
      classId: "cls_789",
      academicPeriodId: "prd_101",
      nis: "2024001A",
      fullName: "Ahmad Siswa",
      pinUpdatedAt: pinUpdatedDate.toISOString(),
    };

    it("returns payload when token is valid and DB student is ACTIVE with matching pinUpdatedAt", async () => {
      const token = signStudentSessionToken(samplePayload);
      mockCookieStore.get.mockReturnValue({ value: token });

      (prisma.student.findUnique as any).mockResolvedValue({
        id: "std_123",
        status: "ACTIVE",
        accountStatus: "ACTIVE",
        pinUpdatedAt: pinUpdatedDate,
      });

      const session = await verifyStudentSession();
      expect(session).not.toBeNull();
      expect(session?.studentId).toBe("std_123");
    });

    it("F3: rejects session if teacher reset PIN in DB (pinUpdatedAt differs)", async () => {
      const token = signStudentSessionToken(samplePayload);
      mockCookieStore.get.mockReturnValue({ value: token });

      // Teacher reset PIN 10 minutes later:
      (prisma.student.findUnique as any).mockResolvedValue({
        id: "std_123",
        status: "ACTIVE",
        accountStatus: "ACTIVE",
        pinUpdatedAt: new Date("2026-09-21T10:10:00Z"), // Different timestamp!
      });

      const session = await verifyStudentSession();
      expect(session).toBeNull(); // Session immediately invalidated!
    });

    it("rejects session if student accountStatus is PENDING or REJECTED", async () => {
      const token = signStudentSessionToken(samplePayload);
      mockCookieStore.get.mockReturnValue({ value: token });

      (prisma.student.findUnique as any).mockResolvedValue({
        id: "std_123",
        status: "ACTIVE",
        accountStatus: "PENDING",
        pinUpdatedAt: pinUpdatedDate,
      });

      expect(await verifyStudentSession()).toBeNull();

      (prisma.student.findUnique as any).mockResolvedValue({
        id: "std_123",
        status: "ACTIVE",
        accountStatus: "REJECTED",
        pinUpdatedAt: pinUpdatedDate,
      });

      expect(await verifyStudentSession()).toBeNull();
    });

    it("rejects session if student is ARCHIVED", async () => {
      const token = signStudentSessionToken(samplePayload);
      mockCookieStore.get.mockReturnValue({ value: token });

      (prisma.student.findUnique as any).mockResolvedValue({
        id: "std_123",
        status: "ARCHIVED",
        accountStatus: "ACTIVE",
        pinUpdatedAt: pinUpdatedDate,
      });

      expect(await verifyStudentSession()).toBeNull();
    });

    it("returns null if session cookie is absent", async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      expect(await verifyStudentSession()).toBeNull();
    });
  });

  describe("Cookie Helpers (setStudentSessionCookie & clearStudentSessionCookie)", () => {
    it("sets session cookie with proper security attributes", async () => {
      const payload = {
        studentId: "std_123",
        schoolId: "sch_456",
        classId: "cls_789",
        academicPeriodId: "prd_101",
        nis: "2024001A",
        fullName: "Ahmad Siswa",
        pinUpdatedAt: null,
      };

      await setStudentSessionCookie(payload);

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        STUDENT_SESSION_COOKIE_NAME,
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        })
      );
    });

    it("clears session cookie on logout", async () => {
      await clearStudentSessionCookie();
      expect(mockCookieStore.delete).toHaveBeenCalledWith(STUDENT_SESSION_COOKIE_NAME);
    });
  });
});
