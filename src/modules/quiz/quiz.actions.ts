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
import { verifyStudentSession } from "@/modules/student-auth/student-session";
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
  reconstructLegacySnapshot,
  generateUniquePins,
  generateClassroomPin,
  normalizePin,
  checkPinRateLimit,
  recordPinFailure,
  resetPinRateLimit,
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

    // Sanitize: validate MCQ (min 2 options) and ESSAY/SHORT_ANSWER (text required).
    const sanitizedQuestions = parsed.questions
      .map((q) => {
        const qType = q.type ?? "MULTIPLE_CHOICE";
        const cleanedOpts = q.options.map((o) => o.trim()).filter((o) => o.length > 0);
        return {
          ...q,
          type: qType,
          text: q.text.trim(),
          options: qType === "MULTIPLE_CHOICE" ? cleanedOpts : [],
          correctIndex: qType === "MULTIPLE_CHOICE" ? q.correctIndex : null,
        };
      })
      .filter((q) => {
        if (q.type === "MULTIPLE_CHOICE") {
          return q.text.length > 0 && q.options.length >= 2;
        }
        return q.text.length > 0;
      });

    if (sanitizedQuestions.length === 0) {
      return { success: false, error: "Tidak ada soal yang valid untuk disimpan" };
    }

    const classroomPin =
      parsed.accessMode === "CLASSROOM_PIN" ? generateClassroomPin() : undefined;

    const quiz = await prisma.quiz.create({
      data: {
        teachingContextId: parsed.teachingContextId,
        title: parsed.title,
        description: parsed.description,
        durationMinutes: parsed.durationMinutes,
        shuffleQuestions: parsed.shuffleQuestions,
        shuffleOptions: parsed.shuffleOptions,
        standardScore: parsed.standardScore,
        validFrom: parsed.validFrom ? new Date(parsed.validFrom) : undefined,
        deadline: parsed.deadline ? new Date(parsed.deadline) : undefined,
        accessMode: parsed.accessMode,
        classroomPin,
        shareToken: generateShareToken(),
        questions: {
          create: sanitizedQuestions.map((q, idx) => ({
            order: idx + 1,
            type: q.type,
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

    const classroomPin =
      parsed.accessMode === "CLASSROOM_PIN"
        ? (await prisma.quiz.findUnique({ where: { id: parsed.quizId }, select: { classroomPin: true } }))?.classroomPin || generateClassroomPin()
        : undefined;

    await prisma.quiz.update({
      where: { id: parsed.quizId },
      data: {
        title: parsed.title,
        description: parsed.description,
        durationMinutes: parsed.durationMinutes,
        shuffleQuestions: parsed.shuffleQuestions,
        shuffleOptions: parsed.shuffleOptions,
        standardScore: parsed.standardScore,
        validFrom: parsed.validFrom ? new Date(parsed.validFrom) : null,
        deadline: parsed.deadline ? new Date(parsed.deadline) : null,
        accessMode: parsed.accessMode,
        ...(classroomPin ? { classroomPin } : {}),
      },
    });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal memperbarui pengaturan quiz") };
  }
}

/**
 * Ensures every roster student of the quiz's class (same academic period)
 * has a PIN. Lazy: called when publishing and when students open the link.
 */
async function ensureQuizStudentAccesses(quizId: string): Promise<void> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      accessMode: true,
      classroomPin: true,
      teachingContext: {
        select: {
          academicPeriodId: true,
          class: {
            select: {
              classStudents: {
                select: {
                  studentId: true,
                  academicPeriodId: true,
                  student: { select: { status: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!quiz) return;

  // If classroom pin mode, ensure classroomPin exists
  if (quiz.accessMode === "CLASSROOM_PIN" && !quiz.classroomPin) {
    await prisma.quiz.update({
      where: { id: quizId },
      data: { classroomPin: generateClassroomPin() },
    });
  }

  // If individual pin mode, ensure unique pins exist for each student
  if (quiz.accessMode === "INDIVIDUAL_PIN") {
    const rosterIds = quiz.teachingContext.class.classStudents
      .filter((cs) => cs.academicPeriodId === quiz.teachingContext.academicPeriodId)
      .filter((cs) => cs.student.status === "ACTIVE")
      .map((cs) => cs.studentId);

    const existing = await prisma.quizStudentAccess.findMany({
      where: { quizId, studentId: { in: rosterIds } },
      select: { studentId: true, pin: true },
    });
    const existingMap = new Map(existing.map((e) => [e.studentId, e.pin]));
    const missing = rosterIds.filter((id) => !existingMap.has(id));
    if (missing.length > 0) {
      const pins = generateUniquePins(missing.length, new Set(existing.map((e) => e.pin)));
      await prisma.quizStudentAccess.createMany({
        data: missing.map((studentId, i) => ({ quizId, studentId, pin: pins[i] })),
      });
    }
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

    if (status === "PUBLISHED") {
      await ensureQuizStudentAccesses(quizId);
    }

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
        studentAccesses: { select: { studentId: true, pin: true } },
      },
    });
    if (!quiz) return { success: false as const, error: "Quiz tidak ditemukan" };

    await verifyTeachingContextAccess(quiz.teachingContextId);

    const attemptedMap = new Map(quiz.attempts.map((a) => [a.studentId, a]));
    const pinMap = new Map(quiz.studentAccesses.map((a) => [a.studentId, a.pin]));
    // Teacher adds students / reopens after publish → ensure PINs exist.
    await ensureQuizStudentAccesses(quiz.id);
    const refreshedAccesses = await prisma.quizStudentAccess.findMany({
      where: { quizId: quiz.id },
      select: { studentId: true, pin: true },
    });
    for (const a of refreshedAccesses) pinMap.set(a.studentId, a.pin);
    const roster = quiz.teachingContext.class.classStudents
      .filter((cs) => cs.academicPeriodId === quiz.teachingContext.academicPeriodId)
      .map((cs) => {
      const attempt = attemptedMap.get(cs.student.id);
      return {
        studentId: cs.student.id,
        fullName: cs.student.fullName,
        pin: pinMap.get(cs.student.id) ?? null,
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
          validFrom: quiz.validFrom?.toISOString() ?? null,
          deadline: quiz.deadline?.toISOString() ?? null,
          accessMode: quiz.accessMode,
          classroomPin: quiz.classroomPin,
        },
        contextLabel: `${quiz.teachingContext.subject.name} · ${quiz.teachingContext.class.name} · ${quiz.teachingContext.academicPeriod.year}`,
        questions: quiz.questions.map((q) => ({
          id: q.id,
          order: q.order,
          type: q.type,
          text: q.text,
          options: q.options as string[],
          correctIndex: q.correctIndex,
          points: Number(q.points),
          explanation: q.explanation ?? undefined,
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
    type?: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "ESSAY";
    text: string;
    options: string[];
    correctIndex?: number | null;
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
      .map((q) => {
        const qType = q.type ?? "MULTIPLE_CHOICE";
        const cleanedOpts = q.options.map((o) => o.trim()).filter((o) => o.length > 0);
        return quizQuestionSchema.parse({
          ...q,
          type: qType,
          text: q.text.trim(),
          options: qType === "MULTIPLE_CHOICE" ? cleanedOpts : [],
          correctIndex: qType === "MULTIPLE_CHOICE" ? q.correctIndex : null,
        });
      })
      .filter((q) => {
        if (q.type === "MULTIPLE_CHOICE") {
          return q.text.length > 0 && q.options.length >= 2;
        }
        return q.text.length > 0;
      });

    if (validated.length === 0) {
      return { success: false, error: "Tidak ada soal yang valid untuk disimpan" };
    }
    if (
      validated.some(
        (q) =>
          q.type === "MULTIPLE_CHOICE" &&
          (q.correctIndex === null || q.correctIndex === undefined || q.correctIndex >= q.options.length)
      )
    ) {
      return { success: false, error: "Ada soal pilihan ganda dengan kunci jawaban tidak valid" };
    }

    await prisma.$transaction([
      prisma.quizQuestion.deleteMany({ where: { quizId } }),
      prisma.quizQuestion.createMany({
        data: validated.map((q, idx) => ({
          quizId,
          order: idx + 1,
          type: q.type,
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
 * Teacher: per-question analytics across all submitted attempts — correct
 * rate per question and answer distribution (aggregated by option text, so
 * per-student option shuffling doesn't skew the tally).
 */
export async function getQuizAnalyticsAction(quizId: string): Promise<{
  success: boolean;
  data?: {
    totalSubmitted: number;
    questions: Array<{
      id: string;
      order: number;
      text: string;
      attemptedCount: number;
      correctCount: number;
      correctRate: number;
      optionDistribution: Array<{ text: string; count: number; isCorrect: boolean }>;
      unansweredCount: number;
    }>;
  };
  error?: string;
}> {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { teachingContextId: true },
    });
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan" };
    await verifyTeachingContextAccess(quiz.teachingContextId);

    const questions = await prisma.quizQuestion.findMany({
      where: { quizId },
      orderBy: { order: "asc" },
    });
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId, status: "SUBMITTED" },
      include: { answers: true },
    });

    type Tally = {
      attemptedCount: number;
      correctCount: number;
      unansweredCount: number;
      optionCounts: Map<string, number>;
    };
    const tallies = new Map<string, Tally>();
    for (const q of questions) {
      tallies.set(q.id, {
        attemptedCount: 0,
        correctCount: 0,
        unansweredCount: 0,
        optionCounts: new Map(),
      });
    }

    for (const att of attempts) {
      type StoredOrder = { questions?: AttemptQuestionSnapshot[] };
      const stored = att.questionOrder as unknown as StoredOrder | null;
      if (!stored?.questions?.length) continue; // legacy attempts are regraded via reset

      const answerMap = new Map(att.answers.map((a) => [a.questionId, a.selectedIndex]));

      for (const snapQ of stored.questions) {
        const tally = tallies.get(snapQ.id);
        if (!tally) continue; // question deleted by teacher after this attempt
        const sel = answerMap.has(snapQ.id) ? answerMap.get(snapQ.id)! : null;

        if (sel === null) {
          tally.unansweredCount++;
          continue;
        }
        tally.attemptedCount++;
        const isCorrect = snapQ.correctIndex !== null && sel === snapQ.correctIndex;
        if (isCorrect) tally.correctCount++;

        const selectedText = snapQ.options[sel] ?? "(opsi tidak dikenal)";
        tally.optionCounts.set(selectedText, (tally.optionCounts.get(selectedText) ?? 0) + 1);
      }
    }

    const totalSubmitted = attempts.length;
    return {
      success: true,
      data: {
        totalSubmitted,
        questions: questions.map((q) => {
          const tally = tallies.get(q.id)!;
          const rate =
            tally.attemptedCount > 0
              ? Math.round((tally.correctCount / tally.attemptedCount) * 100)
              : 0;
          return {
            id: q.id,
            order: q.order,
            text: q.text,
            attemptedCount: tally.attemptedCount,
            correctCount: tally.correctCount,
            correctRate: rate,
            unansweredCount: tally.unansweredCount,
            optionDistribution: (q.options as string[]).map((text) => ({
              text,
              count: tally.optionCounts.get(text) ?? 0,
              isCorrect: q.correctIndex !== null && (q.options as string[])[q.correctIndex] === text,
            })),
          };
        }),
      },
    };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal memuat analitik") };
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

type StoredAttemptOrder = { questions?: AttemptQuestionSnapshot[]; questionIds?: string[]; optionOrders?: Record<string, number[]> };

/**
 * Resolves the snapshot an attempt was taken against. Priority: stored
 * snapshot > legacy reconstruction (questionIds + optionOrders) > live
 * questions (last resort, only correct when options were never shuffled).
 */
async function resolveAttemptSnapshot(
  attempt: { questionOrder: unknown },
  quizId: string
): Promise<AttemptQuestionSnapshot[]> {
  const stored = attempt.questionOrder as StoredAttemptOrder | null;
  if (stored?.questions?.length) return stored.questions;

  const liveQuestions = await prisma.quizQuestion.findMany({
    where: { quizId },
    orderBy: { order: "asc" },
  });
  const live = liveQuestions.map((q) => ({
    id: q.id,
    type: q.type,
    text: q.text,
    options: q.options as string[],
    correctIndex: q.correctIndex,
    points: Number(q.points),
    explanation: q.explanation ?? undefined,
  }));

  if (stored?.questionIds?.length && stored.optionOrders) {
    return reconstructLegacySnapshot(
      { questionIds: stored.questionIds, optionOrders: stored.optionOrders },
      live
    );
  }
  return live;
}

/**
 * Teacher: full answer sheet of one student's submitted attempt, from the
 * attempt's own snapshot (exactly what the student saw).
 */
export async function getStudentAttemptDetailAction(quizId: string, studentId: string): Promise<{
  success: boolean;
  data?: {
    attemptId: string;
    attemptStatus: string;
    studentName: string;
    score: number;
    submittedAt: string;
    isRemedial: boolean;
    perQuestion: Array<{
      questionId: string;
      type: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "ESSAY";
      questionText: string;
      options: string[];
      selectedIndex: number | null;
      essayAnswer: string | null;
      correctIndex: number | null;
      pointsEarned: number;
      pointsMax: number;
      explanation: string | null;
      scoreAwarded: number | null;
      feedback: string | null;
    }>;
  };
  error?: string;
}> {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { teachingContextId: true, standardScore: true },
    });
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan" };
    await verifyTeachingContextAccess(quiz.teachingContextId);

    const attempt = await prisma.quizAttempt.findUnique({
      where: { quizId_studentId: { quizId, studentId } },
      include: { answers: true, student: { select: { fullName: true } } },
    });
    if (!attempt || (attempt.status !== "SUBMITTED" && attempt.status !== "NEEDS_GRADING")) {
      return { success: false, error: "Siswa ini belum menyelesaikan quiz" };
    }

    const snapshot = await resolveAttemptSnapshot(attempt, quizId);

    const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

    return {
      success: true,
      data: {
        attemptId: attempt.id,
        attemptStatus: attempt.status,
        studentName: attempt.student.fullName,
        score: attempt.score ? Number(attempt.score) : 0,
        submittedAt: attempt.submittedAt?.toISOString() ?? "",
        isRemedial: attempt.isRemedial,
        perQuestion: snapshot.map((q) => {
          const ans = answerMap.get(q.id);
          const sel = ans?.selectedIndex !== undefined ? ans.selectedIndex : null;
          const essay = ans?.essayAnswer ?? null;
          const manualScore = ans?.score !== null && ans?.score !== undefined ? Number(ans.score) : null;
          const feedback = ans?.feedback ?? null;

          const isMcq = q.type === "MULTIPLE_CHOICE" || !q.type;
          const isCorrect = isMcq
            ? (q.correctIndex !== null && sel === q.correctIndex)
            : (manualScore !== null ? manualScore > 0 : null);
          const pointsEarned = isMcq
            ? (isCorrect ? q.points : 0)
            : (manualScore ?? 0);

          return {
            questionId: q.id,
            type: q.type ?? "MULTIPLE_CHOICE",
            questionText: q.text,
            options: q.options,
            selectedIndex: sel,
            essayAnswer: essay,
            correctIndex: q.correctIndex,
            pointsEarned,
            pointsMax: q.points,
            explanation: q.explanation ?? null,
            scoreAwarded: manualScore,
            feedback,
          };
        }),
      },
    };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal memuat jawaban siswa") };
  }
}

/**
 * Teacher: manually grades a student's essay / short answer questions.
 * Updates points awarded, optional feedback, recalculates total attempt score,
 * and updates attempt status to SUBMITTED once all essays are graded.
 */
export async function gradeStudentEssayAction(
  quizId: string,
  studentId: string,
  grades: Array<{
    questionId: string;
    scoreAwarded: number;
    feedback?: string;
  }>
): Promise<{ success: boolean; data?: { finalScore: number }; error?: string }> {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { teachingContextId: true, standardScore: true },
    });
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan" };
    await verifyTeachingContextAccess(quiz.teachingContextId);

    const attempt = await prisma.quizAttempt.findUnique({
      where: { quizId_studentId: { quizId, studentId } },
      include: { answers: true },
    });
    if (!attempt) return { success: false, error: "Attempt tidak ditemukan" };

    const snapshot = await resolveAttemptSnapshot(attempt, quizId);

    // 1. Update each graded essay question answer in database
    await prisma.$transaction(
      grades.map((g) =>
        prisma.quizAnswer.updateMany({
          where: { attemptId: attempt.id, questionId: g.questionId },
          data: {
            score: g.scoreAwarded,
            feedback: g.feedback?.trim() || null,
            isCorrect: g.scoreAwarded > 0,
          },
        })
      )
    );

    // 2. Fetch updated answers and recalculate total score
    const updatedAnswers = await prisma.quizAnswer.findMany({
      where: { attemptId: attempt.id },
    });
    const updatedAnswerMap = new Map(updatedAnswers.map((a) => [a.questionId, a]));

    let totalPoints = 0;
    let totalScore = 0;
    let allEssaysGraded = true;

    for (const q of snapshot) {
      const max = Number(q.points) || 0;
      totalPoints += max;
      const ans = updatedAnswerMap.get(q.id);

      if (q.type === "ESSAY" || q.type === "SHORT_ANSWER") {
        if (ans?.score !== null && ans?.score !== undefined) {
          totalScore += Number(ans.score);
        } else {
          allEssaysGraded = false;
        }
      } else {
        // MCQ
        if (ans?.isCorrect) {
          totalScore += max;
        }
      }
    }

    const normalized = normalizeScore(totalScore, totalPoints);

    await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        score: normalized,
        status: allEssaysGraded ? "SUBMITTED" : "NEEDS_GRADING",
      },
    });

    return { success: true, data: { finalScore: normalized } };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal menyimpan nilai esai") };
  }
}

// ============================================================================
// PUBLIC STUDENT ACTIONS (token-based, no login)
// ============================================================================

async function getPublishedQuizByToken(token: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { shareToken: token },
    include: {
      _count: { select: { questions: true } },
      teachingContext: {
        include: {
          academicPeriod: true,
          class: {
            include: {
              school: { select: { deactivatedAt: true } }, // Story 5 G-4 — fail-closed
              classStudents: {
                include: { student: { select: { id: true, fullName: true, status: true } } },
              },
            },
          },
        },
      },
    },
  });

  // Story 5 G-4: sekolah nonaktif → kuis publik /q/[token] fail-closed.
  // Mengembalikan null = jalur "tidak ditemukan" generik di semua pemanggil —
  // tanpa membocorkan status sekolah.
  if (quiz?.teachingContext?.class?.school?.deactivatedAt) {
    return null;
  }

  return quiz;
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

    const isUpcoming = !!quiz.validFrom && quiz.validFrom.getTime() > Date.now();
    const isDeadlinePassed = !!quiz.deadline && quiz.deadline.getTime() < Date.now();

    // Lazy-ensure PINs exist so students are always verifiable.
    if (quiz.status === "PUBLISHED") {
      await ensureQuizStudentAccesses(quiz.id);
    }

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
        isUpcoming,
        validFrom: quiz.validFrom?.toISOString(),
        deadline: quiz.deadline?.toISOString(),
        isDeadlinePassed,
        standardScore: quiz.standardScore ? Number(quiz.standardScore) : undefined,
        questionCount: quiz._count.questions,
        totalPoints: 0,
        pinRequired: true,
        accessMode: quiz.accessMode,
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
  studentId: string,
  pin?: string
): Promise<{
  success: boolean;
  data?: {
    quizTitle: string;
    durationMinutes: number | undefined;
    startedAt: string;
    isRemedial: boolean;
    questions: StudentQuizQuestionView[];
  };
  alreadySubmitted?: boolean;
  wrongPin?: boolean;
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
    if (quiz.validFrom && quiz.validFrom.getTime() > Date.now()) {
      return { success: false, error: "Ujian belum dimulai. Silakan tunggu jadwal mulai ujian." };
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

    // PIN verification — prevents impersonating a classmate.
    const rateLimitKey = `${quiz.id}:${studentId}`;
    const rateLimit = checkPinRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return {
        success: false,
        wrongPin: true,
        error: `Terlalu banyak percobaan PIN salah. Tunggu ${rateLimit.remainingSeconds} detik sebelum mencoba lagi.`,
      };
    }

    if (quiz.accessMode === "CLASSROOM_PIN") {
      let roomPin = quiz.classroomPin;
      if (!roomPin) {
        await ensureQuizStudentAccesses(quiz.id);
        const refreshed = await prisma.quiz.findUnique({ where: { id: quiz.id }, select: { classroomPin: true } });
        roomPin = refreshed?.classroomPin ?? null;
      }
      if (!roomPin || normalizePin(pin ?? "") !== normalizePin(roomPin)) {
        recordPinFailure(rateLimitKey);
        return {
          success: false,
          wrongPin: true,
          error: "Kode kelas salah. Periksa kembali kode di papan tulis atau layar proyektor.",
        };
      }
    } else {
      // INDIVIDUAL_PIN
      const access = await prisma.quizStudentAccess.findUnique({
        where: { quizId_studentId: { quizId: quiz.id, studentId } },
        select: { pin: true },
      });
      if (!access) {
        // Rare race: link opened before PINs were ensured.
        await ensureQuizStudentAccesses(quiz.id);
        return { success: false, error: "Sesi verifikasi diperbarui. Silakan coba lagi." };
      }
      if (normalizePin(pin ?? "") !== normalizePin(access.pin)) {
        recordPinFailure(rateLimitKey);
        return { success: false, wrongPin: true, error: "PIN salah. Periksa kembali PIN dari gurumu." };
      }
    }

    // Success: clear rate limit counter
    resetPinRateLimit(rateLimitKey);

    const existing = await prisma.quizAttempt.findUnique({
      where: { quizId_studentId: { quizId: quiz.id, studentId } },
      include: {
        answers: { select: { questionId: true, selectedIndex: true } },
      },
    });

    if (existing?.status === "SUBMITTED") {
      return {
        success: false,
        alreadySubmitted: true,
        error: "Kamu sudah mengerjakan quiz ini. Hubungi guru untuk remedial.",
      };
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
      type: q.type ?? "MULTIPLE_CHOICE",
      text: q.text,
      options: q.options,
      points: q.points,
    }));

    // Server-Authoritative Duration Clamping (Sprint 2.1)
    let effectiveDuration = quiz.durationMinutes ?? undefined;
    if (quiz.deadline) {
      const msLeft = quiz.deadline.getTime() - attempt.startedAt.getTime();
      const minutesLeft = Math.max(1, Math.floor(msLeft / 60_000));
      if (effectiveDuration) {
        effectiveDuration = Math.min(effectiveDuration, minutesLeft);
      } else {
        effectiveDuration = minutesLeft;
      }
    }

    return {
      success: true,
      data: {
        quizTitle: quiz.title,
        durationMinutes: effectiveDuration,
        startedAt: attempt.startedAt.toISOString(),
        isRemedial: attempt.isRemedial,
        questions: view,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal memulai quiz") };
  }
}

/**
 * Public: lets a student who already submitted review their own result.
 * Shows correctness marks but never reveals the correct answer key
 * (per PRD: dibahas guru di kelas).
 */
export async function getPublicAttemptResultAction(
  token: string,
  studentId: string
): Promise<{
  success: boolean;
  data?: {
    score: number;
    passed: boolean;
    isRemedial: boolean;
    needsGrading: boolean;
    submittedAt: string;
    perQuestion: Array<{
      questionText: string;
      selectedOptionText: string | null;
      isCorrect: boolean | null;
      pointsEarned: number;
      pointsMax: number;
    }>;
  };
  error?: string;
}> {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { shareToken: token },
      select: {
        id: true,
        standardScore: true,
        teachingContext: {
          select: { class: { select: { school: { select: { deactivatedAt: true } } } } }, // Story 5 VG-5/G-4
        },
      },
    });
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan" };

    // VG-5 (G-4): hasil/pembahasan publik juga fail-closed saat sekolah nonaktif.
    if (quiz.teachingContext?.class?.school?.deactivatedAt) {
      return { success: false, error: "Quiz tidak ditemukan" };
    }

    const attempt = await prisma.quizAttempt.findUnique({
      where: { quizId_studentId: { quizId: quiz.id, studentId } },
      include: { answers: true },
    });
    if (!attempt || (attempt.status !== "SUBMITTED" && attempt.status !== "NEEDS_GRADING")) {
      return { success: false, error: "Hasil belum tersedia" };
    }

    const snapshot = await resolveAttemptSnapshot(attempt, quiz.id);

    const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a.selectedIndex]));

    return {
      success: true,
      data: {
        score: attempt.score ? Number(attempt.score) : 0,
        passed: quiz.standardScore === null ? true : (attempt.score ? Number(attempt.score) : 0) >= Number(quiz.standardScore),
        isRemedial: attempt.isRemedial,
        needsGrading: attempt.status === "NEEDS_GRADING",
        submittedAt: attempt.submittedAt?.toISOString() ?? "",
        perQuestion: snapshot.map((q) => {
          const sel = answerMap.has(q.id) ? answerMap.get(q.id)! : null;
          const isCorrect = q.correctIndex !== null && sel === q.correctIndex;
          return {
            questionText: q.text,
            selectedOptionText: sel !== null ? (q.options[sel] ?? null) : null,
            isCorrect: q.correctIndex === null ? null : isCorrect,
            pointsEarned: isCorrect ? q.points : 0,
            pointsMax: q.points,
          };
        }),
      },
    };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal memuat hasil") };
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
    if (isAttemptExpired(attempt.startedAt, quiz.durationMinutes, quiz.deadline)) {
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

    const { score, totalPoints, hasEssays, perQuestion } = gradeAttempt(
      snapshot.map((q) => ({
        id: q.id,
        type: q.type,
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
            essayAnswer: pq.essayAnswer ?? undefined,
            isCorrect: pq.isCorrect ?? undefined,
          },
          update: {
            selectedIndex: pq.selectedIndex ?? undefined,
            essayAnswer: pq.essayAnswer ?? undefined,
            isCorrect: pq.isCorrect ?? undefined,
          },
        })
      ),
      prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: hasEssays ? "NEEDS_GRADING" : "SUBMITTED",
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
        needsGrading: hasEssays,
        submittedAt: new Date().toISOString(),
        perQuestion: perQuestion.map((pq) => ({
          questionText: snapshotMap.get(pq.questionId)?.text ?? "",
          type: pq.type,
          selectedIndex: pq.selectedIndex,
          essayAnswer: pq.essayAnswer,
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
      select: {
        id: true,
        standardScore: true,
        teachingContext: {
          select: { class: { select: { school: { select: { deactivatedAt: true } } } } }, // Story 5 VG-5/G-4
        },
      },
    });
    if (!quiz) return { success: false, error: "Quiz tidak ditemukan" };

    // VG-5 (G-4): hasil/pembahasan publik juga fail-closed saat sekolah nonaktif.
    if (quiz.teachingContext?.class?.school?.deactivatedAt) {
      return { success: false, error: "Quiz tidak ditemukan" };
    }

    const attempt = await prisma.quizAttempt.findUnique({
      where: { quizId_studentId: { quizId: quiz.id, studentId } },
      include: { answers: true },
    });
    if (!attempt || (attempt.status !== "SUBMITTED" && attempt.status !== "NEEDS_GRADING")) {
      return { success: false, error: "Hasil belum tersedia" };
    }

    const snapshot = await resolveAttemptSnapshot(attempt, quiz.id);

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
        needsGrading: attempt.status === "NEEDS_GRADING",
        submittedAt: attempt.submittedAt?.toISOString() ?? "",
        perQuestion,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal memuat hasil") };
  }
}

// ============================================================================
// STUDENT PORTAL QUIZ ACTIONS (CAP-6, B1, F3, F4, F6, F7, D1, D3, D4)
// ============================================================================

/**
 * Mengambil daftar kuis untuk portal siswa: kuis aktif dan riwayat selesai.
 */
export async function getStudentQuizListAction(): Promise<{
  success: boolean;
  data?: {
    activeQuizzes: Array<{
      id: string;
      title: string;
      shareToken: string;
      subjectName: string;
      teacherName: string;
      durationMinutes: number | null;
      deadline: string | null;
      attemptStatus: "IN_PROGRESS" | "SUBMITTED" | "NEEDS_GRADING" | null;
      score: number | null;
    }>;
    completedQuizzes: Array<{
      id: string;
      title: string;
      shareToken: string;
      subjectName: string;
      teacherName: string;
      score: number | null;
      submittedAt: string | null;
    }>;
  };
  error?: string;
}> {
  try {
    const session = await verifyStudentSession();
    if (!session) {
      return { success: false, error: "Sesi tidak valid." };
    }

    const student = await prisma.student.findUnique({
      where: { id: session.studentId },
      include: {
        classMemberships: {
          include: {
            academicPeriod: { select: { status: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const activeMembership = student?.classMemberships.find(
      (cm) => cm.academicPeriod.status === "ACTIVE"
    ) || student?.classMemberships[0];

    if (!activeMembership) {
      return { success: true, data: { activeQuizzes: [], completedQuizzes: [] } };
    }

    const quizzes = await prisma.quiz.findMany({
      where: {
        status: "PUBLISHED",
        teachingContext: {
          classId: activeMembership.classId,
          academicPeriodId: activeMembership.academicPeriodId,
        },
      },
      include: {
        teachingContext: {
          include: {
            subject: { select: { name: true } },
            teacherProfile: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
        },
        attempts: {
          where: { studentId: session.studentId },
          select: {
            id: true,
            status: true,
            score: true,
            submittedAt: true,
          },
          take: 1,
        },
      },
      orderBy: [
        { deadline: "asc" },
        { createdAt: "desc" },
      ],
    });

    const activeQuizzes: any[] = [];
    const completedQuizzes: any[] = [];

    for (const q of quizzes) {
      const attempt = q.attempts[0];
      const isCompleted = attempt && (attempt.status === "SUBMITTED" || attempt.status === "NEEDS_GRADING");

      if (isCompleted) {
        completedQuizzes.push({
          id: q.id,
          title: q.title,
          shareToken: q.shareToken,
          subjectName: q.teachingContext.subject.name,
          teacherName: q.teachingContext.teacherProfile.user.name || "Guru Pengampu",
          score: attempt.score ? Number(attempt.score) : null,
          submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
        });
      } else {
        activeQuizzes.push({
          id: q.id,
          title: q.title,
          shareToken: q.shareToken,
          subjectName: q.teachingContext.subject.name,
          teacherName: q.teachingContext.teacherProfile.user.name || "Guru Pengampu",
          durationMinutes: q.durationMinutes,
          deadline: q.deadline ? q.deadline.toISOString() : null,
          attemptStatus: attempt ? attempt.status : null,
          score: attempt?.score ? Number(attempt.score) : null,
        });
      }
    }

    return {
      success: true,
      data: { activeQuizzes, completedQuizzes },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat daftar kuis.",
    };
  }
}

/**
 * Memulai atau melanjutkan attempt kuis dari portal siswa.
 * Identitas siswa diderivasi murni dari sesi server (Amendum B1).
 * Parameter client diabaikan, bypass classroom PIN, sanitasi kunci jawaban (F6),
 * proteksi P2002 double-start via upsert/catch (D1).
 */
export async function startQuizAttemptFromSessionAction(token: string): Promise<{
  success: boolean;
  data?: {
    attemptId: string;
    quizTitle: string;
    durationMinutes: number | undefined;
    startedAt: string;
    isRemedial: boolean;
    questions: StudentQuizQuestionView[];
    savedAnswers: Array<{ questionId: string; selectedIndex: number | null; essayAnswer: string | null }>;
  };
  alreadySubmitted?: boolean;
  error?: string;
}> {
  try {
    const session = await verifyStudentSession();
    if (!session) {
      return { success: false, error: "Sesi tidak valid atau telah berakhir." };
    }

    const studentId = session.studentId;

    if (!token || token.length < 10) {
      return { success: false, error: "Token kuis tidak valid." };
    }

    const quiz = await getPublishedQuizByToken(token);
    if (!quiz) return { success: false, error: "Kuis tidak ditemukan." };
    if (quiz.status !== "PUBLISHED") {
      return { success: false, error: "Kuis belum dibuka atau sudah ditutup oleh guru." };
    }
    if (quiz.validFrom && quiz.validFrom.getTime() > Date.now()) {
      return { success: false, error: "Ujian belum dimulai. Silakan tunggu jadwal mulai ujian." };
    }
    if (quiz.deadline && quiz.deadline.getTime() < Date.now()) {
      return { success: false, error: "Batas waktu kuis sudah terlewat." };
    }

    // Roster Check: Pastikan siswa terdaftar di rombel kuis pada periode akademik yang sama
    const isOnRoster = quiz.teachingContext.class.classStudents.some(
      (cs) =>
        cs.academicPeriodId === quiz.teachingContext.academicPeriodId &&
        cs.student.id === studentId
    );
    if (!isOnRoster) {
      return { success: false, error: "Nama siswa tidak terdaftar di kelas untuk kuis ini." };
    }

    // Cek attempt yang sudah ada
    let attempt = await prisma.quizAttempt.findUnique({
      where: { quizId_studentId: { quizId: quiz.id, studentId } },
      include: {
        answers: { select: { questionId: true, selectedIndex: true, essayAnswer: true } },
      },
    });

    if (attempt?.status === "SUBMITTED" || attempt?.status === "NEEDS_GRADING") {
      return {
        success: false,
        alreadySubmitted: true,
        error: "Kamu sudah mengumpulkan kuis ini. Silakan lihat pembahasan.",
      };
    }

    // D1: Concurrency Protection double-click / multi-tab start
    if (!attempt) {
      try {
        attempt = await prisma.quizAttempt.create({
          data: { quizId: quiz.id, studentId, questionOrder: {} },
          include: {
            answers: { select: { questionId: true, selectedIndex: true, essayAnswer: true } },
          },
        });
      } catch (err: unknown) {
        // Jika terjadi Prisma unique constraint violation (P2002), load attempt yang baru saja dibuat
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          attempt = await prisma.quizAttempt.findUnique({
            where: { quizId_studentId: { quizId: quiz.id, studentId } },
            include: {
              answers: { select: { questionId: true, selectedIndex: true, essayAnswer: true } },
            },
          });
        } else {
          throw err;
        }
      }
    }

    if (!attempt) {
      return { success: false, error: "Gagal membuat sesi ujian." };
    }

    // Snapshot soal yang stabil
    type StoredOrder = { questions?: AttemptQuestionSnapshot[]; questionIds?: string[] };
    const stored = attempt.questionOrder as unknown as StoredOrder | null;
    let questionsSnapshot = stored?.questions;

    if (!questionsSnapshot?.length) {
      const liveQuestions = await prisma.quizQuestion.findMany({
        where: { quizId: quiz.id },
        orderBy: { order: "asc" },
      });

      if (!liveQuestions.length) {
        return { success: false, error: "Kuis ini belum memiliki butir soal yang aktif." };
      }

      const snapshot = buildAttemptSnapshot(
        liveQuestions.map((q) => ({
          id: q.id,
          type: q.type,
          text: q.text,
          options: q.options as string[],
          correctIndex: q.correctIndex,
          points: Number(q.points),
          explanation: q.explanation ?? undefined,
        })),
        quiz.shuffleQuestions,
        quiz.shuffleOptions
      );
      await prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: { questionOrder: { questions: snapshot } as unknown as Prisma.InputJsonValue },
      });
      questionsSnapshot = snapshot;
    }

    // F6: Sanitasi Kunci Jawaban! correctIndex dan explanation DIBUANG dari respons
    const sanitizedQuestions: StudentQuizQuestionView[] = questionsSnapshot.map((q, idx) => ({
      id: q.id,
      order: idx + 1,
      type: q.type ?? "MULTIPLE_CHOICE",
      text: q.text,
      options: q.options,
      points: q.points,
    }));

    // Server-Authoritative Duration Clamping
    let effectiveDuration = quiz.durationMinutes ?? undefined;
    if (quiz.deadline) {
      const msLeft = quiz.deadline.getTime() - attempt.startedAt.getTime();
      const minutesLeft = Math.max(1, Math.floor(msLeft / 60_000));
      if (effectiveDuration) {
        effectiveDuration = Math.min(effectiveDuration, minutesLeft);
      } else {
        effectiveDuration = minutesLeft;
      }
    }

    const savedAnswers = attempt.answers
      .filter((a): a is typeof a & { questionId: string } => typeof a.questionId === "string")
      .map((a) => ({
        questionId: a.questionId,
        selectedIndex: a.selectedIndex,
        essayAnswer: a.essayAnswer,
      }));

    return {
      success: true,
      data: {
        attemptId: attempt.id,
        quizTitle: quiz.title,
        durationMinutes: effectiveDuration,
        startedAt: attempt.startedAt.toISOString(),
        isRemedial: attempt.isRemedial,
        questions: sanitizedQuestions,
        savedAnswers,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: formatActionError(error, "Gagal memulai kuis") };
  }
}

/**
 * Autosave jawaban kuis per butir soal terproteksi sesi siswa.
 */
export async function saveQuizAnswerFromSessionAction(
  attemptId: string,
  questionId: string,
  selectedIndex?: number | null,
  essayAnswer?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifyStudentSession();
    if (!session) {
      return { success: false, error: "Sesi tidak valid." };
    }

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: { select: { durationMinutes: true, deadline: true } },
      },
    });

    if (!attempt) return { success: false, error: "Attempt tidak ditemukan." };
    if (attempt.studentId !== session.studentId) {
      return { success: false, error: "Akses tidak diizinkan." };
    }

    if (attempt.status === "SUBMITTED" || attempt.status === "NEEDS_GRADING") {
      return { success: false, error: "Kuis sudah selesai dikumpulkan." };
    }

    // F7: Cek apakah durasi sudah habis
    if (isAttemptExpired(attempt.startedAt, attempt.quiz.durationMinutes, attempt.quiz.deadline)) {
      return { success: false, error: "Waktu kuis telah berakhir." };
    }

    // Validasi bahwa questionId benar-benar ada di snapshot attempt ini (Finding 6: Injection Guard)
    type StoredOrder = { questions?: AttemptQuestionSnapshot[] };
    const stored = attempt.questionOrder as unknown as StoredOrder | null;
    if (stored?.questions?.length && !stored.questions.some((q) => q.id === questionId)) {
      return { success: false, error: "Soal tidak valid untuk kuis ini." };
    }

    await prisma.quizAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: {
        attemptId,
        questionId,
        selectedIndex: selectedIndex ?? undefined,
        essayAnswer: essayAnswer ?? undefined,
      },
      update: {
        selectedIndex: selectedIndex ?? undefined,
        essayAnswer: essayAnswer ?? undefined,
      },
    });

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Gagal menyimpan jawaban." };
  }
}

/**
 * Mengumpulkan kuis dari sesi portal siswa dengan kalkulasi skor atomik.
 * Nilai PG otomatis tersimpan ke QuizAttempt.score (Activity Generates Data).
 */
export async function submitQuizAttemptFromSessionAction(
  attemptId: string,
  answers: Array<{ questionId: string; selectedIndex?: number | null; essayAnswer?: string | null }>
): Promise<{
  success: boolean;
  data?: {
    score: number;
    totalPoints: number;
    passed: boolean;
    isRemedial: boolean;
    needsGrading: boolean;
    submittedAt: string;
  };
  alreadySubmitted?: boolean;
  error?: string;
}> {
  try {
    const session = await verifyStudentSession();
    if (!session) {
      return { success: false, error: "Sesi tidak valid." };
    }

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          select: {
            id: true,
            durationMinutes: true,
            deadline: true,
            standardScore: true,
          },
        },
      },
    });

    if (!attempt) return { success: false, error: "Attempt tidak ditemukan." };
    if (attempt.studentId !== session.studentId) {
      return { success: false, error: "Akses ditolak." };
    }

    if (attempt.status === "SUBMITTED" || attempt.status === "NEEDS_GRADING") {
      const standard = attempt.quiz.standardScore ? Number(attempt.quiz.standardScore) : null;
      const score = attempt.score ? Number(attempt.score) : 0;
      return {
        success: true,
        alreadySubmitted: true,
        data: {
          score,
          totalPoints: 100,
          passed: standard === null ? true : score >= standard,
          isRemedial: attempt.isRemedial,
          needsGrading: attempt.status === "NEEDS_GRADING",
          submittedAt: attempt.submittedAt?.toISOString() ?? new Date().toISOString(),
        },
      };
    }

    // F7 & Finding 1: Cek apakah waktu pengerjaan sudah habis (Late Submission Defense)
    if (isAttemptExpired(attempt.startedAt, attempt.quiz.durationMinutes, attempt.quiz.deadline)) {
      // Waktu habis: kunci attempt menjadi SUBMITTED secara sepihak, tolak jawaban susulan
      await prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
        },
      });
      return {
        success: false,
        error: "Batas waktu pengerjaan kuis telah habis. Jawaban tidak dapat dikirimkan melewati batas waktu.",
      };
    }

    // Resolusi snapshot soal yang disimpan
    type StoredOrder = { questions?: AttemptQuestionSnapshot[] };
    const stored = attempt.questionOrder as unknown as StoredOrder | null;
    if (!stored?.questions?.length) {
      return { success: false, error: "Data soal tidak sinkron. Silakan muat ulang halaman." };
    }
    const snapshot = stored.questions;

    // Hitung skor via gradeAttempt
    const { score, totalPoints, hasEssays, perQuestion } = gradeAttempt(
      snapshot.map((q) => ({
        id: q.id,
        type: q.type,
        correctIndex: q.correctIndex,
        points: q.points,
      })),
      answers
    );

    const normalized = normalizeScore(score, totalPoints);

    // Simpan semua jawaban dan finalisasi attempt secara atomik
    await prisma.$transaction([
      ...perQuestion.map((pq) =>
        prisma.quizAnswer.upsert({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: pq.questionId } },
          create: {
            attemptId: attempt.id,
            questionId: pq.questionId,
            selectedIndex: pq.selectedIndex ?? undefined,
            essayAnswer: pq.essayAnswer ?? undefined,
            isCorrect: pq.isCorrect ?? undefined,
          },
          update: {
            selectedIndex: pq.selectedIndex ?? undefined,
            essayAnswer: pq.essayAnswer ?? undefined,
            isCorrect: pq.isCorrect ?? undefined,
          },
        })
      ),
      prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: hasEssays ? "NEEDS_GRADING" : "SUBMITTED",
          submittedAt: new Date(),
          score: normalized,
        },
      }),
    ]);

    const standard = attempt.quiz.standardScore ? Number(attempt.quiz.standardScore) : null;

    return {
      success: true,
      data: {
        score: normalized,
        totalPoints,
        passed: standard === null ? true : normalized >= standard,
        isRemedial: attempt.isRemedial,
        needsGrading: hasEssays,
        submittedAt: new Date().toISOString(),
      },
    };
  } catch (err: unknown) {
    return { success: false, error: formatActionError(err, "Gagal mengumpulkan kuis.") };
  }
}

/**
 * Mengambil lembar pembahasan kuis pasca submit untuk portal siswa.
 * Hanya diizinkan jika status attempt adalah SUBMITTED atau NEEDS_GRADING.
 */
export async function getQuizReviewFromSessionAction(token: string): Promise<{
  success: boolean;
  data?: {
    quizTitle: string;
    score: number;
    standardScore: number | null;
    passed: boolean;
    submittedAt: string;
    questions: Array<{
      id: string;
      order: number;
      type: string;
      text: string;
      options: string[];
      selectedIndex: number | null;
      essayAnswer: string | null;
      correctIndex: number | null;
      isCorrect: boolean | null;
      explanation?: string | null;
      pointsEarned: number;
      pointsMax: number;
    }>;
  };
  error?: string;
}> {
  try {
    const session = await verifyStudentSession();
    if (!session) {
      return { success: false, error: "Sesi tidak valid." };
    }

    const quiz = await prisma.quiz.findUnique({
      where: { shareToken: token },
      select: { id: true, title: true, standardScore: true, deadline: true },
    });
    if (!quiz) return { success: false, error: "Kuis tidak ditemukan." };

    const attempt = await prisma.quizAttempt.findUnique({
      where: { quizId_studentId: { quizId: quiz.id, studentId: session.studentId } },
      include: { answers: true },
    });

    if (!attempt || (attempt.status !== "SUBMITTED" && attempt.status !== "NEEDS_GRADING")) {
      return { success: false, error: "Hasil dan pembahasan belum tersedia." };
    }

    // Anti-Cheat: Jika ujian kelas masih berlangsung (deadline belum lewat), sembunyikan kunci jawaban & pembahasan
    const isExamStillActive = !!quiz.deadline && Date.now() < quiz.deadline.getTime();

    const snapshot = await resolveAttemptSnapshot(attempt, quiz.id);
    const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

    const questionsReview = snapshot.map((q, idx) => {
      const ans = answerMap.get(q.id);
      const sel = ans?.selectedIndex ?? null;
      const isCorrect = q.correctIndex !== null && sel === q.correctIndex;
      return {
        id: q.id,
        order: idx + 1,
        type: q.type ?? "MULTIPLE_CHOICE",
        text: q.text,
        options: q.options,
        selectedIndex: sel,
        essayAnswer: ans?.essayAnswer ?? null,
        correctIndex: isExamStillActive ? null : q.correctIndex,
        isCorrect,
        explanation: isExamStillActive 
          ? `Kunci jawaban dan pembahasan lengkap akan dibuka otomatis setelah seluruh sesi ujian berakhir pada ${quiz.deadline?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB.`
          : (q.explanation ?? null),
        pointsEarned: isCorrect ? q.points : 0,
        pointsMax: q.points,
      };
    });

    const standard = quiz.standardScore ? Number(quiz.standardScore) : null;
    const score = attempt.score ? Number(attempt.score) : 0;

    return {
      success: true,
      data: {
        quizTitle: quiz.title,
        score,
        standardScore: standard,
        passed: standard === null ? true : score >= standard,
        submittedAt: attempt.submittedAt?.toISOString() ?? "",
        questions: questionsReview,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: formatActionError(err, "Gagal memuat pembahasan kuis.") };
  }
}
