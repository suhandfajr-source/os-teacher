import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tahap 1 CBT Integrity Lockdown — test edge-case matriks spec:
 * - Strike 1-2 STRICT: tercatat, belum terkunci
 * - Strike ke-3 STRICT: kunci atomik + skor dari jawaban tersimpan (idempoten)
 * - Guard: attempt terkunci menolak mutasi jawaban & submit ulang
 * - MONITOR: tercatat tanpa lock; OFF: tidak merekam
 * - Dedupe/latar lain: attempt selesai → idempoten locked:true
 */

vi.mock("@/lib/auth", () => ({
  prisma: {
    quiz: {
      findUnique: vi.fn(),
    },
    quizAttempt: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    quizViolation: {
      create: vi.fn(),
    },
    quizAnswer: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return (arg as (tx: unknown) => Promise<unknown>)(prisma);
    }),
  },
}));

vi.mock("@/modules/student-auth/student-session", () => ({
  verifyStudentSession: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({
  verifyTeachingContextAccess: vi.fn().mockResolvedValue(undefined),
  verifyActiveSchoolMembership: vi.fn(),
}));

import { prisma } from "@/lib/auth";
import { verifyStudentSession } from "@/modules/student-auth/student-session";
import {
  recordQuizViolationFromSessionAction,
  saveQuizAnswerFromSessionAction,
  submitQuizAttemptFromSessionAction,
  getQuizIntegrityReportAction,
} from "../quiz.actions";

const mockAttempt = (overrides: Record<string, unknown> = {}) => ({
  id: "attempt-1",
  studentId: "student-1",
  status: "IN_PROGRESS",
  violationCount: 0,
  lockdownLockedAt: null,
  startedAt: new Date(Date.now() - 60_000),
  questionOrder: {
    questions: [
      { id: "q1", type: "MULTIPLE_CHOICE", correctIndex: 0, points: 10 },
      { id: "q2", type: "MULTIPLE_CHOICE", correctIndex: 1, points: 10 },
    ],
  },
  answers: [
    { questionId: "q1", selectedIndex: 0, essayAnswer: null }, // benar
    { questionId: "q2", selectedIndex: 0, essayAnswer: null }, // salah
  ],
  quiz: { lockdownMode: "STRICT", durationMinutes: 40, deadline: null, standardScore: 75 },
  ...overrides,
});

describe("CBT Integrity Lockdown — recordQuizViolationFromSessionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyStudentSession).mockResolvedValue({ studentId: "student-1" } as never);
  });

  it("strike 1 & 2 (STRICT): tercatat sebagai QuizViolation, belum terkunci", async () => {
    for (const count of [0, 1]) {
      vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(mockAttempt({ violationCount: count }) as never);
      vi.mocked(prisma.quizAttempt.update).mockResolvedValue({ violationCount: count + 1 } as never);

      const res = await recordQuizViolationFromSessionAction("attempt-1", "TAB_EXIT", 5400);

      expect(res.success).toBe(true);
      expect(res.locked).toBe(false);
      expect(res.violationCount).toBe(count + 1);
      expect(prisma.quizViolation.create).toHaveBeenCalledWith({
        data: { attemptId: "attempt-1", kind: "TAB_EXIT", awayMs: 5400 },
      });
    }
  });

  it("strike ke-3 (STRICT): mengunci attempt + skor dihitung dari jawaban tersimpan (50/100)", async () => {
    vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(mockAttempt({ violationCount: 2 }) as never);
    vi.mocked(prisma.quizAttempt.update)
      .mockResolvedValueOnce({ violationCount: 3 } as never) // increment
      .mockResolvedValue({} as never); // finalisasi lock

    const res = await recordQuizViolationFromSessionAction("attempt-1", "FULLSCREEN_EXIT", 8000);

    expect(res.success).toBe(true);
    expect(res.locked).toBe(true);
    expect(res.violationCount).toBe(3);

    // Finalisasi lock: status SUBMITTED + skor 50 (1 benar dari 2 soal) + lockdownLockedAt
    const finalizeCall = vi.mocked(prisma.quizAttempt.update).mock.calls[1][0];
    expect(finalizeCall.where).toEqual({ id: "attempt-1" });
    expect(finalizeCall.data.status).toBe("SUBMITTED");
    expect(Number(finalizeCall.data.score)).toBe(50);
    expect(finalizeCall.data.lockdownLockedAt).toBeInstanceOf(Date);
  });

  it("idempoten: attempt sudah selesai → locked:true tanpa mencatat pelanggaran baru", async () => {
    vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(
      mockAttempt({ status: "SUBMITTED", violationCount: 3, lockdownLockedAt: new Date() }) as never
    );

    const res = await recordQuizViolationFromSessionAction("attempt-1", "TAB_EXIT", 1000);

    expect(res.success).toBe(true);
    expect(res.locked).toBe(true);
    expect(prisma.quizViolation.create).not.toHaveBeenCalled();
    expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
  });

  it("MONITOR: pelanggaran tercatat tetapi tidak pernah mengunci", async () => {
    vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(
      mockAttempt({ violationCount: 5, quiz: { lockdownMode: "MONITOR", durationMinutes: 40, deadline: null, standardScore: 75 } }) as never
    );
    vi.mocked(prisma.quizAttempt.update).mockResolvedValue({ violationCount: 6 } as never);

    const res = await recordQuizViolationFromSessionAction("attempt-1", "WINDOW_BLUR", 2000);

    expect(res.success).toBe(true);
    expect(res.locked).toBe(false);
    expect(prisma.quizViolation.create).toHaveBeenCalled();
    // Hanya increment — tidak ada finalisasi lock (update dipanggil sekali)
    expect(prisma.quizAttempt.update).toHaveBeenCalledTimes(1);
  });

  it("OFF: tidak merekam apa pun (defensif)", async () => {
    vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(
      mockAttempt({ quiz: { lockdownMode: "OFF", durationMinutes: 40, deadline: null, standardScore: 75 } }) as never
    );

    const res = await recordQuizViolationFromSessionAction("attempt-1", "TAB_EXIT", 3000);

    expect(res.success).toBe(true);
    expect(res.locked).toBe(false);
    expect(prisma.quizViolation.create).not.toHaveBeenCalled();
  });

  it("menolak attempt milik siswa lain", async () => {
    vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(mockAttempt({ studentId: "student-lain" }) as never);

    const res = await recordQuizViolationFromSessionAction("attempt-1", "TAB_EXIT", 1000);

    expect(res.success).toBe(false);
    expect(res.error).toContain("tidak diizinkan");
  });

  it("menolak jenis pelanggaran yang tidak dikenal", async () => {
    const res = await recordQuizViolationFromSessionAction("attempt-1", "INJECT_KIND" as never, 1000);
    expect(res.success).toBe(false);
    expect(res.error).toContain("tidak valid");
  });

  it("deadline kedaluwarsa + strike ke-3: tetap dikunci & diskor (deadline menang untuk waktu, lock terekam)", async () => {
    vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(
      mockAttempt({
        violationCount: 2,
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 jam lalu
        quiz: { lockdownMode: "STRICT", durationMinutes: 40, deadline: null, standardScore: 75 },
      }) as never
    );
    vi.mocked(prisma.quizAttempt.update)
      .mockResolvedValueOnce({ violationCount: 3 } as never)
      .mockResolvedValue({} as never);

    const res = await recordQuizViolationFromSessionAction("attempt-1", "TAB_EXIT", 4000);

    expect(res.success).toBe(true);
    expect(res.locked).toBe(true);
    const finalizeCall = vi.mocked(prisma.quizAttempt.update).mock.calls[1][0];
    expect(finalizeCall.data.status).toBe("SUBMITTED");
    expect(finalizeCall.data.lockdownLockedAt).toBeInstanceOf(Date);
  });
});

describe("CBT Integrity Lockdown — getQuizIntegrityReportAction (guru)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menampilkan daftar attempt + pelanggaran + badge locked per siswa", async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
      id: "quiz-1",
      title: "Kuis CBT",
      lockdownMode: "STRICT",
      teachingContextId: "tc-1",
    } as never);
    vi.mocked(prisma.quizAttempt.findMany).mockResolvedValue([
      {
        id: "attempt-1",
        status: "SUBMITTED",
        violationCount: 3,
        lockdownLockedAt: new Date("2026-10-09T02:00:00Z"),
        submittedAt: new Date("2026-10-09T02:00:00Z"),
        startedAt: new Date("2026-10-09T01:00:00Z"),
        score: 60,
        student: { id: "s1", fullName: "Bunga Aulia Rahma" },
        violations: [
          { id: "v1", kind: "TAB_EXIT", awayMs: 8000, occurredAt: new Date("2026-10-09T01:30:00Z") },
          { id: "v2", kind: "FULLSCREEN_EXIT", awayMs: 4000, occurredAt: new Date("2026-10-09T01:40:00Z") },
          { id: "v3", kind: "TAB_EXIT", awayMs: 45000, occurredAt: new Date("2026-10-09T01:55:00Z") },
        ],
      },
    ] as never);

    const res = await getQuizIntegrityReportAction("quiz-1");

    expect(res.success).toBe(true);
    expect(res.data?.attempts).toHaveLength(1);
    const row = res.data?.attempts[0]!;
    expect(row.studentName).toBe("Bunga Aulia Rahma");
    expect(row.lockedBySystem).toBe(true);
    expect(row.violationCount).toBe(3);
    expect(row.violations[1].kind).toBe("FULLSCREEN_EXIT");
    expect(row.violations[1].awayMs).toBe(4000);
  });
});

describe("CBT Integrity Lockdown — guard attempt terkunci", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyStudentSession).mockResolvedValue({ studentId: "student-1" } as never);
  });

  it("saveQuizAnswerFromSessionAction menolak mutasi jawaban dengan pesan eksplisit", async () => {
    vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(
      mockAttempt({ lockdownLockedAt: new Date(), status: "SUBMITTED", violationCount: 3 }) as never
    );

    const res = await saveQuizAnswerFromSessionAction("attempt-1", "q1", 1, null);

    expect(res.success).toBe(false);
    expect(res.error).toContain("Ujian telah diakhiri sistem");
    expect(prisma.quizAnswer.upsert).not.toHaveBeenCalled();
  });

  it("submitQuizAttemptFromSessionAction menolak submit ulang pada attempt terkunci", async () => {
    vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(
      mockAttempt({ lockdownLockedAt: new Date(), status: "SUBMITTED", violationCount: 3 }) as never
    );

    const res = await submitQuizAttemptFromSessionAction("attempt-1", [
      { questionId: "q1", selectedIndex: 1 },
    ]);

    expect(res.success).toBe(false);
    expect(res.error).toContain("Ujian telah diakhiri sistem");
    expect(prisma.quizAnswer.upsert).not.toHaveBeenCalled();
    expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
  });
});
