"use server";

import { prisma } from "@/lib/auth";
import { verifyStudentSession } from "@/modules/student-auth/student-session";
import { revalidatePath } from "next/cache";
import {
  validateSubmissionInput,
  isSubmissionLate,
  isPreviewable,
  type StudentSubmissionView,
  type SubmissionFileInput,
} from "@/modules/assignments/submission.service";
import {
  headObjectSize,
  deleteObjects,
  isClaimableSubmissionKey,
  isStorageConfigured,
} from "@/modules/storage/storage.service";

function toFileView(f: {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}): StudentSubmissionView["files"][number] {
  return {
    id: f.id,
    originalName: f.originalName,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
    isPreviewable: isPreviewable(f.mimeType),
  };
}

/**
 * Story 8 — action submit tugas dari portal siswa (teks/tautan).
 * Story 1 — + kanal file: upload presign terpisah, di sini file DIKLAIM:
 * re-validasi server, HEAD-check ukuran objek, lalu replace atomik row +
 * hapus objek lama (K7). Identitas selalu dari sesi siswa; tugas wajib
 * ACTIVE & berada di rombel periode aktif siswa. Resubmit hanya selama
 * status SUBMITTED.
 */
export async function submitAssignmentAction(
  assignmentId: string,
  input: {
    textContent?: string;
    linkUrl?: string;
    files?: SubmissionFileInput[];
    /** Id file existing yang dipertahankan saat replace (siswa edit jawaban). */
    keepFileIds?: string[];
  }
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

    // Story 1 — klaim file SEBELUM tulis DB: key harus keluaran presign kita
    // (prefix tmp), objek benar-benar ada, ukurannya jujur, dan tak duplikat (E5).
    let fileRows: Array<{
      storageKey: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
    }> = [];
    if (validation.files) {
      if (validation.files.length > 0 && !isStorageConfigured()) {
        return { success: false, error: "Penyimpanan file belum dikonfigurasi." };
      }
      const seenKeys = new Set<string>();
      for (const f of validation.files) {
        if (seenKeys.has(f.storageKey)) {
          return { success: false, error: "Terdapat duplikasi file dalam lampiran." };
        }
        seenKeys.add(f.storageKey);
        if (!isClaimableSubmissionKey(f.storageKey)) {
          return { success: false, error: `File "${f.name}" belum terunggah dengan benar.` };
        }
        const actualSize = await headObjectSize(f.storageKey);
        if (actualSize == null) {
          return {
            success: false,
            error: `File "${f.name}" belum selesai terunggah — coba lagi.`,
          };
        }
        if (actualSize !== f.sizeBytes || actualSize > 25 * 1024 * 1024) {
          return { success: false, error: `Ukuran file "${f.name}" tidak sesuai.` };
        }
        fileRows.push({
          storageKey: f.storageKey,
          originalName: f.name,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
        });
      }
    }

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

    // Story 1 — replace set file bila dikirim (undefined = pertahankan semua).
    // keepFileIds: id file lama yang tetap dipakai; sisanya dihapus (K7).
    // Delete SELEKTIF + insert hanya file baru → id file lama stabil (E13),
    // link yang sedang dibuka guru/siswa tidak berubah jadi 404.
    // Objek dihapus SETELAH commit — kegagalan hapus hanya orphan (di-log),
    // bukan kegagalan submit.
    let currentFiles = await prisma.submissionFile.findMany({
      where: { submissionId: saved.id },
    });
    if (validation.files !== undefined) {
      const keepIds = new Set(input.keepFileIds ?? []);
      // Hanya id milik submission ini yang sah dipertahankan — id asing no-op.
      const keptRows = currentFiles.filter((f) => keepIds.has(f.id));
      const removedRows = currentFiles.filter((f) => !keepIds.has(f.id));

      // Guard jumlah GABUNGAN (BH1): maks 5 file per submission — server-side.
      if (keptRows.length + fileRows.length > 5) {
        return {
          success: false,
          error: `Maksimal 5 file per pengumpulan (dipertahankan ${keptRows.length} + baru ${fileRows.length}).`,
        };
      }

      await prisma.$transaction([
        prisma.submissionFile.deleteMany({
          where: { submissionId: saved.id, id: { notIn: keptRows.map((f) => f.id) } },
        }),
        prisma.submissionFile.createMany({
          data: fileRows.map((f) => ({ ...f, submissionId: saved.id })),
        }),
      ]);
      currentFiles = await prisma.submissionFile.findMany({
        where: { submissionId: saved.id },
      });
      const removedKeys = removedRows.map((f) => f.storageKey);
      if (removedKeys.length > 0) {
        deleteObjects(removedKeys).catch((e) =>
          console.error("[submitAssignmentAction] gagal hapus objek lama:", e)
        );
      }
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
        files: currentFiles.map(toFileView),
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
      include: { files: true },
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
        files: submission.files.map(toFileView),
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
