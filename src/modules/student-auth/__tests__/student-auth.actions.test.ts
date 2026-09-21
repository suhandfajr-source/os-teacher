import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @/lib/auth
vi.mock("@/lib/auth", () => ({
  prisma: {
    class: {
      findUnique: vi.fn(),
    },
    student: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    classStudent: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(prisma)),
  },
}));

// Mock @/lib/student-pin
vi.mock("@/lib/student-pin", () => ({
  validatePinFormat: vi.fn((pin: string) => {
    if (!/^\d{4}$/.test(pin)) {
      throw new Error("Format PIN harus 4 digit angka.");
    }
    return true;
  }),
  hashPin: vi.fn(async (pin: string) => `scrypt:16384:8:1:salt:${pin}`),
  verifyPin: vi.fn(async (pin: string, hash: string) => hash.endsWith(`:${pin}`)),
}));

// Mock ./student-session
vi.mock("../student-session", () => ({
  setStudentSessionCookie: vi.fn(),
  clearStudentSessionCookie: vi.fn(),
}));

import { prisma } from "@/lib/auth";
import { verifyPin } from "@/lib/student-pin";
import { setStudentSessionCookie, clearStudentSessionCookie } from "../student-session";
import {
  lookupJoinCode,
  registerStudent,
  loginStudent,
  logoutStudent,
  DUMMY_HASH,
} from "../student-auth.actions";

describe("Student Auth Actions (CAP-1 & F1–F8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("lookupJoinCode", () => {
    it("returns context card data when code is valid and unlocked", async () => {
      (prisma.class.findUnique as any).mockResolvedValue({
        id: "cls_1",
        name: "7-A",
        gradeLevel: "7",
        joinCodeLocked: false,
        school: { id: "sch_1", name: "SMP Negeri 1", city: "Surabaya" },
        teachingContexts: [
          {
            academicPeriod: { id: "prd_1", year: "2026/2027", semester: "Ganjil" },
            teacherProfile: { user: { name: "Pak Budi" } },
          },
        ],
      });

      const res = await lookupJoinCode("ABC234");
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.className).toBe("7-A");
        expect(res.data.schoolName).toBe("SMP Negeri 1");
        expect(res.data.teacherName).toBe("Pak Budi");
      }
    });

    it("rejects when join code is locked by teacher", async () => {
      (prisma.class.findUnique as any).mockResolvedValue({
        id: "cls_1",
        joinCodeLocked: true,
      });

      const res = await lookupJoinCode("ABC234");
      expect(res.success).toBe(false);
      expect(res.message).toBe("Kode rombel telah dikunci oleh guru.");
    });

    it("rejects when code not found", async () => {
      (prisma.class.findUnique as any).mockResolvedValue(null);
      const res = await lookupJoinCode("NONEXS");
      expect(res.success).toBe(false);
      expect(res.message).toBe("Kode rombel tidak ditemukan.");
    });
  });

  describe("registerStudent (State Machine 4 Cabang & Anti-Takeover F1)", () => {
    const validClassRecord = {
      id: "cls_1",
      schoolId: "sch_1",
      joinCodeLocked: false,
      teachingContexts: [{ academicPeriodId: "prd_1" }],
    };

    it("rejects invalid PIN format (< 4 digits)", async () => {
      await expect(
        registerStudent({
          joinCode: "ABC234",
          fullName: "Ahmad",
          nis: "1001A",
          pin: "123",
        })
      ).rejects.toThrow("Format PIN harus 4 digit angka.");
    });

    it("Skenario D: rejects if student already enrolled in another class in the active period", async () => {
      (prisma.class.findUnique as any).mockResolvedValue(validClassRecord);
      (prisma.classStudent.findFirst as any).mockResolvedValue({
        id: "cs_existing",
        class: { name: "7-B" },
      });

      const res = await registerStudent({
        joinCode: "ABC234",
        fullName: "Ahmad",
        nis: "1001A",
        pin: "1234",
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain('sudah terdaftar di rombel "7-B"');
    });

    it("F1 CRITICAL Anti-Takeover: rejects re-registration if student already has active PIN", async () => {
      (prisma.class.findUnique as any).mockResolvedValue(validClassRecord);
      (prisma.classStudent.findFirst as any).mockResolvedValue(null);

      // Student exists and ALREADY has a PIN hash
      (prisma.student.findFirst as any).mockResolvedValue({
        id: "std_1",
        fullName: "Ahmad Siswa",
        nis: "1001A",
        accessPinHash: "scrypt:already-set",
      });

      const res = await registerStudent({
        joinCode: "ABC234",
        fullName: "Ahmad Siswa",
        nis: "1001A",
        pin: "9999",
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain("Akun siswa dengan NIS 1001A sudah terdaftar");
      expect(prisma.student.update).not.toHaveBeenCalled();
    });

    it("Skenario A (L0 Otomatis): NIS match & name match exact -> ACTIVE & auto-login session", async () => {
      (prisma.class.findUnique as any).mockResolvedValue(validClassRecord);
      (prisma.classStudent.findFirst as any).mockResolvedValue(null);

      // Student exists in teacher roster with null PIN
      (prisma.student.findFirst as any).mockResolvedValue({
        id: "std_1",
        fullName: "Ahmad Siswa",
        nis: "1001A",
        accessPinHash: null,
      });

      (prisma.student.update as any).mockResolvedValue({
        id: "std_1",
        fullName: "Ahmad Siswa",
        nis: "1001A",
        accountStatus: "ACTIVE",
      });

      const res = await registerStudent({
        joinCode: "ABC234",
        fullName: "  ahmad siswa  ", // Case-insensitive and trimmed match
        nis: "1001a",
        pin: "1234",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.status).toBe("ACTIVE");
      }
      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountStatus: "ACTIVE",
          }),
        })
      );
      // Auto-session cookie created
      expect(setStudentSessionCookie).toHaveBeenCalled();
    });

    it("Skenario B (L1 Pending): NIS match but name differs -> PENDING without session", async () => {
      (prisma.class.findUnique as any).mockResolvedValue(validClassRecord);
      (prisma.classStudent.findFirst as any).mockResolvedValue(null);

      (prisma.student.findFirst as any).mockResolvedValue({
        id: "std_1",
        fullName: "Ahmad Asli",
        nis: "1001A",
        accessPinHash: null,
      });

      (prisma.student.update as any).mockResolvedValue({
        id: "std_1",
        fullName: "Ahmad Asli",
        accountStatus: "PENDING",
      });

      const res = await registerStudent({
        joinCode: "ABC234",
        fullName: "Budi Berbeda",
        nis: "1001A",
        pin: "1234",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.status).toBe("PENDING");
        expect((res as any).reason).toBe("MISMATCH_NAME");
      }
      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountStatus: "PENDING",
          }),
        })
      );
      expect(setStudentSessionCookie).not.toHaveBeenCalled();
    });

    it("Skenario C (L1 Pending): NIS does not exist in school -> Creates student row PENDING", async () => {
      (prisma.class.findUnique as any).mockResolvedValue(validClassRecord);
      (prisma.classStudent.findFirst as any).mockResolvedValue(null);
      (prisma.student.findFirst as any).mockResolvedValue(null); // NIS baru

      (prisma.student.create as any).mockResolvedValue({
        id: "std_new",
        fullName: "Siswa Baru",
        nis: "9999Z",
        accountStatus: "PENDING",
      });

      const res = await registerStudent({
        joinCode: "ABC234",
        fullName: "Siswa Baru",
        nis: "9999z",
        pin: "1234",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.status).toBe("PENDING");
        expect((res as any).reason).toBe("NEW_STUDENT");
      }
      expect(prisma.student.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nis: "9999Z",
            accountStatus: "PENDING",
          }),
        })
      );
      expect(setStudentSessionCookie).not.toHaveBeenCalled();
    });
  });

  describe("loginStudent (Timing Defense & Lockout)", () => {
    it("F5 Timing Defense: calls verifyPin with DUMMY_HASH when NIS not found", async () => {
      (prisma.student.findFirst as any).mockResolvedValue(null);

      const res = await loginStudent({
        schoolId: "sch_1",
        nis: "9999Z",
        pin: "1234",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.message).toBe("NIS atau PIN salah.");
      }

      // Proves dummy hash scrypt verify ran!
      expect(verifyPin).toHaveBeenCalledWith("1234", DUMMY_HASH);
    });

    it("returns generic error and increments failedAttempts on wrong PIN", async () => {
      (prisma.student.findFirst as any).mockResolvedValue({
        id: "std_1",
        schoolId: "sch_1",
        nis: "1001A",
        accessPinHash: "scrypt:...:1234",
        accountStatus: "ACTIVE",
        failedAttempts: 2,
        lockedUntil: null,
      });

      const res = await loginStudent({
        schoolId: "sch_1",
        nis: "1001A",
        pin: "0000", // Wrong PIN
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.message).toBe("NIS atau PIN salah.");
      }

      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "std_1" },
          data: expect.objectContaining({
            failedAttempts: 3,
          }),
        })
      );
    });

    it("B3: triggers 15-minute lockout on 5th failed attempt", async () => {
      (prisma.student.findFirst as any).mockResolvedValue({
        id: "std_1",
        schoolId: "sch_1",
        nis: "1001A",
        accessPinHash: "scrypt:...:1234",
        accountStatus: "ACTIVE",
        failedAttempts: 4, // 5th attempt incoming
        lockedUntil: null,
      });

      const res = await loginStudent({
        schoolId: "sch_1",
        nis: "1001A",
        pin: "0000",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect((res as any).code).toBe("ACCOUNT_LOCKED");
        expect(res.message).toContain("15 menit");
      }

      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "std_1" },
          data: expect.objectContaining({
            failedAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        })
      );
    });

    it("blocks login immediately if account is already locked", async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes in future
      (prisma.student.findFirst as any).mockResolvedValue({
        id: "std_1",
        schoolId: "sch_1",
        nis: "1001A",
        accessPinHash: "scrypt:...:1234",
        accountStatus: "ACTIVE",
        failedAttempts: 5,
        lockedUntil,
      });

      const res = await loginStudent({
        schoolId: "sch_1",
        nis: "1001A",
        pin: "1234", // Even with correct PIN, locked account rejected
      });

      expect(res.success).toBe(false);
      expect((res as any).code).toBe("ACCOUNT_LOCKED");
      expect(verifyPin).not.toHaveBeenCalled();
    });

    it("blocks login if student accountStatus is PENDING", async () => {
      (prisma.student.findFirst as any).mockResolvedValue({
        id: "std_1",
        schoolId: "sch_1",
        nis: "1001A",
        accessPinHash: "scrypt:...:1234",
        accountStatus: "PENDING",
      });

      const res = await loginStudent({
        schoolId: "sch_1",
        nis: "1001A",
        pin: "1234",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect((res as any).code).toBe("ACCOUNT_PENDING");
        expect(res.message).toContain("menunggu persetujuan guru");
      }
    });

    it("successful login resets failedAttempts, updates lastLoginAt, and sets session cookie", async () => {
      (prisma.student.findFirst as any).mockResolvedValue({
        id: "std_1",
        schoolId: "sch_1",
        nis: "1001A",
        fullName: "Ahmad Siswa",
        accessPinHash: "scrypt:...:1234",
        accountStatus: "ACTIVE",
        failedAttempts: 3,
        lockedUntil: null,
        pinUpdatedAt: new Date(),
      });

      (prisma.classStudent.findFirst as any).mockResolvedValue({
        classId: "cls_1",
        academicPeriodId: "prd_1",
      });

      const res = await loginStudent({
        schoolId: "sch_1",
        nis: "1001A",
        pin: "1234", // Correct PIN
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.redirect).toBe("/siswa/portal");
      }

      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "std_1" },
          data: expect.objectContaining({
            failedAttempts: 0,
            lockedUntil: null,
            lastLoginAt: expect.any(Date),
          }),
        })
      );

      expect(setStudentSessionCookie).toHaveBeenCalled();
    });
  });

  describe("logoutStudent", () => {
    it("clears student session cookie and redirects", async () => {
      const res = await logoutStudent();
      expect(res.success).toBe(true);
      expect(res.redirect).toBe("/siswa");
      expect(clearStudentSessionCookie).toHaveBeenCalled();
    });
  });
});
