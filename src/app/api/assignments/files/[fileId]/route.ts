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
 * Story 1 — pintu tunggal akses file jawaban (K6): row → submission →
 * assignment → teachingContext. Siswa hanya file miliknya; guru hanya
 * pemilik konteks (verifyTeachingContextAccess — sekalian cek banned).
 * Lolos → HEAD-check objek → 302 ke presigned GET umur pendek.
 * Semua kegagalan akses = 404 generik (tidak membocorkan keberadaan).
 */

function notFound(message = "File tidak ditemukan.") {
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

    const file = await prisma.submissionFile.findUnique({
      where: { id: fileId },
      include: {
        submission: {
          select: {
            studentId: true,
            assignment: { select: { teachingContextId: true } },
          },
        },
      },
    });

    if (!file) return notFound();

    let authorized = false;

    // Jalur 1: siswa pemilik file (E4: cookie siswa LAIN tidak boleh
    // menghentikan pemeriksaan jalur guru — guru yang pernah test portal
    // siswa di browser sama tetap harus bisa akses).
    const studentSession = await verifyStudentSession();
    if (studentSession && studentSession.studentId === file.submission.studentId) {
      authorized = true;
    }

    // Jalur 2: guru pemilik teaching context (C4: pakai helper resmi —
    // sekalian cek membership & ban; throw apa pun = 404 generik).
    if (!authorized) {
      try {
        await verifyTeachingContextAccess(file.submission.assignment.teachingContextId);
        authorized = true;
      } catch {
        authorized = false;
      }
    }

    if (!authorized) return notFound();

    // C2: matriks frozen — objek hilang harus error ramah, bukan XML mentah
    // NoSuchKey dari storage.
    const objectSize = await headObjectSize(file.storageKey);
    if (objectSize == null) {
      return notFound("File tidak lagi tersedia di penyimpanan.");
    }

    // E3: inline hanya untuk tipe yang benar-benar aman dipratinjau (K2) —
    // permintaan inline untuk SVG/HTML/apa pun di luar previewable dipaksa
    // jadi attachment.
    const requestedInline = request.nextUrl.searchParams.get("disposition") === "inline";
    const disposition =
      requestedInline && isPreviewable(file.mimeType) ? "inline" : "attachment";

    const { url } = await presignDownload(file.storageKey, {
      filename: file.originalName,
      disposition,
    });

    return NextResponse.redirect(url, 302);
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[submission file route]", fileId, err);
    return NextResponse.json({ error: "Gagal mengakses file." }, { status: 500 });
  }
}
