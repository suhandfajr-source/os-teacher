import { NextRequest, NextResponse } from "next/server";
import { auth, prisma } from "@/lib/auth";
import { DocumentTemplateFormat, EntityStatus, MembershipStatus } from "@prisma/client";
import {
  ExportWithTemplateRequest,
  PlaceholderManifest,
} from "@/modules/templates/template.types";
import {
  renderDocxTemplate,
  createSafeContentDisposition,
  TemplateRenderContext,
} from "@/modules/templates/docx-template-renderer";

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

  // 2. Authenticate Teacher Context
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
    include: { school: true },
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
    return NextResponse.json({ error: "Format data request tidak valid (harus JSON)." }, { status: 400 });
  }

  const { templateId, sourceMode } = body;

  if (!templateId || !sourceMode) {
    return NextResponse.json(
      { error: "Parameter templateId dan sourceMode wajib disertakan." },
      { status: 400 }
    );
  }

  // 4. Fetch and Authorize DocumentTemplate
  const template = await prisma.documentTemplate.findFirst({
    where: {
      id: templateId,
      teacherProfileId: teacher.id,
      schoolId: teacher.activeSchoolId,
    },
  });

  if (!template) {
    return NextResponse.json(
      { error: "Template tidak ditemukan atau Anda tidak memiliki akses." },
      { status: 404 }
    );
  }

  if (template.status !== EntityStatus.ACTIVE) {
    return NextResponse.json(
      { error: "Template yang diarsipkan tidak dapat digunakan untuk ekspor dokumen baru." },
      { status: 400 }
    );
  }

  if (template.format !== DocumentTemplateFormat.DOCX) {
    return NextResponse.json(
      { error: "Format template ini bukan DOCX." },
      { status: 400 }
    );
  }

  // 5. Resolve Content Source (SAVED_DRAFT vs TRANSIENT)
  let renderContext: TemplateRenderContext;
  let filenameTitle: string;

  const schoolName = membership.school.name;
  const teacherName = teacher.preferredName || session.user.name || "Guru";

  if (sourceMode === "SAVED_DRAFT") {
    if (!body.draftId) {
      return NextResponse.json({ error: "draftId wajib diisi pada mode SAVED_DRAFT." }, { status: 400 });
    }

    const draft = await prisma.aiContentDraft.findFirst({
      where: {
        id: body.draftId,
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
        { error: "Draf konten AI tidak ditemukan atau Anda tidak memiliki izin akses." },
        { status: 404 }
      );
    }

    if (template.contentType !== draft.contentType) {
      return NextResponse.json(
        {
          error: `Tipe konten template (${template.contentType}) tidak sesuai dengan tipe draf (${draft.contentType}).`,
        },
        { status: 400 }
      );
    }

    renderContext = {
      title: draft.title,
      content: draft.content,
      contentType: draft.contentType,
      schoolName,
      teacherName,
      subjectName: draft.teachingContext?.subject?.name || "",
      className: draft.teachingContext?.class?.name || "",
    };
    filenameTitle = draft.title;
  } else if (sourceMode === "TRANSIENT") {
    const { title, content, contentType, teachingContextId } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Judul materi wajib diisi." }, { status: 400 });
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: "Isi materi wajib diisi." }, { status: 400 });
    }

    if (!contentType) {
      return NextResponse.json({ error: "Tipe konten (contentType) wajib disertakan." }, { status: 400 });
    }

    if (template.contentType !== contentType) {
      return NextResponse.json(
        {
          error: `Tipe konten template (${template.contentType}) tidak sesuai dengan konten yang diekspor (${contentType}).`,
        },
        { status: 400 }
      );
    }

    if (content.length > 50_000) {
      return NextResponse.json(
        { error: "Panjang konten draf melebihi batas maksimum (50.000 karakter)." },
        { status: 400 }
      );
    }

    let subjectName = "";
    let className = "";

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

      if (!tc) {
        return NextResponse.json(
          { error: "Konteks pembelajaran (teachingContextId) tidak valid atau bukan milik Anda." },
          { status: 403 }
        );
      }

      subjectName = tc.subject.name;
      className = tc.class.name;
    }

    renderContext = {
      title: title.trim(),
      content: content.trim(),
      contentType,
      schoolName,
      teacherName,
      subjectName,
      className,
    };
    filenameTitle = title.trim();
  } else {
    return NextResponse.json({ error: "sourceMode tidak valid." }, { status: 400 });
  }

  // 6. Render Document via Docxtemplater
  try {
    const generatedBuffer = await renderDocxTemplate(
      Buffer.from(template.fileBytes),
      template.placeholderManifest as unknown as PlaceholderManifest,
      renderContext
    );

    const safeDisposition = createSafeContentDisposition(filenameTitle);

    return new NextResponse(new Uint8Array(generatedBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": safeDisposition,
        "Content-Length": generatedBuffer.length.toString(),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
