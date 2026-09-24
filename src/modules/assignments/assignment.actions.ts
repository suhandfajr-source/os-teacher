"use server";

import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import {
  validateReviewInput,
  isSubmissionLate,
  type TeacherQueueItem,
} from "@/modules/assignments/submission.service";

export async function createAssignment(data: {
  teachingContextId: string;
  teachingSessionId?: string;
  title: string;
  description?: string;
  dueDate?: Date;
}) {
  const { context } = await verifyTeachingContextAccess(data.teachingContextId);

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
    const { profile, context } = await verifyTeachingContextAccess(data.teachingContextId);

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
