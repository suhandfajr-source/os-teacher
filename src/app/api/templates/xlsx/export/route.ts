import { NextRequest, NextResponse } from "next/server";
import { auth, prisma } from "@/lib/auth";
import { AiContentType, DocumentTemplateFormat, MembershipStatus } from "@prisma/client";
import { ExportWithTemplateRequest } from "@/modules/templates/template.types";
import { getDocumentTemplateWithBytes } from "@/modules/templates/template.service";
import { renderXlsxTemplate } from "@/modules/templates/xlsx-template-renderer";

/**
 * Validates request origin against host for mutation/export routes.
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

/**
 * Formats a Date object into standard Indonesian long date (e.g. "31 Agustus 2026").
 */
function formatIndonesianDate(date: Date): string {
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export async function POST(request: NextRequest) {
  // 1. Same-Origin Check
  if (!validateSameOrigin(request)) {
    return NextResponse.json(
      { error: "Forbidden: Permintaan lintas-asal (Cross-Origin) tidak diizinkan." },
      { status: 403 }
    );
  }

  // 2. Authenticate Teacher Context
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized: Sesi login tidak ditemukan." },
      { status: 401 }
    );
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

  // 3. Parse JSON Body
  let body: ExportWithTemplateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Format request body JSON tidak valid." },
      { status: 400 }
    );
  }

  const { templateId, sourceMode, draftId, contentType, title, content, teachingContextId } = body;

  if (!templateId) {
    return NextResponse.json(
      { error: "ID template (templateId) wajib disertakan." },
      { status: 400 }
    );
  }

  if (!sourceMode || !["SAVED_DRAFT", "TRANSIENT"].includes(sourceMode)) {
    return NextResponse.json(
      { error: "Mode sumber ekspor (sourceMode) harus 'SAVED_DRAFT' atau 'TRANSIENT'." },
      { status: 400 }
    );
  }

  // 4. Fetch Template with Binary Bytes
  const template = await getDocumentTemplateWithBytes({
    id: templateId,
    teacherProfileId: teacher.id,
    schoolId: teacher.activeSchoolId,
  });

  if (!template) {
    return NextResponse.json(
      { error: "Template Excel tidak ditemukan atau bukan milik Anda." },
      { status: 404 }
    );
  }

  if (template.format !== DocumentTemplateFormat.XLSX) {
    return NextResponse.json(
      { error: "Template ini bukan format Excel (.xlsx)." },
      { status: 400 }
    );
  }

  // 5. Fetch School Info
  const school = await prisma.school.findUnique({
    where: { id: teacher.activeSchoolId },
    select: { name: true },
  });
  const schoolName = school?.name || "Sekolah";
  const teacherName = teacher.preferredName || session.user.name || "Guru";

  // 6. Resolve Content Payload based on sourceMode
  let resolvedTitle = "";
  let resolvedContent = "";
  let resolvedContentType: AiContentType = template.contentType;
  let resolvedSubjectName = "";
  let resolvedClassName = "";
  let resolvedDateStr = formatIndonesianDate(new Date());

  if (sourceMode === "SAVED_DRAFT") {
    if (!draftId) {
      return NextResponse.json(
        { error: "ID draft (draftId) wajib disertakan untuk mode SAVED_DRAFT." },
        { status: 400 }
      );
    }

    const draft = await prisma.aiContentDraft.findFirst({
      where: {
        id: draftId,
        teacherProfileId: teacher.id,
        schoolId: teacher.activeSchoolId,
      },
      include: {
        teachingContext: {
          include: {
            subject: true,
            class: true,
          },
        },
      },
    });

    if (!draft) {
      return NextResponse.json(
        { error: "Draft konten AI tidak ditemukan atau bukan milik Anda." },
        { status: 404 }
      );
    }

    if (draft.contentType !== template.contentType) {
      return NextResponse.json(
        {
          error: `Tipe konten draft (${draft.contentType}) tidak cocok dengan tipe konten template (${template.contentType}).`,
        },
        { status: 400 }
      );
    }

    resolvedTitle = draft.title;
    resolvedContent = draft.content;
    resolvedContentType = draft.contentType;
    resolvedSubjectName = draft.teachingContext?.subject?.name || "";
    resolvedClassName = draft.teachingContext?.class?.name || "";
    resolvedDateStr = formatIndonesianDate(draft.createdAt);
  } else {
    // TRANSIENT Mode
    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Judul konten (title) wajib disertakan untuk mode TRANSIENT." },
        { status: 400 }
      );
    }
    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Isi konten (content) wajib disertakan untuk mode TRANSIENT." },
        { status: 400 }
      );
    }
    if (!contentType || !Object.values(AiContentType).includes(contentType)) {
      return NextResponse.json(
        { error: "Tipe konten (contentType) tidak valid untuk mode TRANSIENT." },
        { status: 400 }
      );
    }

    if (contentType !== template.contentType) {
      return NextResponse.json(
        {
          error: `Tipe konten transient (${contentType}) tidak cocok dengan tipe konten template (${template.contentType}).`,
        },
        { status: 400 }
      );
    }

    resolvedTitle = title.trim();
    resolvedContent = content.trim();
    resolvedContentType = contentType;

    // Optional TeachingContext verification
    if (teachingContextId) {
      const tc = await prisma.teachingContext.findFirst({
        where: {
          id: teachingContextId,
          teacherProfileId: teacher.id,
          schoolId: teacher.activeSchoolId,
        },
        include: {
          subject: true,
          class: true,
        },
      });

      if (tc) {
        resolvedSubjectName = tc.subject?.name || "";
        resolvedClassName = tc.class?.name || "";
      }
    }
  }

  // 7. Render Template with Content
  try {
    const templateBuffer = Buffer.from(template.fileBytes);
    const renderedXlsx = renderXlsxTemplate(templateBuffer, {
      title: resolvedTitle,
      schoolName,
      subjectName: resolvedSubjectName,
      teacherName,
      className: resolvedClassName,
      dateStr: resolvedDateStr,
      contentType: resolvedContentType,
      content: resolvedContent,
    });

    const safeTitle = resolvedTitle.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
    const downloadFileName = `${safeTitle || "dokumen"}_template.xlsx`;

    return new NextResponse(new Uint8Array(renderedXlsx), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${downloadFileName}"`,
        "Content-Length": renderedXlsx.length.toString(),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: `Gagal merender template Excel: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
