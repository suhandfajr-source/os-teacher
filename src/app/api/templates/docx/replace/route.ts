import { NextRequest, NextResponse } from "next/server";
import { auth, prisma } from "@/lib/auth";
import { AiContentType, MembershipStatus } from "@prisma/client";
import {
  MAX_MULTIPART_REQUEST_BYTES,
  MAX_TEMPLATE_FILE_BYTES,
} from "@/modules/templates/template.types";
import { validateAndParseDocxTemplate } from "@/modules/templates/docx-placeholder-parser";
import { replaceDocumentTemplate } from "@/modules/templates/template.service";

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

  // 2. Early Content-Length Check (3 MB limit)
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

  // 4. Parse FormData
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err: unknown) {
    return NextResponse.json(
      { error: `Gagal membaca formulir unggahan: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const oldTemplateId = (formData.get("oldTemplateId") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const contentType = formData.get("contentType") as AiContentType;
  const fileEntries = formData.getAll("file");

  if (!oldTemplateId) {
    return NextResponse.json(
      { error: "ID template lama (oldTemplateId) wajib disertakan." },
      { status: 400 }
    );
  }

  // Exactly One File Rule
  if (fileEntries.length === 0) {
    return NextResponse.json(
      { error: "File template pengganti (.docx) wajib diunggah." },
      { status: 400 }
    );
  }

  if (fileEntries.length > 1) {
    return NextResponse.json(
      { error: "Hanya satu file dokumen yang dapat diunggah dalam satu waktu." },
      { status: 400 }
    );
  }

  const file = fileEntries[0];
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Entri unggahan bukan merupakan file biner yang valid." },
      { status: 400 }
    );
  }

  if (!name) {
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

  // Post-Parse File Size Verification (2 MB limit)
  if (file.size > MAX_TEMPLATE_FILE_BYTES) {
    return NextResponse.json(
      {
        error: `Ukuran file '${file.name}' (${file.size} byte) melebihi batas maksimum (${MAX_TEMPLATE_FILE_BYTES} byte / 2 MB).`,
      },
      { status: 413 }
    );
  }

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith(".docx")) {
    return NextResponse.json(
      { error: "Format file tidak didukung. Harap unggah file dokumen Word (.docx)." },
      { status: 415 }
    );
  }

  // 5. Pre-Validate File COMPLETELY BEFORE DB Transaction
  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = Buffer.from(arrayBuffer);

  const validation = await validateAndParseDocxTemplate(fileBytes, contentType);
  if (!validation.valid || !validation.manifest || !validation.checksumSha256) {
    return NextResponse.json(
      {
        error: validation.error || "Validasi template gagal.",
        unsupportedTags: validation.unsupportedTags,
      },
      { status: 422 }
    );
  }

  // 6. Execute Atomic Replace Transaction
  try {
    const replaced = await replaceDocumentTemplate({
      oldTemplateId,
      teacherProfileId: teacher.id,
      schoolId: teacher.activeSchoolId,
      name,
      contentType,
      originalFileName: file.name,
      mimeType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBytes,
      fileSize: file.size,
      checksumSha256: validation.checksumSha256,
      placeholderManifest: validation.manifest,
    });

    return NextResponse.json({ success: true, data: replaced }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
