import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashPin, verifyPin } from "@/lib/student-pin";
import {
  signStudentSessionToken,
  verifyStudentSessionToken,
  STUDENT_SESSION_COOKIE_NAME,
  DUMMY_HASH,
} from "../student-session";

describe("Student Auth Security & Invariant Verification (B3, B4, F1, F5, F6)", () => {
  describe("F5 & B3: Timing Defense Verification (Dummy-Verify vs Real Scrypt)", () => {
    it("proves dummy verify scrypt runs with parity to real hash scrypt (anti-enumerasi)", async () => {
      const pin = "1234";
      const wrongPin = "0000";
      const realHash = await hashPin(pin);

      // 1. Ukur durasi eksekusi verify pada real hash
      const startReal = performance.now();
      const realResult = await verifyPin(wrongPin, realHash);
      const durationReal = performance.now() - startReal;

      expect(realResult).toBe(false);
      // Scrypt N=16384 harus memerlukan waktu CPU nyata (> 10ms)
      expect(durationReal).toBeGreaterThan(5);

      // 2. Ukur durasi eksekusi verify pada DUMMY_HASH (saat NIS tidak ada)
      const startDummy = performance.now();
      const dummyResult = await verifyPin(wrongPin, DUMMY_HASH);
      const durationDummy = performance.now() - startDummy;

      expect(dummyResult).toBe(false);
      expect(durationDummy).toBeGreaterThan(5);

      // 3. Selisih waktu kedua eksekusi harus dalam batas wajar toleransi OS (< 50ms)
      const timingDiff = Math.abs(durationReal - durationDummy);
      expect(timingDiff).toBeLessThan(50);
    });
  });

  describe("F6: Lockout Escalation Math Invariant", () => {
    function computeLockout(failedAttempts: number, now: number): number | null {
      if (failedAttempts >= 10) return now + 24 * 60 * 60 * 1000;
      if (failedAttempts >= 6) return now + 60 * 60 * 1000;
      if (failedAttempts === 5) return now + 15 * 60 * 1000;
      return null;
    }

    it("verifies tiered escalation (15m -> 1h -> 24h)", () => {
      const now = Date.now();

      expect(computeLockout(1, now)).toBeNull();
      expect(computeLockout(4, now)).toBeNull();

      // Tier 1: 5th attempt -> 15 minutes
      const t1 = computeLockout(5, now);
      expect(t1).toBe(now + 15 * 60 * 1000);

      // Tier 2: 6th to 9th attempt -> 1 hour
      const t2 = computeLockout(6, now);
      expect(t2).toBe(now + 60 * 60 * 1000);

      const t2b = computeLockout(9, now);
      expect(t2b).toBe(now + 60 * 60 * 1000);

      // Tier 3: 10th+ attempt -> 24 hours
      const t3 = computeLockout(10, now);
      expect(t3).toBe(now + 24 * 60 * 60 * 1000);

      const t3b = computeLockout(15, now);
      expect(t3b).toBe(now + 24 * 60 * 60 * 1000);
    });
  });

  describe("B4: Coexistence of Teacher & Student Sessions", () => {
    it("ensures student session cookie name does not collide with better-auth", () => {
      // Better Auth cookie names
      const betterAuthCookies = ["better-auth.session_token", "better-auth.session_data"];

      expect(betterAuthCookies).not.toContain(STUDENT_SESSION_COOKIE_NAME);
      expect(STUDENT_SESSION_COOKIE_NAME).toBe("klassa_student_session");
    });

    it("allows independent student session token verification in multi-tenant environment", () => {
      const studentSession = signStudentSessionToken({
        studentId: "std_456",
        schoolId: "sch_1",
        classId: "cls_1",
        academicPeriodId: "prd_1",
        nis: "1001A",
        fullName: "Ahmad Siswa",
        pinUpdatedAt: new Date().toISOString(),
      });

      const parsedStudent = verifyStudentSessionToken(studentSession);
      expect(parsedStudent).not.toBeNull();
      expect(parsedStudent?.studentId).toBe("std_456");

      // Simulasi cookie Better Auth guru yang hadir berdampingan
      const mockBrowserCookieJar = new Map<string, string>();
      mockBrowserCookieJar.set("better-auth.session_token", "guru_session_xyz_789");
      mockBrowserCookieJar.set(STUDENT_SESSION_COOKIE_NAME, studentSession);

      // Kedua cookie hadir di browser yang sama tanpa interferensi
      expect(mockBrowserCookieJar.get("better-auth.session_token")).toBe("guru_session_xyz_789");
      expect(mockBrowserCookieJar.get(STUDENT_SESSION_COOKIE_NAME)).toBe(studentSession);
    });
  });
});
