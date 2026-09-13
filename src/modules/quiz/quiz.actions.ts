"use server";

/**
 * QUIZ ONLINE MODULE — Server Actions
 *
 * Teacher actions are guarded by verifyTeachingContextAccess (school + ownership).
 * Public student actions are guarded by the quiz share token only — no login.
 */

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import {
  createQuizSchema,
  quizQuestionSchema,
  quizSettingsSchema,
  submitAttemptSchema,
  PublicQuizView,
  StudentQuizQuestionView,
  AttemptResultView,
} from "./quiz.types";
import {
  gradeAttempt,
  normalizeScore,
  generateShareToken,
  isAttemptExpired,
  buildAttemptSnapshot,
  AttemptQuestionSnapshot,
} from "./quiz.service";

function formatActionError(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) {
    return error.issues?.[0]?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

// ============================================================================
// TEACHER ACTIONS
// ============================================================================

export async function createQuizAction(input: unknown): Promise<{
  success: boolean;
  data?: { quizId: string };
  error?: string;
}> {
  try {
    const parsed = createQuizSchema.parse(input);
    await verifyTeachingContextAccess(parsed.teachingContextId);

    // Sanitize: never persist blank/whitespace options or question text.
    const sanitizedQuestions = parsed.questions
      .map((q) => ({
        ...q,
        text: q.text.trim(),
        options: q.options.map((o) => o.trim()).filter((o) => o.length > 0),
      }))
      .filter((q) => q.text.length > 0 && q.options.length >= 2);

    if (sanitizedQuestions.length === 0) {
      return { success: false, error: "Tidak ada soal yang valid (teks & minimal 2 opsi harus terisi)" };
    }

    const quiz = await prisma.quiz.create({
      data: {
        teachingContextId: parsed.teachingContextId,
        title: parsed.title,
        description: parsed.description,
        durationMinutes: parsed.durationMinutes,
        shuffleQuestions: parsed.shuffleQuestions,
        shuffleOptions: parsed.shuffleOptions,
        standardScore: parsed.standardScore,
        deadline: parsed.deadline ? new Date(parsed.deadline) : undefined,
        shareToken: generateShareToken(),
        questions: {
          create: sanitizedQuestions.map((q, idx) => ({
            order: idx + 1,
            type: "MULTIPLE_CHOICE" as const,
            text: q.text,
            options: q.options,
            correctIndex: q.correctIndex,
            points: q.points,
            explanation: q.explanation,
          })),
        },
      },
      select: { id: true },
    });

    return { success: true, data: { quizId: quiz.id } };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal membuat quiz") };
  }
}

export async function updateQuizSettingsAction(input: unknown): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const parsed = quizSettingsSchema.parse(input);
    const quiz = await prisma.quiz.findUnique({
      where: { id: parsed.quizId },
      select: { teachingContextId: true },
    });
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan" };

    await verifyTeachingContextAccess(quiz.teachingContextId);

    await prisma.quiz.update({
      where: { id: parsed.quizId },
      data: {
        title: parsed.title,
        description: parsed.description,
        durationMinutes: parsed.durationMinutes,
        shuffleQuestions: parsed.shuffleQuestions,
        shuffleOptions: parsed.shuffleOptions,
        standardScore: parsed.standardScore,
        deadline: parsed.deadline ? new Date(parsed.deadline) : undefined,
      },
    });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal memperbarui pengaturan quiz") };
  }
}

export async function setQuizStatusAction(quizId: string, status: "PUBLISHED" | "CLOSED" | "DRAFT") {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { teachingContextId: true },
    });
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan" };

    await verifyTeachingContextAccess(quiz.teachingContextId);
    await prisma.quiz.update({ where: { id: quizId }, data: { status } });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal mengubah status quiz") };
  }
}

export async function deleteQuizAction(quizId: string) {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { teachingContextId: true },
    });
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan" };

    await verifyTeachingContextAccess(quiz.teachingContextId);
    await prisma.quiz.delete({ where: { id: quizId } });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal menghapus quiz") };
  }
}

/** Re-opens the attempt for a specific student (remedial): resets answers. */
export async function openRemedialAttemptAction(quizId: string, studentId: string) {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { teachingContextId: true, status: true },
    });
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan" };

    await verifyTeachingContextAccess(quiz.teachingContextId);

    await prisma.quizAttempt.update({
      where: { quizId_studentId: { quizId, studentId } },
      data: {
        status: "IN_PROGRESS",
        submittedAt: null,
        score: null,
        isRemedial: true,
        startedAt: new Date(),
        questionOrder: { reset: true },
        answers: { deleteMany: {} },
      },
    });

    // Mark quiz published so the student can actually re-enter.
    if (quiz.status === "CLOSED") {
      await prisma.quiz.update({ where: { id: quizId }, data: { status: "PUBLISHED" } });
    }

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal membuka remedial") };
  }
}

/** Publishes quiz scores into an existing assessment's gradebook rows. */
export async function publishScoresToAssessmentAction(quizId: string, assessmentId: string) {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { teachingContextId: true, standardScore: true },
    });
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan" };
    await verifyTeachingContextAccess(quiz.teachingContextId);

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { teachingContextId: true, maxScore: true, minimumPassingScore: true },
    });
    if (!assessment) return { success: false, error: "Penilaian tidak ditemukan" };
    if (assessment.teachingContextId !== quiz.teachingContextId) {
      return { success: false, error: "Penilaian harus berada di kelas & mapel yang sama" };
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId, status: "SUBMITTED", score: { not: null } },
      select: { studentId: true, score: true, quiz: { select: { standardScore: true } } },
    });
    if (attempts.length === 0) {
      return { success: false, error: "Belum ada attempt yang terkumpul" };
    }

    const maxScore = Number(assessment.maxScore) || 100;
    void maxScore;
    const standard = Number(quiz.standardScore ?? assessment.minimumPassingScore ?? 0);
    void standard;

    await prisma.$transaction(
      attempts.map((att) => {
        const rawScore = Number(att.score) || 0;
        const finalScore = Math.round((rawScore / 100) * maxScore * 10) / 10;
        return prisma.assessmentResult.upsert({
          where: { assessmentId_studentId: { assessmentId, studentId: att.studentId } },
          create: {
            assessmentId,
            studentId: att.studentId,
            status: "GRADED" as const,
            rawScore,
            finalScore,
          },
          update: {
            status: "GRADED" as const,
            rawScore,
            finalScore,
          },
        });
      })
    );

    return { success: true, data: { published: attempts.length } };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal menerbitkan nilai") };
  }
}

// ----------------------------------------------------------------------------
// TEACHER READ QUERIES
// ----------------------------------------------------------------------------

export async function getQuizListAction() {
  const { context } = await verifyTeachingContextAccess("__all__").catch(() => {
    throw new Error("FORBIDDEN");
  });
  void context;
}

/**
 * Lists quizzes across the teacher's teaching contexts in the active school.
 */
export async function listQuizzesAction(): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    title: string;
    status: string;
    contextLabel: string;
    questionCount: number;
    attemptCount: number;
    submittedCount: number;
    deadline?: string;
    createdAt: string;
  }>;
  error?: string;
}> {
  try {
    const { profile, activeSchoolId } = await (
      await import("@/lib/authorization")
    ).verifyActiveSchoolMembership();

    const quizzes = await prisma.quiz.findMany({
      where: { teachingContext: { teacherProfileId: profile.id, schoolId: activeSchoolId } },
      include: {
        teachingContext: {
          include: { subject: true, class: true, academicPeriod: true },
        },
        _count: { select: { questions: true, attempts: true } },
        attempts: { where: { status: "SUBMITTED" }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: quizzes.map((q) => ({
        id: q.id,
        title: q.title,
        status: q.status,
        contextLabel: `${q.teachingContext.subject.name} · ${q.teachingContext.class.name}`,
        questionCount: q._count.questions,
        attemptCount: q._count.attempts,
        submittedCount: q.attempts.length,
        deadline: q.deadline?.toISOString(),
        createdAt: q.createdAt.toISOString(),
      })),
    };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal memuat daftar quiz") };
  }
}

export async function getQuizDetailAction(quizId: string) {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        teachingContext: {
          include: {
            subject: true,
            class: {
              include: {
                classStudents: {
                  include: { student: { select: { id: true, fullName: true } } },
                },
              },
            },
            academicPeriod: true,
          },
        },
        questions: { orderBy: { order: "asc" } },
        attempts: {
          include: { student: { select: { id: true, fullName: true } } },
          orderBy: { startedAt: "desc" },
        },
      },
    });
    if (!quiz) return { success: false as const, error: "Quiz tidak ditemukan" };

    await verifyTeachingContextAccess(quiz.teachingContextId);

    const attemptedMap = new Map(quiz.attempts.map((a) => [a.studentId, a]));
    const roster = quiz.teachingContext.class.classStudents
      .filter((cs) => cs.academicPeriodId === quiz.teachingContext.academicPeriodId)
      .map((cs) => {
      const attempt = attemptedMap.get(cs.student.id);
      return {
        studentId: cs.student.id,
        fullName: cs.student.fullName,
        attemptStatus: attempt?.status ?? "NOT_STARTED",
        score: attempt?.score ? Number(attempt.score) : null,
        isRemedial: attempt?.isRemedial ?? false,
        startedAt: attempt?.startedAt.toISOString(),
        submittedAt: attempt?.submittedAt?.toISOString(),
      };
    });

    // Assessments in same context for gradebook publishing
    const assessments = await prisma.assessment.findMany({
      where: { teachingContextId: quiz.teachingContextId },
      select: { id: true, title: true, assessmentDate: true },
      orderBy: { assessmentDate: "desc" },
      take: 20,
    });

    return {
      success: true as const,
      data: {
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          status: quiz.status,
          shareToken: quiz.shareToken,
          durationMinutes: quiz.durationMinutes,
          shuffleQuestions: quiz.shuffleQuestions,
          shuffleOptions: quiz.shuffleOptions,
          standardScore: quiz.standardScore ? Number(quiz.standardScore) : null,
          deadline: quiz.deadline?.toISOString() ?? null,
        },
        contextLabel: `${quiz.teachingContext.subject.name} · ${quiz.teachingContext.class.name} · ${quiz.teachingContext.academicPeriod.year}`,
        questions: quiz.questions.map((q) => ({
          id: q.id,
          order: q.order,
          text: q.text,
          options: q.options as string[],
          correctIndex: q.correctIndex,
          points: Number(q.points),
        })),
        roster,
        assessments: assessments.map((a) => ({
          id: a.id,
          title: a.title,
          date: a.assessmentDate.toISOString(),
        })),
      },
    };
  } catch (error: unknown) {
    return { success: false as const, error: formatActionError(error, "Gagal memuat detail quiz") };
  }
}

/**
 * Replaces the quiz's question set. Safe against past attempts because each
 * attempt carries its own question snapshot.
 */
export async function updateQuizQuestionsAction(
  quizId: string,
  questions: Array<{
    text: string;
    options: string[];
    correctIndex: number;
    points: number;
    explanation?: string;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!Array.isArray(questions) || questions.length === 0) {
      return { success: false, error: "Quiz minimal memiliki 1 soal" };
    }
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { teachingContextId: true },
    });
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan" };
    await verifyTeachingContextAccess(quiz.teachingContextId);

    const validated = questions
      .map((q) =>
        quizQuestionSchema.parse({
          ...q,
          text: q.text.trim(),
          options: q.options.map((o) => o.trim()).filter((o) => o.length > 0),
        })
      )
      .filter((q) => q.text.length > 0 && q.options.length >= 2);
    if (validated.length === 0) {
      return { success: false, error: "Tidak ada soal yang valid (teks & minimal 2 opsi harus terisi)" };
    }
    if (validated.some((q) => q.correctIndex >= q.options.length)) {
      return { success: false, error: "Ada soal dengan kunci jawaban di luar daftar opsi" };
    }

    await prisma.$transaction([
      prisma.quizQuestion.deleteMany({ where: { quizId } }),
      prisma.quizQuestion.createMany({
        data: validated.map((q, idx) => ({
          quizId,
          order: idx + 1,
          type: "MULTIPLE_CHOICE" as const,
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          points: q.points,
          explanation: q.explanation,
        })),
      }),
    ]);

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal menyimpan soal") };
  }
}

/**
 * Gives every student a fresh attempt with the latest questions (used after
 * the teacher edits questions of an already-worked quiz). Old answers and
 * scores are cleared.
 */
export async function resetAllAttemptsAction(quizId: string): Promise<{
  success: boolean;
  data?: { reset: number };
  error?: string;
}> {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { teachingContextId: true },
    });
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan" };
    await verifyTeachingContextAccess(quiz.teachingContextId);

    const result = await prisma.$transaction([
      prisma.quizAnswer.deleteMany({ where: { attempt: { quizId } } }),
      prisma.quizAttempt.updateMany({
        where: { quizId },
        data: {
          status: "IN_PROGRESS",
          submittedAt: null,
          score: null,
          isRemedial: false,
          questionOrder: {},
          startedAt: new Date(),
        },
      }),
    ]);

    return { success: true, data: { reset: result[1].count } };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal membuka ulang quiz") };
  }
}

// ============================================================================
// PUBLIC STUDENT ACTIONS (token-based, no login)
// ============================================================================

async function getPublishedQuizByToken(token: string) {
  return prisma.quiz.findUnique({
    where: { shareToken: token },
    include: {
      _count: { select: { questions: true } },
      teachingContext: {
        include: {
          academicPeriod: true,
          class: {
            include: {
              classStudents: {
                include: { student: { select: { id: true, fullName: true, status: true } } },
              },
            },
          },
        },
      },
    },
  });
}

export async function getPublicQuizAction(token: string): Promise<{
  success: boolean;
  data?: PublicQuizView;
  error?: string;
}> {
  try {
    if (!token || token.length < 10) return { success: false, error: "Link quiz tidak valid" };

    const quiz = await getPublishedQuizByToken(token);
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan. Periksa kembali link dari guru." };

    const isDeadlinePassed = !!quiz.deadline && quiz.deadline.getTime() < Date.now();

    // Only students enrolled in the same academic period as the quiz context.
    const rosterStudents = quiz.teachingContext.class.classStudents
      .filter(
        (cs) =>
          cs.academicPeriodId === quiz.teachingContext.academicPeriodId &&
          cs.student.status === "ACTIVE"
      )
      .map((cs) => ({ id: cs.student.id, fullName: cs.student.fullName }));

    return {
      success: true,
      data: {
        title: quiz.title,
        description: quiz.description ?? undefined,
        durationMinutes: quiz.durationMinutes ?? undefined,
        status: quiz.status,
        isDeadlinePassed,
        standardScore: quiz.standardScore ? Number(quiz.standardScore) : undefined,
        questionCount: quiz._count.questions,
        totalPoints: 0,
        roster: rosterStudents,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal memuat quiz") };
  }
}

/**
 * Starts (or resumes) an attempt. Returns the questions in the attempt's
 * persisted shuffled order. The correct answers never leave the server here.
 */
export async function startQuizAttemptAction(
  token: string,
  studentId: string
): Promise<{
  success: boolean;
  data?: {
    quizTitle: string;
    durationMinutes?: number;
    startedAt: string;
    isRemedial: boolean;
    questions: StudentQuizQuestionView[];
  };
  error?: string;
}> {
  try {
    if (!token || token.length < 10 || !studentId) {
      return { success: false, error: "Permintaan tidak valid" };
    }

    const quiz = await getPublishedQuizByToken(token);
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan" };
    if (quiz.status !== "PUBLISHED") {
      return { success: false, error: "Quiz belum dibuka atau sudah ditutup oleh guru" };
    }
    if (quiz.deadline && quiz.deadline.getTime() < Date.now()) {
      return { success: false, error: "Batas waktu quiz sudah terlewat" };
    }

    // Student must belong to the quiz's class roster (same academic period)
    const isOnRoster = quiz.teachingContext.class.classStudents.some(
      (cs) =>
        cs.academicPeriodId === quiz.teachingContext.academicPeriodId &&
        cs.student.id === studentId
    );
    if (!isOnRoster) return { success: false, error: "Nama siswa tidak terdaftar di kelas ini" };

    const existing = await prisma.quizAttempt.findUnique({
      where: { quizId_studentId: { quizId: quiz.id, studentId } },
      include: {
        answers: { select: { questionId: true, selectedIndex: true } },
      },
    });

    if (existing?.status === "SUBMITTED") {
      return { success: false, error: "Kamu sudah mengerjakan quiz ini. Hubungi guru untuk remedial." };
    }

    let attempt = existing;
    if (!attempt) {
      attempt = await prisma.quizAttempt.create({
        data: { quizId: quiz.id, studentId, questionOrder: {} },
        include: { answers: true },
      });
    }

    // Snapshot: prefer the stored per-attempt copy (stable across teacher
    // edits); rebuild when absent or in the legacy format.
    type StoredOrder = { questions?: AttemptQuestionSnapshot[]; questionIds?: string[] };
    const stored = attempt.questionOrder as unknown as StoredOrder | null;

    if (!stored?.questions?.length) {
      const liveQuestions = await prisma.quizQuestion.findMany({
        where: { quizId: quiz.id },
        orderBy: { order: "asc" },
      });
      const snapshot = buildAttemptSnapshot(
        liveQuestions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options as string[],
          correctIndex: q.correctIndex,
          points: Number(q.points),
        })),
        quiz.shuffleQuestions,
        quiz.shuffleOptions
      );
      await prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: { questionOrder: { questions: snapshot } as unknown as Prisma.InputJsonValue },
      });
      stored!.questions = snapshot;
    }

    const view: StudentQuizQuestionView[] = stored!.questions!.map((q, idx) => ({
      id: q.id,
      order: idx + 1,
      text: q.text,
      options: q.options,
      points: q.points,
    }));

    return {
      success: true,
      data: {
        quizTitle: quiz.title,
        durationMinutes: quiz.durationMinutes ?? undefined,
        startedAt: attempt.startedAt.toISOString(),
        isRemedial: attempt.isRemedial,
        questions: view,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal memulai quiz") };
  }
}

export async function submitQuizAttemptAction(input: unknown): Promise<{
  success: boolean;
  data?: AttemptResultView;
  error?: string;
}> {
  try {
    const parsed = submitAttemptSchema.parse(input);

    const quiz = await getPublishedQuizByToken(parsed.token);
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan" };

    const attempt = await prisma.quizAttempt.findUnique({
      where: { quizId_studentId: { quizId: quiz.id, studentId: parsed.studentId } },
      include: { answers: true },
    });
    if (!attempt) return { success: false, error: "Attempt tidak ditemukan" };
    if (attempt.status === "SUBMITTED") {
      return { success: false, error: "Attempt ini sudah dikumpulkan" };
    }
    if (isAttemptExpired(attempt.startedAt, quiz.durationMinutes)) {
      return { success: false, error: "Waktu pengerjaan sudah habis. Hubungi gurumu." };
    }

    // Grade against the attempt's snapshot (stable even if the teacher edits
    // questions afterwards). A missing snapshot means the attempt was reset by
    // the teacher while this page was still open — grading against live
    // questions in master order would repeat the shuffle-mismatch bug, so we
    // ask the student to restart instead.
    type StoredOrder = { questions?: AttemptQuestionSnapshot[] };
    const stored = attempt.questionOrder as unknown as StoredOrder | null;
    if (!stored?.questions?.length) {
      return {
        success: false,
        error:
          "Quiz diperbarui oleh guru saat kamu sedang mengerjakan. Muat ulang halaman dan mulai dari awal — jawabanmu sebelumnya tidak dapat dikoreksi dengan adil.",
      };
    }
    const snapshot = stored.questions;

    const { score, totalPoints, perQuestion } = gradeAttempt(
      snapshot.map((q) => ({
        id: q.id,
        correctIndex: q.correctIndex,
        points: q.points,
      })),
      parsed.answers
    );

    const normalized = normalizeScore(score, totalPoints);

    const liveQuestionIds = new Set(
      (
        await prisma.quizQuestion.findMany({
          where: { quizId: quiz.id },
          select: { id: true },
        })
      ).map((q) => q.id)
    );
    const gradableAnswers = perQuestion.filter((pq) => liveQuestionIds.has(pq.questionId));

    await prisma.$transaction([
      ...gradableAnswers.map((pq) =>
        prisma.quizAnswer.upsert({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: pq.questionId } },
          create: {
            attemptId: attempt.id,
            questionId: pq.questionId,
            selectedIndex: pq.selectedIndex ?? undefined,
            isCorrect: pq.isCorrect ?? undefined,
          },
          update: {
            selectedIndex: pq.selectedIndex ?? undefined,
            isCorrect: pq.isCorrect ?? undefined,
          },
        })
      ),
      prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          score: normalized,
        },
      }),
    ]);

    const standard = quiz.standardScore ? Number(quiz.standardScore) : null;
    const snapshotMap = new Map(snapshot.map((q) => [q.id, q]));

    return {
      success: true,
      data: {
        score: normalized,
        totalPoints,
        passed: standard === null ? true : normalized >= standard,
        isRemedial: attempt.isRemedial,
        submittedAt: new Date().toISOString(),
        perQuestion: perQuestion.map((pq) => ({
          questionText: snapshotMap.get(pq.questionId)?.text ?? "",
          selectedIndex: pq.selectedIndex,
          isCorrect: pq.isCorrect,
          pointsEarned: pq.pointsEarned,
          pointsMax: pq.pointsMax,
        })),
      },
    };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal mengumpulkan jawaban") };
  }
}

export async function getAttemptResultAction(
  token: string,
  studentId: string
): Promise<{ success: boolean; data?: AttemptResultView; error?: string }> {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { shareToken: token },
      select: { id: true, standardScore: true },
    });
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan" };

    const attempt = await prisma.quizAttempt.findUnique({
      where: { quizId_studentId: { quizId: quiz.id, studentId } },
      include: { answers: true },
    });
    if (!attempt || attempt.status !== "SUBMITTED") {
      return { success: false, error: "Hasil belum tersedia" };
    }

    type StoredOrder = { questions?: AttemptQuestionSnapshot[] };
    const stored = attempt.questionOrder as unknown as StoredOrder | null;
    const snapshot = stored?.questions?.length
      ? stored.questions
      : (
          await prisma.quizQuestion.findMany({
            where: { quizId: quiz.id },
            orderBy: { order: "asc" },
          })
        ).map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options as string[],
          correctIndex: q.correctIndex,
          points: Number(q.points),
        }));

    const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a.selectedIndex]));
    const perQuestion = snapshot.map((q) => {
      const selected = answerMap.get(q.id) ?? null;
      const isCorrect = q.correctIndex !== null && selected === q.correctIndex;
      return {
        questionText: q.text,
        selectedIndex: selected,
        isCorrect,
        pointsEarned: isCorrect ? q.points : 0,
        pointsMax: q.points,
      };
    });

    const standard = quiz.standardScore ? Number(quiz.standardScore) : null;
    const score = attempt.score ? Number(attempt.score) : 0;

    return {
      success: true,
      data: {
        score,
        totalPoints: 100,
        passed: standard === null ? true : score >= standard,
        isRemedial: attempt.isRemedial,
        submittedAt: attempt.submittedAt?.toISOString() ?? "",
        perQuestion,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal memuat hasil") };
  }
}
