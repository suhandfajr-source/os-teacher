"use server";

import { prisma } from "@/lib/auth";
import { verifyStudentSession } from "@/modules/student-auth/student-session";
import { revalidatePath } from "next/cache";
import {
  validateSubmissionInput,
  isSubmissionLate,
  type StudentSubmissionView,
} from "@/modules/assignments/submission.service";

/**
 * Story 8 — action submit tugas dari portal siswa (teks/tautan).
 * Identitas selalu dari sesi siswa; tugas wajib ACTIVE & berada di rombel
 * periode aktif siswa. Resubmit hanya selama status SUBMITTED.
 */
export async function submitAssignmentAction(
  assignmentId: string,
  input: { textContent?: string; linkUrl?: string }
): Promise<{ success: boolean; error?: string; submission?: StudentSubmissionView }> {
  try {
    const session = await verifyStudentSession();
    if (!session) {
      return { success: false, error: "Sesi tidak valid atau telah berakhir." };
    }

    const validation = validateSubmissionInput(input);
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }

    const student = await prisma.student.findUnique({
      where: { id: session.studentId },
      include: {
        classMemberships: {
          include: { academicPeriod: { select: { status: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!student) {
      return { success: false, error: "Data siswa tidak ditemukan." };
    }

    const activeMembership = student.classMemberships.find(
      (cm) => cm.academicPeriod.status === "ACTIVE"
    );

    if (!activeMembership) {
      return { success: false, error: "Belum terdaftar di rombel periode aktif." };
    }

    // Tugas wajib ACTIVE dan milik rombel siswa pada periode aktif
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { teachingContext: { select: { classId: true, academicPeriodId: true } } },
    });

    if (!assignment || assignment.status !== "ACTIVE") {
      return { success: false, error: "Tugas tidak tersedia." };
    }

    const ctx = assignment.teachingContext;
    if (
      ctx.classId !== activeMembership.classId ||
      ctx.academicPeriodId !== activeMembership.academicPeriodId
    ) {
      // Tugas bukan milik rombel siswa — jangan bocorkan keberadaannya
      return { success: false, error: "Tugas tidak tersedia." };
    }

    const existing = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
    });

    if (existing?.status === "REVIEWED") {
      return { success: false, error: "Jawaban terkunci — sudah dinilai guru." };
    }

    const now = new Date();
    // Guard race: update hanya bila masih SUBMITTED — review guru yang mendarat
    // di antara cek dan tulis tidak boleh tertimpa jadi SUBMITTED lagi.
    const updated = await prisma.assignmentSubmission.updateMany({
      where: {
        assignmentId,
        studentId: student.id,
        status: "SUBMITTED",
      },
      data: {
        textContent: validation.textContent,
        linkUrl: validation.linkUrl,
        status: "SUBMITTED",
        submittedAt: now,
      },
    });

    let saved;
    if (updated.count === 0 && !existing) {
      try {
        saved = await prisma.assignmentSubmission.create({
          data: {
            assignmentId,
            studentId: student.id,
            textContent: validation.textContent,
            linkUrl: validation.linkUrl,
            status: "SUBMITTED",
            submittedAt: now,
          },
        });
      } catch {
        // Unique collision: submission dibuat konkuren — perlakukan race yang kalah
        return { success: false, error: "Jawaban sedang diproses. Muat ulang halaman." };
      }
    } else if (updated.count === 0 && existing) {
      // existing berubah jadi REVIEWED di antara cek dan updateMany
      return { success: false, error: "Jawaban terkunci — sudah dinilai guru." };
    } else {
      saved = await prisma.assignmentSubmission.findUnique({
        where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
      });
    }

    if (!saved) {
      return { success: false, error: "Gagal menyimpan jawaban. Coba lagi." };
    }

    revalidatePath("/siswa/portal/tugas");

    return {
      success: true,
      submission: {
        id: saved.id,
        assignmentId: saved.assignmentId,
        status: saved.status,
        textContent: saved.textContent,
        linkUrl: saved.linkUrl,
        feedback: saved.feedback,
        score: saved.score,
        submittedAt: saved.submittedAt.toISOString(),
        reviewedAt: saved.reviewedAt?.toISOString() ?? null,
        isLate: isSubmissionLate(saved.submittedAt, assignment.dueDate),
      },
    };
  } catch (err) {
    console.error("[submitAssignmentAction]", err);
    return { success: false, error: "Gagal menyimpan jawaban. Coba lagi." };
  }
}

/**
 * Story 8 — status submission siswa untuk satu tugas (Mode Keluarga & UI).
 * Read-only: identitas dari sesi; tanpa jalur tulis.
 */
export async function getStudentSubmissionStatusAction(
  assignmentId: string
): Promise<{ success: boolean; error?: string; submission?: StudentSubmissionView | null }> {
  try {
    const session = await verifyStudentSession();
    if (!session) {
      return { success: false, error: "Sesi tidak valid atau telah berakhir." };
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentId: { assignmentId, studentId: session.studentId },
      },
    });

    if (!submission) {
      return { success: true, submission: null };
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { dueDate: true },
    });

    return {
      success: true,
      submission: {
        id: submission.id,
        assignmentId: submission.assignmentId,
        status: submission.status,
        textContent: submission.textContent,
        linkUrl: submission.linkUrl,
        feedback: submission.feedback,
        score: submission.score,
        submittedAt: submission.submittedAt.toISOString(),
        reviewedAt: submission.reviewedAt?.toISOString() ?? null,
        isLate: isSubmissionLate(submission.submittedAt, assignment?.dueDate ?? null),
      },
    };
  } catch (err) {
    console.error("[getStudentSubmissionStatusAction]", err);
    return { success: false, error: "Gagal memuat status tugas." };
  }
}
