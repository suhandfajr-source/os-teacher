import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyStudentSession } from "@/modules/student-auth/student-session";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { validateFileList } from "@/modules/storage/file-validation";
import {
  StorageNotConfiguredError,
  buildTmpStorageKey,
  isStorageConfigured,
  presignSubmissionUpload,
} from "@/modules/storage/storage.service";

export const dynamic = "force-dynamic";

/**
 * Story 1 — minta presigned POST untuk upload file jawaban SISWA.
 * Story 2 — + kind=attachment untuk LAMPIRAN GURU (guard: guru pemilik konteks).
 * Browser mengunggah LANGSUNG ke storage; byte tidak lewat sini.
 */

function validateSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) {
    const referer = request.headers.get("referer");
    if (!referer) return true;
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!validateSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden: permintaan lintas-asal." }, { status: 403 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Penyimpanan file belum dikonfigurasi. Hubungi pengelola." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const kind = body?.kind === "attachment" ? "attachment" : "submission";
    const rawFiles = Array.isArray(body?.files) ? body.files : null;

    if (!rawFiles) {
      return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
    }

    const validation = validateFileList(rawFiles);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    let uploads = [];

    if (kind === "attachment") {
      // ── Story 2: guru pemilik konteks (prioritas utama — sisa cookie siswa tidak memblokir) ──
      const teachingContextId =
        typeof body?.teachingContextId === "string" ? body.teachingContextId : "";
      if (!teachingContextId) {
        return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
      }

      let authResult;
      try {
        authResult = await verifyTeachingContextAccess(teachingContextId);
      } catch {
        authResult = null;
      }

      if (!authResult) {
        const studentSession = await verifyStudentSession();
        if (studentSession) {
          return NextResponse.json(
            { error: "Hanya guru pemilik kelas yang dapat mengunggah lampiran." },
            { status: 403 }
          );
        }
        return NextResponse.json({ error: "Kelas tidak tersedia." }, { status: 404 });
      }

      if (authResult.isBanned) {
        return NextResponse.json(
          { error: "Akses ditolak: Akun Anda telah dinonaktifkan." },
          { status: 403 }
        );
      }

      for (const f of validation.files) {
        const storageKey = buildTmpStorageKey(f.name, "attachment");
        uploads.push(await presignSubmissionUpload(storageKey, f.mimeType));
      }
      return NextResponse.json({ uploads });
    }

    // ── Story 1: siswa — tugas ACTIVE milik rombel periode aktifnya ──
    const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId : "";
    if (!assignmentId) {
      return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
    }

    const session = await verifyStudentSession();
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak valid atau telah berakhir." }, { status: 401 });
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
      return NextResponse.json({ error: "Data siswa tidak ditemukan." }, { status: 404 });
    }

    const activeMembership = student.classMemberships.find(
      (cm) => cm.academicPeriod.status === "ACTIVE"
    );
    if (!activeMembership) {
      return NextResponse.json(
        { error: "Belum terdaftar di rombel periode aktif." },
        { status: 403 }
      );
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { teachingContext: { select: { classId: true, academicPeriodId: true } } },
    });

    if (
      !assignment ||
      assignment.status !== "ACTIVE" ||
      assignment.teachingContext.classId !== activeMembership.classId ||
      assignment.teachingContext.academicPeriodId !== activeMembership.academicPeriodId
    ) {
      // Jangan bocorkan keberadaan tugas rombel lain
      return NextResponse.json({ error: "Tugas tidak tersedia." }, { status: 404 });
    }

    for (const f of validation.files) {
      const storageKey = buildTmpStorageKey(f.name, "submission");
      uploads.push(await presignSubmissionUpload(storageKey, f.mimeType));
    }

    return NextResponse.json({ uploads });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[upload-url route]", err);
    return NextResponse.json({ error: "Gagal menyiapkan unggahan." }, { status: 500 });
  }
}
