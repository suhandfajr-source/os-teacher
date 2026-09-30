"use server";

import { prisma } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import {
  validateReviewInput,
  isSubmissionLate,
  type TeacherQueueItem,
} from "@/modules/assignments/submission.service";

function assertNotBanned(authContext: { isBanned?: boolean }) {
  if (authContext.isBanned) {
    throw new Error("Akses ditolak: Akun Anda telah dinonaktifkan oleh administrator.");
  }
}

export async function createAssignment(data: {
  teachingContextId: string;
  teachingSessionId?: string;
  title: string;
  description?: string;
  dueDate?: Date;
}) {
  const auth = await verifyTeachingContextAccess(data.teachingContextId);
  assertNotBanned(auth);
  const { context } = auth;

  if (data.teachingSessionId) {
    const session = await prisma.teachingSession.findUnique({
      where: { id: data.teachingSessionId },
    });

    if (!session) {
      throw new Error("Teaching session not found");
    }

    if (session.teachingContextId !== data.teachingContextId) {
      throw new Error("Cross-context assignment is not allowed");
    }
  }

  const assignment = await prisma.assignment.create({
    data: {
      teachingContextId: data.teachingContextId,
      teachingSessionId: data.teachingSessionId,
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      status: "ACTIVE",
    },
  });

  revalidatePath(`/kelas/${context.id}/tugas`);
  if (data.teachingSessionId) {
    revalidatePath(`/kelas/${context.id}/pertemuan/${data.teachingSessionId}`);
  }

  return assignment;
}

/**
 * Story 8 — antrean koreksi guru: semua submission satu tugas
 * (SUBMITTED dulu, lalu REVIEWED), lengkap penanda terlambat.
 */
export async function getSubmissionQueueAction(
  teachingContextId: string,
  assignmentId: string
): Promise<TeacherQueueItem[]> {
  await verifyTeachingContextAccess(teachingContextId);

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, teachingContextId: true, dueDate: true },
  });

  if (!assignment) throw new Error("Assignment not found");
  if (assignment.teachingContextId !== teachingContextId) {
    throw new Error("Cross-context queue is not allowed");
  }

  const rows = await prisma.assignmentSubmission.findMany({
    where: { assignmentId },
    include: { student: { select: { fullName: true, nis: true } } },
    orderBy: [
      // "desc" pada enum mengandalkan urutan leksikografis: SUBMITTED > REVIEWED,
      // sehingga antrean menunggu-koreksi selalu di atas. Jika enum bertambah
      // nilai baru, urutan ini harus ditinjau ulang.
      { status: "desc" },
      { submittedAt: "asc" },
    ],
  });

  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentName: r.student.fullName,
    nis: r.student.nis,
    status: r.status,
    textContent: r.textContent,
    linkUrl: r.linkUrl,
    feedback: r.feedback,
    score: r.score,
    submittedAt: r.submittedAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    isLate: isSubmissionLate(r.submittedAt, assignment.dueDate),
  }));
}

/**
 * Story 8 — guru memberi umpan balik (feedback wajib, skor opsional 0–100).
 * Setelah REVIEWED, siswa tidak bisa resubmit.
 */
export async function reviewSubmissionAction(data: {
  teachingContextId: string;
  submissionId: string;
  feedback: string;
  score?: number | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyTeachingContextAccess(data.teachingContextId);
    assertNotBanned(auth);
    const { profile, context } = auth;

    const validation = validateReviewInput({ feedback: data.feedback, score: data.score });
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: data.submissionId },
      include: { assignment: { select: { teachingContextId: true } } },
    });

    if (!submission) {
      return { success: false, error: "Submission tidak ditemukan." };
    }

    if (submission.assignment.teachingContextId !== data.teachingContextId) {
      // Submission milik konteks lain — jangan bocorkan detail
      return { success: false, error: "Submission tidak ditemukan." };
    }

    await prisma.assignmentSubmission.update({
      where: { id: submission.id },
      data: {
        feedback: validation.feedback,
        score: validation.score,
        status: "REVIEWED",
        reviewedAt: new Date(),
        reviewedByProfileId: profile.id,
      },
    });

    revalidatePath(`/kelas/${context.id}/tugas/${submission.assignmentId}`);
    revalidatePath(`/kelas/${context.id}/tugas`);
    revalidatePath("/siswa/portal/tugas");

    return { success: true };
  } catch (err) {
    console.error("[reviewSubmissionAction]", err);
    return { success: false, error: "Gagal menyimpan umpan balik." };
  }
}

/**
 * Menyimpan atau memperbarui tugas yang terikat dengan sesi mengajar tertentu.
 */
export async function saveSessionAssignmentAction(data: {
  teachingContextId: string;
  teachingSessionId: string;
  title: string;
  description?: string;
  dueDate?: Date | null;
}) {
  const auth = await verifyTeachingContextAccess(data.teachingContextId);
  assertNotBanned(auth);

  const existing = await prisma.assignment.findFirst({
    where: {
      teachingSessionId: data.teachingSessionId,
      teachingContextId: data.teachingContextId,
    },
  });

  let assignment;
  if (existing) {
    assignment = await prisma.assignment.update({
      where: { id: existing.id },
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        dueDate: data.dueDate,
      },
    });
  } else {
    assignment = await prisma.assignment.create({
      data: {
        teachingContextId: data.teachingContextId,
        teachingSessionId: data.teachingSessionId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        dueDate: data.dueDate,
        status: "ACTIVE",
      },
    });
  }

  revalidatePath(`/kelas/${data.teachingContextId}/pertemuan/${data.teachingSessionId}`);
  revalidatePath(`/kelas/${data.teachingContextId}/tugas`);
  revalidatePath("/siswa/portal/tugas");
  revalidatePath("/siswa/portal");

  return assignment;
}

/**
 * Mengonversi seluruh skor tugas siswa menjadi penilaian resmi (Assessment & AssessmentResult) di Buku Nilai.
 */
export async function convertAssignmentToAssessmentAction(data: {
  teachingContextId: string;
  assignmentId: string;
  title: string;
  assessmentTypeId: string;
  passingScore?: number | null;
}) {
  const auth = await verifyTeachingContextAccess(data.teachingContextId);
  assertNotBanned(auth);

  const assignment = await prisma.assignment.findUnique({
    where: { id: data.assignmentId },
    include: {
      submissions: {
        where: { score: { not: null } },
        select: { studentId: true, score: true },
      },
    },
  });

  if (!assignment || assignment.teachingContextId !== data.teachingContextId) {
    throw new Error("Tugas tidak ditemukan");
  }

  if (assignment.submissions.length === 0) {
    throw new Error("Belum ada skor siswa yang dinilai pada tugas ini.");
  }

  const targetTitle = data.title.trim() || assignment.title;

  const assessment = await prisma.$transaction(async (tx) => {
    const existingAssessment = await tx.assessment.findFirst({
      where: {
        teachingContextId: data.teachingContextId,
        title: targetTitle,
      },
    });

    const createdOrUpdated = existingAssessment
      ? await tx.assessment.update({
          where: { id: existingAssessment.id },
          data: {
            assessmentTypeId: data.assessmentTypeId,
            minimumPassingScore: new Prisma.Decimal(data.passingScore ?? 75),
            status: "COMPLETED",
          },
        })
      : await tx.assessment.create({
          data: {
            teachingContextId: data.teachingContextId,
            assessmentTypeId: data.assessmentTypeId,
            title: targetTitle,
            assessmentDate: new Date(),
            maxScore: new Prisma.Decimal(100),
            minimumPassingScore: new Prisma.Decimal(data.passingScore ?? 75),
            status: "COMPLETED",
            teachingSessionId: assignment.teachingSessionId ?? null,
          },
        });

    for (const sub of assignment.submissions) {
      const scoreVal = sub.score !== null ? new Prisma.Decimal(sub.score) : null;
      await tx.assessmentResult.upsert({
        where: {
          assessmentId_studentId: {
            assessmentId: createdOrUpdated.id,
            studentId: sub.studentId,
          },
        },
        create: {
          assessmentId: createdOrUpdated.id,
          studentId: sub.studentId,
          rawScore: scoreVal,
          finalScore: scoreVal,
          status: sub.score !== null ? "GRADED" : "PENDING",
        },
        update: {
          rawScore: scoreVal,
          finalScore: scoreVal,
          status: sub.score !== null ? "GRADED" : "PENDING",
        },
      });
    }

    return createdOrUpdated;
  });

  revalidatePath(`/kelas/${data.teachingContextId}/penilaian`);
  revalidatePath(`/kelas/${data.teachingContextId}/tugas/${data.assignmentId}`);
  revalidatePath(`/kelas/${data.teachingContextId}/tugas`);

  return {
    success: true,
    assessmentId: assessment.id,
    syncedCount: assignment.submissions.length,
  };
}

/**
 * Guru memberi nilai langsung per siswa (offline / tanpa submission online).
 */
export async function saveDirectAssignmentScoreAction(data: {
  teachingContextId: string;
  assignmentId: string;
  studentId: string;
  score: number | null;
  feedback?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyTeachingContextAccess(data.teachingContextId);
    assertNotBanned(auth);
    const { profile, context } = auth;

    if (data.score !== null && (data.score < 0 || data.score > 100)) {
      return { success: false, error: "Skor harus berupa angka 0 - 100." };
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: data.assignmentId },
      select: { id: true, teachingContextId: true },
    });

    if (!assignment || assignment.teachingContextId !== data.teachingContextId) {
      return { success: false, error: "Tugas tidak ditemukan." };
    }

    const existingSubmission = await prisma.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: data.assignmentId,
          studentId: data.studentId,
        },
      },
    });

    if (data.score === null && !data.feedback?.trim() && !existingSubmission) {
      return { success: true };
    }

    await prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId: data.assignmentId,
          studentId: data.studentId,
        },
      },
      create: {
        assignmentId: data.assignmentId,
        studentId: data.studentId,
        score: data.score,
        feedback: data.feedback?.trim() || "Penilaian langsung oleh guru",
        status: data.score !== null ? "REVIEWED" : "SUBMITTED",
        submittedAt: new Date(),
        reviewedAt: data.score !== null ? new Date() : null,
        reviewedByProfileId: data.score !== null ? profile.id : null,
      },
      update: {
        score: data.score,
        feedback: data.feedback?.trim() || undefined,
        status: data.score !== null ? "REVIEWED" : existingSubmission?.status ?? "SUBMITTED",
        reviewedAt: data.score !== null ? new Date() : existingSubmission?.reviewedAt ?? null,
        reviewedByProfileId:
          data.score !== null ? profile.id : existingSubmission?.reviewedByProfileId ?? null,
      },
    });

    revalidatePath(`/kelas/${context.id}/tugas/${data.assignmentId}`);
    revalidatePath(`/kelas/${context.id}/tugas`);
    revalidatePath("/siswa/portal/tugas");

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan nilai.",
    };
  }
}

/**
 * Guru menyimpan nilai tugas massal untuk seluruh siswa di kelas.
 */
export async function batchSaveDirectAssignmentScoresAction(data: {
  teachingContextId: string;
  assignmentId: string;
  items: Array<{
    studentId: string;
    score: number | null;
    feedback?: string;
  }>;
}): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  try {
    const auth = await verifyTeachingContextAccess(data.teachingContextId);
    assertNotBanned(auth);
    const { profile, context } = auth;

    // Strict validation upfront
    const invalidItems = data.items.filter(
      (item) => item.score !== null && (item.score < 0 || item.score > 100)
    );
    if (invalidItems.length > 0) {
      return {
        success: false,
        updatedCount: 0,
        error: "Skor harus berupa angka antara 0 hingga 100.",
      };
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: data.assignmentId },
      select: { id: true, teachingContextId: true },
    });

    if (!assignment || assignment.teachingContextId !== data.teachingContextId) {
      return { success: false, updatedCount: 0, error: "Tugas tidak ditemukan." };
    }

    const existingSubmissions = await prisma.assignmentSubmission.findMany({
      where: {
        assignmentId: data.assignmentId,
        studentId: { in: data.items.map((i) => i.studentId) },
      },
      select: {
        id: true,
        studentId: true,
        status: true,
        reviewedAt: true,
        reviewedByProfileId: true,
      },
    });
    const existingSubMap = new Map(existingSubmissions.map((s) => [s.studentId, s]));

    const itemsToSave = data.items.filter((item) => {
      const hasScore = item.score !== null;
      const hasExisting = existingSubMap.has(item.studentId);
      const hasFeedback = Boolean(item.feedback?.trim());
      return hasScore || (hasExisting && hasFeedback);
    });

    if (itemsToSave.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    let updatedCount = 0;
    await prisma.$transaction(
      itemsToSave.map((item) => {
        const score = item.score;
        if (score !== null) updatedCount++;
        const existing = existingSubMap.get(item.studentId);

        return prisma.assignmentSubmission.upsert({
          where: {
            assignmentId_studentId: {
              assignmentId: data.assignmentId,
              studentId: item.studentId,
            },
          },
          create: {
            assignmentId: data.assignmentId,
            studentId: item.studentId,
            score,
            feedback: item.feedback?.trim() || "Penilaian langsung oleh guru",
            status: score !== null ? "REVIEWED" : "SUBMITTED",
            submittedAt: new Date(),
            reviewedAt: score !== null ? new Date() : null,
            reviewedByProfileId: score !== null ? profile.id : null,
          },
          update: {
            score,
            feedback: item.feedback?.trim() || undefined,
            status: score !== null ? "REVIEWED" : existing?.status ?? "SUBMITTED",
            reviewedAt: score !== null ? new Date() : existing?.reviewedAt ?? null,
            reviewedByProfileId:
              score !== null ? profile.id : existing?.reviewedByProfileId ?? null,
          },
        });
      })
    );

    revalidatePath(`/kelas/${context.id}/tugas/${data.assignmentId}`);
    revalidatePath(`/kelas/${context.id}/tugas`);
    revalidatePath("/siswa/portal/tugas");

    return { success: true, updatedCount };
  } catch (err: unknown) {
    return {
      success: false,
      updatedCount: 0,
      error: err instanceof Error ? err.message : "Gagal menyimpan nilai massal.",
    };
  }
}
