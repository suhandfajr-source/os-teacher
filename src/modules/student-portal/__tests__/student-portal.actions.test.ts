import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @/lib/auth
vi.mock("@/lib/auth", () => ({
  prisma: {
    student: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    teachingSchedule: {
      findMany: vi.fn(),
    },
    quiz: {
      findMany: vi.fn(),
    },
  },
}));

// Mock @/modules/student-auth/student-session
vi.mock("@/modules/student-auth/student-session", () => ({
  verifyStudentSession: vi.fn(),
  setStudentSessionCookie: vi.fn(),
}));

// Mock @/lib/student-pin
vi.mock("@/lib/student-pin", () => ({
  verifyPin: vi.fn(async (pin: string, hash: string) => hash.endsWith(`:${pin}`)),
  hashPin: vi.fn(async (pin: string) => `scrypt:16384:8:1:salt:${pin}`),
}));

import { prisma } from "@/lib/auth";
import { verifyStudentSession, setStudentSessionCookie } from "@/modules/student-auth/student-session";
import { verifyPin, hashPin } from "@/lib/student-pin";
import {
  getStudentDashboardDataAction,
  getStudentWeeklyScheduleAction,
  changeStudentPinAction,
} from "../student-portal.actions";

describe("Student Portal Actions (CAP-5, B5, F5, F8, D2, D9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStudentDashboardDataAction", () => {
    it("returns error if student session is missing or invalid", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue(null);

      const res = await getStudentDashboardDataAction();
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Sesi tidak valid/);
    });

    it("handles student without active academic period gracefully (Temuan D9)", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-1",
        schoolId: "sch-1",
        classId: "c-1",
        academicPeriodId: "ap-1",
        nis: "202601",
        fullName: "Ahmad Siswa",
        pinUpdatedAt: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        id: "s-1",
        fullName: "Ahmad Siswa",
        nis: "202601",
        school: { id: "sch-1", name: "SMPN 1 Madani" },
        classMemberships: [],
      } as any);

      const res = await getStudentDashboardDataAction();
      expect(res.success).toBe(true);
      expect(res.data?.hasActivePeriod).toBe(false);
      expect(res.data?.today.schedules).toEqual([]);
    });

    it("loads today schedules and urgent quizzes for active class membership", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-1",
        schoolId: "sch-1",
        classId: "c-1",
        academicPeriodId: "ap-1",
        nis: "202601",
        fullName: "Ahmad Siswa",
        pinUpdatedAt: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        id: "s-1",
        fullName: "Ahmad Siswa",
        nis: "202601",
        school: { id: "sch-1", name: "SMPN 1 Madani" },
        classMemberships: [
          {
            classId: "c-1",
            academicPeriodId: "ap-1",
            class: { id: "c-1", name: "8-A", gradeLevel: "8" },
            academicPeriod: { id: "ap-1", year: "2026/2027", semester: "Ganjil", status: "ACTIVE" },
          },
        ],
      } as any);

      vi.mocked(prisma.teachingSchedule.findMany).mockResolvedValue([
        {
          id: "sched-1",
          dayOfWeek: 1,
          startTime: "07:30",
          endTime: "09:00",
          room: "R. 8A",
          teachingContext: {
            subject: { name: "Matematika" },
            teacherProfile: { user: { name: "Bpk. Budi" } },
          },
        },
      ] as any);

      vi.mocked(prisma.quiz.findMany).mockResolvedValue([
        {
          id: "quiz-1",
          title: "Kuis Aljabar 1",
          shareToken: "token-aljabar-1",
          durationMinutes: 30,
          deadline: new Date(Date.now() + 86400000),
          teachingContext: {
            subject: { name: "Matematika" },
          },
          attempts: [],
        },
      ] as any);

      const res = await getStudentDashboardDataAction();
      expect(res.success).toBe(true);
      expect(res.data?.student.fullName).toBe("Ahmad Siswa");
      expect(res.data?.student.className).toBe("8-A (8)");
      expect(res.data?.today.schedules.length).toBe(1);
      expect(res.data?.today.schedules[0].subjectName).toBe("Matematika");
      expect(res.data?.urgentQuizzes.length).toBe(1);
      expect(res.data?.urgentQuizzes[0].title).toBe("Kuis Aljabar 1");
    });
  });

  describe("getStudentWeeklyScheduleAction", () => {
    it("returns empty schedule array if session is missing", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue(null);

      const res = await getStudentWeeklyScheduleAction();
      expect(res.success).toBe(false);
    });

    it("groups weekly schedule across Monday to Saturday", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-1",
        schoolId: "sch-1",
        classId: "c-1",
        academicPeriodId: "ap-1",
        nis: "202601",
        fullName: "Ahmad Siswa",
        pinUpdatedAt: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        id: "s-1",
        classMemberships: [
          {
            classId: "c-1",
            academicPeriodId: "ap-1",
            academicPeriod: { status: "ACTIVE" },
          },
        ],
      } as any);

      vi.mocked(prisma.teachingSchedule.findMany).mockResolvedValue([
        {
          id: "s-1",
          dayOfWeek: 1, // Senin
          startTime: "07:30",
          endTime: "09:00",
          room: "Lab IPA",
          teachingContext: {
            subject: { name: "IPA" },
            teacherProfile: { user: { name: "Ibu Siti" } },
          },
        },
      ] as any);

      const res = await getStudentWeeklyScheduleAction();
      expect(res.success).toBe(true);
      expect(res.data?.length).toBe(6); // Senin s/d Sabtu
      expect(res.data?.[0].dayName).toBe("Senin");
      expect(res.data?.[0].items.length).toBe(1);
      expect(res.data?.[1].items.length).toBe(0); // Selasa kosong
    });
  });

  describe("changeStudentPinAction (Amendum B5 & Temuan F5)", () => {
    it("rejects if PIN format is not 4 digits", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-1",
        schoolId: "sch-1",
        classId: "c-1",
        academicPeriodId: "ap-1",
        nis: "202601",
        fullName: "Ahmad Siswa",
        pinUpdatedAt: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      const res = await changeStudentPinAction({ oldPin: "123", newPin: "4567" });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/4 digit angka/);
    });

    it("rejects if new PIN is identical to old PIN", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-1",
        schoolId: "sch-1",
        classId: "c-1",
        academicPeriodId: "ap-1",
        nis: "202601",
        fullName: "Ahmad Siswa",
        pinUpdatedAt: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      const res = await changeStudentPinAction({ oldPin: "1234", newPin: "1234" });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/tidak boleh sama/);
    });

    it("rejects and increments failedAttempts if old PIN is wrong", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-1",
        schoolId: "sch-1",
        classId: "c-1",
        academicPeriodId: "ap-1",
        nis: "202601",
        fullName: "Ahmad Siswa",
        pinUpdatedAt: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        id: "s-1",
        accessPinHash: "scrypt:16384:8:1:salt:9999",
        failedAttempts: 0,
        lockedUntil: null,
      } as any);

      const res = await changeStudentPinAction({ oldPin: "1111", newPin: "5555" });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/PIN lama salah/);
      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "s-1" },
          data: expect.objectContaining({ failedAttempts: 1 }),
        })
      );
    });

    it("updates PIN in DB and re-issues local session cookie with new pinUpdatedAt (Temuan F5)", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-1",
        schoolId: "sch-1",
        classId: "c-1",
        academicPeriodId: "ap-1",
        nis: "202601",
        fullName: "Ahmad Siswa",
        pinUpdatedAt: "2026-01-01T00:00:00.000Z",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        id: "s-1",
        accessPinHash: "scrypt:16384:8:1:salt:1234",
        failedAttempts: 0,
        lockedUntil: null,
      } as any);

      vi.mocked(prisma.student.update).mockResolvedValue({
        id: "s-1",
        pinUpdatedAt: new Date(),
      } as any);

      const res = await changeStudentPinAction({ oldPin: "1234", newPin: "9876" });
      expect(res.success).toBe(true);

      // Verify DB update
      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "s-1" },
          data: expect.objectContaining({
            accessPinHash: "scrypt:16384:8:1:salt:9876",
            failedAttempts: 0,
            lockedUntil: null,
          }),
        })
      );

      // Verify F5 critical re-issue of local cookie
      expect(setStudentSessionCookie).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "s-1",
          fullName: "Ahmad Siswa",
          nis: "202601",
          pinUpdatedAt: expect.any(String),
        })
      );
    });
  });
});
