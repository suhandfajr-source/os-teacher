import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyStudentSession } from "@/modules/student-auth/student-session";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { isPreviewable } from "@/modules/storage/file-validation";
import {
  StorageNotConfiguredError,
  headObjectSize,
  presignDownload,
} from "@/modules/storage/storage.service";

/**
 * Story 2 — pintu akses LAMPIRAN tugas (K6/K8): row → assignment →
 * teachingContext. Guru pemilik konteks ATAU siswa dengan membership aktif
 * di rombel+periode tugas itu. Semua kegagalan akses = 404 generik;
 * HEAD pre-check untuk error ramah; inline hanya tipe previewable.
 */

function notFound(message = "Lampiran tidak ditemukan.") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  let fileId = "";
  try {
    const resolved = await params;
    fileId = resolved.fileId;
    if (!fileId) return notFound();

    const file = await prisma.assignmentAttachment.findUnique({
      where: { id: fileId },
      include: {
        assignment: {
          select: {
            status: true,
            teachingContextId: true,
            teachingContext: {
              select: { classId: true, academicPeriodId: true },
            },
          },
        },
      },
    });

    if (!file || file.assignment.status !== "ACTIVE") return notFound();

    const ctx = file.assignment.teachingContext;
    let authorized = false;

    // Jalur 1: guru pemilik teaching context (wajib aktif, tidak dibanned)
    try {
      const auth = await verifyTeachingContextAccess(file.assignment.teachingContextId);
      if (!auth.isBanned) {
        authorized = true;
      }
    } catch {
      authorized = false;
    }

    // Jalur 2: siswa dengan membership AKTIF di rombel+periode tugas ini & akun aktif
    if (!authorized) {
      const studentSession = await verifyStudentSession();
      if (studentSession) {
        const membership = await prisma.classStudent.findFirst({
          where: {
            studentId: studentSession.studentId,
            student: {
              status: "ACTIVE",
              accountStatus: "ACTIVE",
            },
            classId: ctx.classId,
            academicPeriodId: ctx.academicPeriodId,
            academicPeriod: { status: "ACTIVE" },
          },
          select: { id: true },
        });
        authorized = Boolean(membership);
      }
    }

    if (!authorized) return notFound();

    const objectSize = await headObjectSize(file.storageKey);
    if (objectSize == null) {
      return notFound("Lampiran tidak lagi tersedia di penyimpanan.");
    }

    const requestedInline = request.nextUrl.searchParams.get("disposition") === "inline";
    const disposition =
      requestedInline && isPreviewable(file.mimeType) ? "inline" : "attachment";

    const { url } = await presignDownload(file.storageKey, {
      filename: file.originalName,
      disposition,
    });

    const response = NextResponse.redirect(url, 302);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[assignment attachment route]", fileId, err);
    return NextResponse.json({ error: "Gagal mengakses lampiran." }, { status: 500 });
  }
}
