"use server";

import { prisma } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { verifyStudentSession } from "@/modules/student-auth/student-session";
import {
  CbtLiveCockpitView,
  CbtSessionStatusView,
  CbtStudentLobbyView,
} from "./cbt-live.types";

/**
 * Generate 6-karakter token unik uppercase alfanumerik (hindari karakter ambigu: O, 0, I, 1)
 */
function generateCbtToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Buat sesi ujian live baru untuk kuis tertentu
 */
export async function createCbtSessionAction(
  quizId: string,
  teachingContextId: string
): Promise<{
  success: boolean;
  sessionId?: string;
  token?: string;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: "Tidak terautentikasi." };
    }

    await verifyTeachingContextAccess(teachingContextId);

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, teachingContextId: true, status: true },
    });

    if (!quiz || quiz.teachingContextId !== teachingContextId) {
      return { success: false, error: "Kuis tidak ditemukan pada kelas ini." };
    }

    // Buat token unik (coba hingga 5 kali)
    let token = generateCbtToken();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await prisma.cbtSession.findUnique({
        where: { token },
        select: { id: true },
      });
      if (!existing) break;
      token = generateCbtToken();
      attempts++;
    }

    const cbtSession = await prisma.cbtSession.create({
      data: {
        quizId,
        teachingContextId,
        createdById: session.user.id,
        token,
        status: "WAITING",
      },
    });

    return {
      success: true,
      sessionId: cbtSession.id,
      token: cbtSession.token,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membuat sesi CBT live.",
    };
  }
}

/**
 * Ambil data live cockpit guru untuk sesi CBT tertentu
 */
export async function getCbtSessionCockpitAction(
  sessionId: string
): Promise<{
  success: boolean;
  data?: CbtLiveCockpitView;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: "Tidak terautentikasi." };
    }

    const cbt = await prisma.cbtSession.findUnique({
      where: { id: sessionId },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            durationMinutes: true,
            _count: { select: { questions: true } },
          },
        },
        teachingContext: {
          select: {
            id: true,
            class: { select: { name: true } },
            subject: { select: { name: true } },
          },
        },
        attempts: {
          include: {
            student: { select: { id: true, fullName: true, nis: true } },
            _count: { select: { answers: true } },
          },
        },
      },
    });

    if (!cbt) return { success: false, error: "Sesi CBT tidak ditemukan." };

    await verifyTeachingContextAccess(cbt.teachingContextId);

    const totalQuestions = cbt.quiz._count.questions;
    const students = cbt.attempts.map((att) => {
      const isLocked = !!att.lockdownLockedAt;
      return {
        attemptId: att.id,
        studentId: att.studentId,
        studentName: att.student.fullName,
        studentNis: att.student.nis ?? undefined,
        status: (att.status as "WAITING" | "IN_PROGRESS" | "SUBMITTED" | "NEEDS_GRADING"),
        currentQuestion: att.currentQuestion,
        totalQuestions,
        answeredCount: att._count.answers,
        score: att.score ? Number(att.score) : null,
        violationCount: att.violationCount,
        lockedBySystem: isLocked,
        lockedAt: att.lockdownLockedAt?.toISOString() ?? null,
        startedAt: att.startedAt?.toISOString() ?? null,
        submittedAt: att.submittedAt?.toISOString() ?? null,
        isOnline: att.status === "IN_PROGRESS" && !isLocked,
        lastPingAt: att.updatedAt.toISOString(),
      };
    });

    const joinedCount = students.length;
    const activeCount = students.filter((s) => s.status === "IN_PROGRESS" && !s.lockedBySystem).length;
    const submittedCount = students.filter((s) => s.status === "SUBMITTED" || s.status === "NEEDS_GRADING").length;
    const lockedCount = students.filter((s) => s.lockedBySystem).length;

    return {
      success: true,
      data: {
        sessionId: cbt.id,
        token: cbt.token,
        status: cbt.status as CbtSessionStatusView,
        quizId: cbt.quiz.id,
        quizTitle: cbt.quiz.title,
        durationMinutes: cbt.quiz.durationMinutes,
        teachingContextId: cbt.teachingContextId,
        className: cbt.teachingContext.class.name,
        subjectName: cbt.teachingContext.subject.name,
        totalStudents: joinedCount,
        joinedCount,
        activeCount,
        submittedCount,
        lockedCount,
        startedAt: cbt.startedAt?.toISOString() ?? null,
        pausedAt: cbt.pausedAt?.toISOString() ?? null,
        endedAt: cbt.endedAt?.toISOString() ?? null,
        students,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat cockpit CBT.",
    };
  }
}

/**
 * Guru mengubah status sesi: Mulai (ACTIVE), Jeda (PAUSED), Lanjut (ACTIVE), Akhiri (ENDED)
 */
export async function updateCbtSessionStatusAction(
  sessionId: string,
  newStatus: "ACTIVE" | "PAUSED" | "ENDED"
): Promise<{
  success: boolean;
  status?: CbtSessionStatusView;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: "Tidak terautentikasi." };
    }

    const cbt = await prisma.cbtSession.findUnique({
      where: { id: sessionId },
      select: { id: true, teachingContextId: true, status: true, startedAt: true },
    });

    if (!cbt) return { success: false, error: "Sesi tidak ditemukan." };
    await verifyTeachingContextAccess(cbt.teachingContextId);

    const data: {
      status: "ACTIVE" | "PAUSED" | "ENDED";
      startedAt?: Date;
      pausedAt?: Date | null;
      endedAt?: Date;
    } = { status: newStatus };

    if (newStatus === "ACTIVE" && !cbt.startedAt) {
      data.startedAt = new Date();
      data.pausedAt = null;
    } else if (newStatus === "PAUSED") {
      data.pausedAt = new Date();
    } else if (newStatus === "ACTIVE" && cbt.status === "PAUSED") {
      data.pausedAt = null;
    } else if (newStatus === "ENDED") {
      data.endedAt = new Date();

      // Akhiri serentak semua attempt aktif yang belum selesai
      await prisma.quizAttempt.updateMany({
        where: {
          cbtSessionId: sessionId,
          status: "IN_PROGRESS",
        },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
        },
      });
    }

    const updated = await prisma.cbtSession.update({
      where: { id: sessionId },
      data,
      select: { status: true },
    });

    return {
      success: true,
      status: updated.status as CbtSessionStatusView,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memperbarui status sesi.",
    };
  }
}

/**
 * Siswa bergabung ke lobi CBT menggunakan Token 6 Karakter
 */
export async function joinCbtSessionByTokenAction(
  tokenRaw: string
): Promise<{
  success: boolean;
  data?: CbtStudentLobbyView;
  error?: string;
}> {
  try {
    const studentSession = await verifyStudentSession();
    if (!studentSession) {
      return { success: false, error: "Sesi siswa tidak valid. Silakan login kembali." };
    }

    const cleanToken = tokenRaw.trim().toUpperCase();
    if (cleanToken.length !== 6) {
      return { success: false, error: "Token sesi harus 6 karakter." };
    }

    const cbt = await prisma.cbtSession.findUnique({
      where: { token: cleanToken },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            shareToken: true,
            durationMinutes: true,
            teachingContext: {
              select: {
                classId: true,
                subject: { select: { name: true } },
              },
            },
            _count: { select: { questions: true } },
          },
        },
      },
    });

    if (!cbt || cbt.status === "ENDED") {
      return { success: false, error: "Sesi ujian tidak ditemukan atau telah berakhir." };
    }

    // Verifikasi siswa terdaftar di rombel kelas kuis via classMemberships
    const student = await prisma.student.findUnique({
      where: { id: studentSession.studentId },
      include: {
        classMemberships: {
          select: { classId: true },
        },
      },
    });

    const isMember = student?.classMemberships.some(
      (m) => m.classId === cbt.quiz.teachingContext.classId
    );

    if (!isMember) {
      return { success: false, error: "Anda tidak terdaftar di kelas sesi ujian ini." };
    }

    // Cek apakah siswa sudah punya attempt pada kuis ini
    const existingAttempt = await prisma.quizAttempt.findUnique({
      where: {
        quizId_studentId: {
          quizId: cbt.quiz.id,
          studentId: studentSession.studentId,
        },
      },
      select: {
        id: true,
        status: true,
        cbtSessionId: true,
        lockdownLockedAt: true,
      },
    });

    // Jika belum ada relasi cbtSessionId pada attempt, tautkan ke sesi ini
    if (existingAttempt && !existingAttempt.cbtSessionId) {
      await prisma.quizAttempt.update({
        where: { id: existingAttempt.id },
        data: { cbtSessionId: cbt.id },
      });
    }

    return {
      success: true,
      data: {
        sessionId: cbt.id,
        token: cbt.token,
        status: cbt.status as CbtSessionStatusView,
        quizTitle: cbt.quiz.title,
        subjectName: cbt.quiz.teachingContext.subject.name,
        durationMinutes: cbt.quiz.durationMinutes,
        totalQuestions: cbt.quiz._count.questions,
        shareToken: cbt.quiz.shareToken,
        hasExistingAttempt: !!existingAttempt,
        attemptId: existingAttempt?.id,
        isLocked: !!existingAttempt?.lockdownLockedAt,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal bergabung ke sesi CBT.",
    };
  }
}

/**
 * Siswa melakukan polling berkala untuk mengetahui status sesi saat di lobi / runner
 */
export async function getStudentCbtSessionStatusAction(
  sessionId: string
): Promise<{
  success: boolean;
  status?: CbtSessionStatusView;
  isLocked?: boolean;
  error?: string;
}> {
  try {
    const studentSession = await verifyStudentSession();
    if (!studentSession) {
      return { success: false, error: "Sesi tidak valid." };
    }

    const cbt = await prisma.cbtSession.findUnique({
      where: { id: sessionId },
      select: {
        status: true,
        quizId: true,
      },
    });

    if (!cbt) return { success: false, error: "Sesi tidak ditemukan." };

    const attempt = await prisma.quizAttempt.findUnique({
      where: {
        quizId_studentId: {
          quizId: cbt.quizId,
          studentId: studentSession.studentId,
        },
      },
      select: { lockdownLockedAt: true },
    });

    return {
      success: true,
      status: cbt.status as CbtSessionStatusView,
      isLocked: !!attempt?.lockdownLockedAt,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengecek status sesi.",
    };
  }
}

/**
 * Siswa melaporkan progress nomor soal ke server (untuk cockpit guru)
 */
export async function recordStudentProgressAction(
  attemptId: string,
  currentQuestion: number
): Promise<{ success: boolean }> {
  try {
    const studentSession = await verifyStudentSession();
    if (!studentSession) return { success: false };

    await prisma.quizAttempt.updateMany({
      where: {
        id: attemptId,
        studentId: studentSession.studentId,
        status: "IN_PROGRESS",
      },
      data: {
        currentQuestion: Math.max(0, Math.floor(currentQuestion)),
      },
    });

    return { success: true };
  } catch {
    return { success: false };
  }
}

/**
 * Guru membuka kembali attempt siswa yang terkunci (Unblock / Reset Strikes)
 */
export async function unblockStudentAttemptAction(
  sessionId: string,
  attemptId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: "Tidak terautentikasi." };
    }

    const cbt = await prisma.cbtSession.findUnique({
      where: { id: sessionId },
      select: { teachingContextId: true },
    });
    if (!cbt) return { success: false, error: "Sesi tidak ditemukan." };

    await verifyTeachingContextAccess(cbt.teachingContextId);

    await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        status: "IN_PROGRESS",
        lockdownLockedAt: null,
        violationCount: 0,
      },
    });

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membuka kunci siswa.",
    };
  }
}

/**
 * Guru memaksa submit attempt siswa tertentu dari cockpit
 */
export async function forceSubmitStudentAttemptAction(
  sessionId: string,
  attemptId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: "Tidak terautentikasi." };
    }

    const cbt = await prisma.cbtSession.findUnique({
      where: { id: sessionId },
      select: { teachingContextId: true },
    });
    if (!cbt) return { success: false, error: "Sesi tidak ditemukan." };

    await verifyTeachingContextAccess(cbt.teachingContextId);

    await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memaksa submit attempt.",
    };
  }
}
