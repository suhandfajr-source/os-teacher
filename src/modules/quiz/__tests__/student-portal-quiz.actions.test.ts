import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @/lib/auth
vi.mock("@/lib/auth", () => ({
  prisma: {
    quiz: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    quizAttempt: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    quizAnswer: {
      upsert: vi.fn(),
    },
    quizQuestion: {
      findMany: vi.fn(),
    },
    student: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (ops) => {
      if (Array.isArray(ops)) {
        return Promise.all(ops);
      }
      return ops(prisma);
    }),
  },
}));

// Mock @/modules/student-auth/student-session
vi.mock("@/modules/student-auth/student-session", () => ({
  verifyStudentSession: vi.fn(),
}));

import { prisma } from "@/lib/auth";
import { verifyStudentSession } from "@/modules/student-auth/student-session";
import {
  startQuizAttemptFromSessionAction,
  saveQuizAnswerFromSessionAction,
  submitQuizAttemptFromSessionAction,
  getQuizReviewFromSessionAction,
} from "../quiz.actions";

describe("Student Portal Quiz Actions (CAP-6, B1, F3, F4, F6, F7, D1, D4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("startQuizAttemptFromSessionAction (Amendum B1 & Temuan F6)", () => {
    it("rejects if student session is missing or invalid", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue(null);

      const res = await startQuizAttemptFromSessionAction("token-1234567890");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Sesi tidak valid/);
    });

    it("verifies roster and rejects student not in class (B1 Roster Check)", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-attacker",
        schoolId: "sch-1",
        classId: "c-other",
        academicPeriodId: "ap-1",
        nis: "999999",
        fullName: "Attacker",
        pinUpdatedAt: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        id: "q-1",
        shareToken: "token-1234567890",
        status: "PUBLISHED",
        validFrom: null,
        deadline: null,
        accessMode: "CLASSROOM_PIN",
        classroomPin: "9999",
        teachingContext: {
          academicPeriodId: "ap-1",
          class: {
            classStudents: [
              {
                academicPeriodId: "ap-1",
                student: { id: "s-legit" },
              },
            ],
          },
        },
      } as any);

      const res = await startQuizAttemptFromSessionAction("token-1234567890");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/tidak terdaftar di kelas/);
    });

    it("bypasses classroom PIN and sanitizes question answers/explanations (B1 & F6)", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-legit",
        schoolId: "sch-1",
        classId: "c-1",
        academicPeriodId: "ap-1",
        nis: "202601",
        fullName: "Ahmad Siswa",
        pinUpdatedAt: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        id: "q-1",
        title: "Kuis IPA Biologi",
        shareToken: "token-1234567890",
        status: "PUBLISHED",
        validFrom: null,
        deadline: null,
        durationMinutes: 30,
        accessMode: "CLASSROOM_PIN",
        classroomPin: "SECRET99",
        shuffleQuestions: false,
        shuffleOptions: false,
        teachingContext: {
          academicPeriodId: "ap-1",
          class: {
            classStudents: [
              {
                academicPeriodId: "ap-1",
                student: { id: "s-legit" },
              },
            ],
          },
        },
      } as any);

      vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(null);

      const mockAttempt = {
        id: "att-1",
        quizId: "q-1",
        studentId: "s-legit",
        status: "IN_PROGRESS",
        startedAt: new Date(),
        questionOrder: {
          questions: [
            {
              id: "item-1",
              type: "MULTIPLE_CHOICE",
              text: "Apa fungsi mitokondria?",
              options: ["Respirasi sel", "Fotosintesis", "Ekskresi"],
              correctIndex: 0, // Kunci Jawaban
              explanation: "Mitokondria menghasilkan ATP.", // Pembahasan
              points: 10,
            },
          ],
        },
        answers: [],
      };

      vi.mocked(prisma.quizAttempt.create).mockResolvedValue(mockAttempt as any);

      const res = await startQuizAttemptFromSessionAction("token-1234567890");
      expect(res.success).toBe(true);
      expect(res.data?.quizTitle).toBe("Kuis IPA Biologi");
      expect(res.data?.questions.length).toBe(1);

      const sentQuestion = res.data?.questions[0] as any;
      expect(sentQuestion.text).toBe("Apa fungsi mitokondria?");
      // F6 CRITICAL VERIFICATION: correctIndex & explanation MUST NOT BE LEAKED!
      expect(sentQuestion.correctIndex).toBeUndefined();
      expect(sentQuestion.explanation).toBeUndefined();
    });

    it("handles double-start concurrency P2002 gracefully (Temuan D1)", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-legit",
        schoolId: "sch-1",
        classId: "c-1",
        academicPeriodId: "ap-1",
        nis: "202601",
        fullName: "Ahmad Siswa",
        pinUpdatedAt: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        id: "q-1",
        title: "Kuis Matematika",
        shareToken: "token-1234567890",
        status: "PUBLISHED",
        teachingContext: {
          academicPeriodId: "ap-1",
          class: {
            classStudents: [{ academicPeriodId: "ap-1", student: { id: "s-legit" } }],
          },
        },
      } as any);

      // Skenario: findUnique awal null (karena race), create melempar P2002
      vi.mocked(prisma.quizAttempt.findUnique)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "att-created-by-other-tab",
          quizId: "q-1",
          studentId: "s-legit",
          status: "IN_PROGRESS",
          startedAt: new Date(),
          questionOrder: {
            questions: [{ id: "item-1", text: "1+1?", options: ["2", "3"], points: 1 }],
          },
          answers: [],
        } as any);

      const p2002Error = new Error("Unique constraint failed");
      (p2002Error as any).code = "P2002";
      vi.mocked(prisma.quizAttempt.create).mockRejectedValueOnce(p2002Error);

      const res = await startQuizAttemptFromSessionAction("token-1234567890");
      expect(res.success).toBe(true);
      expect(res.data?.attemptId).toBe("att-created-by-other-tab");
    });
  });

  describe("saveQuizAnswerFromSessionAction", () => {
    it("rejects if attempt does not belong to session student (F3 Impersonation Guard)", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-attacker",
        schoolId: "sch-1",
        classId: "c-1",
        academicPeriodId: "ap-1",
        nis: "999999",
        fullName: "Attacker",
        pinUpdatedAt: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue({
        id: "att-victim",
        studentId: "s-victim",
        status: "IN_PROGRESS",
        quiz: {},
      } as any);

      const res = await saveQuizAnswerFromSessionAction("att-victim", "item-1", 1);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Akses tidak diizinkan/);
    });

    it("rejects answer saving if attempt is already SUBMITTED", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-1",
        schoolId: "sch-1",
        classId: "c-1",
        academicPeriodId: "ap-1",
        nis: "202601",
        fullName: "Ahmad",
        pinUpdatedAt: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue({
        id: "att-1",
        studentId: "s-1",
        status: "SUBMITTED",
        quiz: {},
      } as any);

      const res = await saveQuizAnswerFromSessionAction("att-1", "item-1", 1);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/selesai dikumpulkan/);
    });
  });

  describe("submitQuizAttemptFromSessionAction (CAP-6 & Activity Generates Data)", () => {
    it("submits answers and calculates score automatically to QuizAttempt.score", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-1",
        schoolId: "sch-1",
        classId: "c-1",
        academicPeriodId: "ap-1",
        nis: "202601",
        fullName: "Ahmad",
        pinUpdatedAt: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue({
        id: "att-1",
        studentId: "s-1",
        status: "IN_PROGRESS",
        isRemedial: false,
        questionOrder: {
          questions: [
            {
              id: "item-1",
              type: "MULTIPLE_CHOICE",
              correctIndex: 2,
              points: 50,
            },
            {
              id: "item-2",
              type: "MULTIPLE_CHOICE",
              correctIndex: 1,
              points: 50,
            },
          ],
        },
        quiz: {
          id: "q-1",
          standardScore: 75,
        },
      } as any);

      const answers = [
        { questionId: "item-1", selectedIndex: 2 }, // Benar (50 poin)
        { questionId: "item-2", selectedIndex: 0 }, // Salah (0 poin)
      ];

      const res = await submitQuizAttemptFromSessionAction("att-1", answers);
      expect(res.success).toBe(true);
      expect(res.data?.score).toBe(50); // 50 / 100
      expect(res.data?.passed).toBe(false); // 50 < 75
    });
  });

  describe("getQuizReviewFromSessionAction", () => {
    it("rejects review if attempt is still IN_PROGRESS", async () => {
      vi.mocked(verifyStudentSession).mockResolvedValue({
        studentId: "s-1",
        schoolId: "sch-1",
        classId: "c-1",
        academicPeriodId: "ap-1",
        nis: "202601",
        fullName: "Ahmad",
        pinUpdatedAt: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        id: "q-1",
        title: "Kuis IPA",
      } as any);

      vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue({
        id: "att-1",
        studentId: "s-1",
        status: "IN_PROGRESS",
        answers: [],
      } as any);

      const res = await getQuizReviewFromSessionAction("token-1234567890");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/belum tersedia/);
    });
  });
});
