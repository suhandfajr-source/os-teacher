import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
  prisma: {
    quiz: {
      findUnique: vi.fn(),
    },
    cbtSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    quizAttempt: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    student: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@/lib/authorization", () => ({
  verifyTeachingContextAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/student-auth/student-session", () => ({
  verifyStudentSession: vi.fn(),
}));

import { auth, prisma } from "@/lib/auth";
import { verifyStudentSession } from "@/modules/student-auth/student-session";
import {
  createCbtSessionAction,
  updateCbtSessionStatusAction,
  joinCbtSessionByTokenAction,
  unblockStudentAttemptAction,
  forceSubmitStudentAttemptAction,
} from "../cbt-live.actions";

describe("CBT Live Classroom Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createCbtSessionAction", () => {
    it("membuat sesi CBT dengan token 6 huruf dan status WAITING", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "teacher-1", name: "Pak Bambang", email: "bambang@klassa.id" } as never,
        session: {} as never,
      });
      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        id: "quiz-1",
        teachingContextId: "tc-1",
        status: "PUBLISHED",
      } as never);
      vi.mocked(prisma.cbtSession.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.cbtSession.create).mockResolvedValue({
        id: "cbt-sess-1",
        token: "CBT88X",
        status: "WAITING",
      } as never);

      const res = await createCbtSessionAction("quiz-1", "tc-1");

      expect(res.success).toBe(true);
      expect(res.sessionId).toBe("cbt-sess-1");
      expect(res.token).toBe("CBT88X");
    });
  });

  describe("updateCbtSessionStatusAction", () => {
    it("mengubah status sesi dari WAITING ke ACTIVE dan mencatat startedAt", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "teacher-1" } as never,
        session: {} as never,
      });
      vi.mocked(prisma.cbtSession.findUnique).mockResolvedValue({
        id: "cbt-sess-1",
        teachingContextId: "tc-1",
        status: "WAITING",
        startedAt: null,
      } as never);
      vi.mocked(prisma.cbtSession.update).mockResolvedValue({
        status: "ACTIVE",
      } as never);

      const res = await updateCbtSessionStatusAction("cbt-sess-1", "ACTIVE");

      expect(res.success).toBe(true);
      expect(res.status).toBe("ACTIVE");
      const updateCall = vi.mocked(prisma.cbtSession.update).mock.calls[0][0];
      expect(updateCall.data.startedAt).toBeInstanceOf(Date);
    });

    it("mengakhiri sesi (ENDED) dan melakukan auto-submit pada semua attempt yang masih aktif", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "teacher-1" } as never,
        session: {} as never,
      });
      vi.mocked(prisma.cbtSession.findUnique).mockResolvedValue({
        id: "cbt-sess-1",
        teachingContextId: "tc-1",
        status: "ACTIVE",
        startedAt: new Date(),
      } as never);
      vi.mocked(prisma.cbtSession.update).mockResolvedValue({
        status: "ENDED",
      } as never);

      const res = await updateCbtSessionStatusAction("cbt-sess-1", "ENDED");

      expect(res.success).toBe(true);
      expect(res.status).toBe("ENDED");
      expect(prisma.quizAttempt.updateMany).toHaveBeenCalledWith({
        where: {
          cbtSessionId: "cbt-sess-1",
          status: "IN_PROGRESS",
        },
        data: expect.objectContaining({
          status: "SUBMITTED",
        }),
      });
    });
  });

  describe("joinCbtSessionByTokenAction", () => {
    it("menolak jika siswa bukan anggota kelas yang sesuai", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-1",
        schoolId: "sch-1",
      } as never);
      vi.mocked(prisma.cbtSession.findUnique).mockResolvedValue({
        id: "cbt-sess-1",
        token: "ABC123",
        status: "WAITING",
        quiz: {
          id: "q-1",
          title: "Kuis Matematika",
          shareToken: "token-1",
          teachingContext: { classId: "class-A", subject: { name: "Matematika" } },
          _count: { questions: 10 },
        },
      } as never);
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        classMemberships: [{ classId: "class-B" }], // Berbeda rombel
      } as never);

      const res = await joinCbtSessionByTokenAction("ABC123");

      expect(res.success).toBe(false);
      expect(res.error).toContain("tidak terdaftar di kelas");
    });

    it("berhasil masuk lobi saat siswa cocok dengan rombel", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-1",
        schoolId: "sch-1",
      } as never);
      vi.mocked(prisma.cbtSession.findUnique).mockResolvedValue({
        id: "cbt-sess-1",
        token: "ABC123",
        status: "WAITING",
        quiz: {
          id: "q-1",
          title: "Kuis Matematika",
          shareToken: "token-1",
          teachingContext: { classId: "class-A", subject: { name: "Matematika" } },
          _count: { questions: 10 },
        },
      } as never);
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        classMemberships: [{ classId: "class-A" }],
      } as never);
      vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(null);

      const res = await joinCbtSessionByTokenAction("ABC123");

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("WAITING");
      expect(res.data?.quizTitle).toBe("Kuis Matematika");
    });
  });

  describe("Intervensi Guru: unblock & force submit", () => {
    it("unblockStudentAttemptAction mereset strike dan mengembalikan status ke IN_PROGRESS", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "teacher-1" } as never,
        session: {} as never,
      });
      vi.mocked(prisma.cbtSession.findUnique).mockResolvedValue({
        teachingContextId: "tc-1",
      } as never);

      const res = await unblockStudentAttemptAction("cbt-sess-1", "attempt-1");

      expect(res.success).toBe(true);
      expect(prisma.quizAttempt.update).toHaveBeenCalledWith({
        where: { id: "attempt-1" },
        data: {
          status: "IN_PROGRESS",
          lockdownLockedAt: null,
          violationCount: 0,
        },
      });
    });

    it("forceSubmitStudentAttemptAction mengunci status ke SUBMITTED", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "teacher-1" } as never,
        session: {} as never,
      });
      vi.mocked(prisma.cbtSession.findUnique).mockResolvedValue({
        teachingContextId: "tc-1",
      } as never);

      const res = await forceSubmitStudentAttemptAction("cbt-sess-1", "attempt-1");

      expect(res.success).toBe(true);
      expect(prisma.quizAttempt.update).toHaveBeenCalledWith({
        where: { id: "attempt-1" },
        data: expect.objectContaining({
          status: "SUBMITTED",
        }),
      });
    });
  });
});
