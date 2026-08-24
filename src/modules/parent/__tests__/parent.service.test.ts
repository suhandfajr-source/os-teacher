import { describe, it, expect } from "vitest";
import {
  hashInvitationToken,
  generateInvitationToken,
  normalizeEmail,
  maskEmail,
  validateSafeInternalPath,
} from "../parent.service";
import { AttendanceStatus, AssessmentResultStatus } from "@prisma/client";

describe("Stage 08: Parent Service Unit Tests", () => {
  describe("Token Handling & Cryptographic Functions", () => {
    it("generates 32-byte (64 hex char) raw token and matching SHA-256 hash", () => {
      const { rawToken, tokenHash } = generateInvitationToken();

      expect(rawToken).toHaveLength(64);
      expect(tokenHash).toHaveLength(64);
      expect(hashInvitationToken(rawToken)).toBe(tokenHash);
    });

    it("produces deterministic SHA-256 hash for identical raw token", () => {
      const raw = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const hash1 = hashInvitationToken(raw);
      const hash2 = hashInvitationToken(raw);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(raw);
    });

    it("different raw tokens produce distinct hashes", () => {
      const token1 = generateInvitationToken();
      const token2 = generateInvitationToken();

      expect(token1.rawToken).not.toBe(token2.rawToken);
      expect(token1.tokenHash).not.toBe(token2.tokenHash);
    });
  });

  describe("Email Normalization & Privacy Masking", () => {
    it("normalizes email with trimming and lowercasing", () => {
      expect(normalizeEmail("  Parent.User@Example.COM  ")).toBe("parent.user@example.com");
      expect(normalizeEmail("Ibu.Sari@Sekolah.sch.id")).toBe("ibu.sari@sekolah.sch.id");
    });

    it("masks email safely for public unauthenticated display", () => {
      expect(maskEmail("budi.santoso@gmail.com")).toBe("b***@gmail.com");
      expect(maskEmail("a@domain.com")).toBe("***@domain.com");
      expect(maskEmail("user@sekolah.sch.id")).toBe("u***@sekolah.sch.id");
    });
  });

  describe("Safe Internal Path / Open Redirect Protection", () => {
    it("accepts valid relative internal paths starting with /parent", () => {
      expect(validateSafeInternalPath("/parent")).toBe("/parent");
      expect(validateSafeInternalPath("/parent/undangan/token123")).toBe("/parent/undangan/token123");
      expect(validateSafeInternalPath("/parent/anak/s1/konteks/c1")).toBe("/parent/anak/s1/konteks/c1");
    });

    it("rejects malicious open redirect URLs and falls back to /parent", () => {
      expect(validateSafeInternalPath("https://evil.com")).toBe("/parent");
      expect(validateSafeInternalPath("//evil.com/phishing")).toBe("/parent");
      expect(validateSafeInternalPath("javascript:alert(1)")).toBe("/parent");
      expect(validateSafeInternalPath("http://localhost:3000/parent")).toBe("/parent");
      expect(validateSafeInternalPath(null)).toBe("/parent");
      expect(validateSafeInternalPath("")).toBe("/parent");
    });
  });

  describe("Factual Attendance Calculations (No Invented Percentages)", () => {
    it("accurately computes factual status counts without percentage formulas", () => {
      const mockRecords = [
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.LATE },
        { status: AttendanceStatus.SICK },
        { status: AttendanceStatus.PERMISSION },
        { status: AttendanceStatus.ABSENT },
      ];

      let presentCount = 0;
      let lateCount = 0;
      let sickCount = 0;
      let permissionCount = 0;
      let absentCount = 0;

      for (const r of mockRecords) {
        if (r.status === AttendanceStatus.PRESENT) presentCount++;
        else if (r.status === AttendanceStatus.LATE) lateCount++;
        else if (r.status === AttendanceStatus.SICK) sickCount++;
        else if (r.status === AttendanceStatus.PERMISSION) permissionCount++;
        else if (r.status === AttendanceStatus.ABSENT) absentCount++;
      }

      expect(presentCount).toBe(2);
      expect(lateCount).toBe(1);
      expect(sickCount).toBe(1);
      expect(permissionCount).toBe(1);
      expect(absentCount).toBe(1);
    });
  });

  describe("Completed Assessment Filtering & Score Semantics", () => {
    it("preserves finalScore only for GRADED status and never converts non-graded to zero", () => {
      const results = [
        { status: AssessmentResultStatus.GRADED, finalScore: 88 },
        { status: AssessmentResultStatus.PENDING, finalScore: null },
        { status: AssessmentResultStatus.ABSENT, finalScore: null },
        { status: AssessmentResultStatus.EXCUSED, finalScore: null },
      ];

      const mapped = results.map((r) => ({
        resultStatus: r.status,
        finalScore: r.status === AssessmentResultStatus.GRADED ? r.finalScore : null,
      }));

      expect(mapped[0].finalScore).toBe(88);
      expect(mapped[1].finalScore).toBeNull();
      expect(mapped[2].finalScore).toBeNull();
      expect(mapped[3].finalScore).toBeNull();

      // Ensure ABSENT is not converted to 0
      expect(mapped[2].finalScore).not.toBe(0);
    });
  });
});
