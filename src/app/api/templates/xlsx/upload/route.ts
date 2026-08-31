import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth, prisma } from "@/lib/auth";
import { AiContentType, DocumentTemplateFormat, MembershipStatus } from "@prisma/client";
import {
  MAX_MULTIPART_REQUEST_BYTES,
  MAX_TEMPLATE_FILE_BYTES,
} from "@/modules/templates/template.types";
import { validateXlsxSecurityPreflight } from "@/modules/templates/xlsx-security-validator";
import { validateXlsxPlaceholders } from "@/modules/templates/xlsx-placeholder-parser";
import { createDocumentTemplate } from "@/modules/templates/template.service";

/**
 * Validates request origin against host for mutation routes.
 */
function validateSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    const referer = request.headers.get("referer");
    if (!referer) return true;
    try {
      const refUrl = new URL(referer);
      return refUrl.host === host;
    } catch {
      return false;
    }
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // 1. Same-Origin Check
  if (!validateSameOrigin(request)) {
    return NextResponse.json(
      { error: "Forbidden: Permintaan lintas-asal (Cross-Origin) tidak diizinkan." },
      { status: 403 }
    );
  }

  // 2. Early Content-Length Check (3 MB limit for multipart request)
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_MULTIPART_REQUEST_BYTES) {
    return NextResponse.json(
      {
        error: `Ukuran payload request (${contentLength} byte) melebihi batas maksimum (${MAX_MULTIPART_REQUEST_BYTES} byte / 3 MB).`,
      },
      { status: 413 }
    );
  }

  // 3. Authenticate Teacher Context
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized: Sesi login tidak ditemukan." }, { status: 401 });
  }

  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!teacher || !teacher.activeSchoolId) {
    return NextResponse.json(
      { error: "Forbidden: Profil guru atau sekolah aktif tidak ditemukan." },
      { status: 403 }
    );
  }

  const membership = await prisma.teacherSchoolMembership.findUnique({
    where: {
      teacherProfileId_schoolId: {
        teacherProfileId: teacher.id,
        schoolId: teacher.activeSchoolId,
      },
    },
  });

  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    return NextResponse.json(
      { error: "Forbidden: Keanggotaan sekolah guru tidak aktif atau telah dicabut." },
      { status: 403 }
    );
  }

  // 4. Parse Multipart FormData
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err: unknown) {
    return NextResponse.json(
      { error: `Gagal membaca formulir unggahan: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const name = formData.get("name") as string | null;
  const contentType = formData.get("contentType") as AiContentType | null;
  const fileEntries = formData.getAll("file");

  if (fileEntries.length === 0) {
    return NextResponse.json(
      { error: "File template wajib diunggah." },
      { status: 400 }
    );
  }

  if (fileEntries.length > 1) {
    return NextResponse.json(
      { error: "Hanya satu file template Excel (.xlsx) yang dapat diunggah dalam satu permintaan." },
      { status: 400 }
    );
  }

  const file = fileEntries[0] as File;

  if (!name || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Nama template wajib diisi." },
      { status: 400 }
    );
  }

  if (!contentType || !Object.values(AiContentType).includes(contentType)) {
    return NextResponse.json(
      { error: "Tipe konten (contentType) tidak valid." },
      { status: 400 }
    );
  }

  // 5. Validate File Size
  if (file.size > MAX_TEMPLATE_FILE_BYTES) {
    return NextResponse.json(
      {
        error: `Ukuran file (${file.size} byte) melebihi batas maksimum (${MAX_TEMPLATE_FILE_BYTES} byte / 2 MB).`,
      },
      { status: 413 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json(
      { error: "File template Excel tidak boleh kosong (0 byte)." },
      { status: 400 }
    );
  }

  // 6. Validate File Extension & Format
  const fileName = file.name || "template.xlsx";
  const lowerName = fileName.toLowerCase();
  if (!lowerName.endsWith(".xlsx")) {
    return NextResponse.json(
      {
        error: "Format file tidak didukung. Harap unggah file template Microsoft Excel (.xlsx).",
      },
      { status: 400 }
    );
  }

  // 7. Read File Bytes & Compute SHA-256 Checksum
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const checksumSha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  // 8. Run Security Preflight & Structural Parsing
  const preflight = await validateXlsxSecurityPreflight(fileBuffer);
  if (!preflight.valid) {
    return NextResponse.json(
      { error: preflight.error || "Validasi keamanan file Excel gagal." },
      { status: 400 }
    );
  }

  const validation = validateXlsxPlaceholders(preflight, contentType, checksumSha256);
  if (!validation.valid || !validation.manifest) {
    return NextResponse.json(
      {
        error: validation.error || "Validasi placeholder Excel gagal.",
        unsupportedTags: validation.unsupportedTags,
      },
      { status: 400 }
    );
  }

  // 9. Persist DocumentTemplate to PostgreSQL
  try {
    const created = await createDocumentTemplate({
      teacherProfileId: teacher.id,
      schoolId: teacher.activeSchoolId,
      name: name.trim(),
      contentType,
      format: DocumentTemplateFormat.XLSX,
      originalFileName: fileName,
      mimeType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileBytes: fileBuffer,
      fileSize: file.size,
      checksumSha256,
      placeholderManifest: validation.manifest,
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: `Gagal menyimpan template: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
