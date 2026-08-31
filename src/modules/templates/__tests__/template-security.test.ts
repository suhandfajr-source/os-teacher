import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/auth";
import {
  AiContentType,
  AiDraftStatus,
  DocumentTemplateFormat,
  EntityStatus,
  MembershipStatus,
} from "@prisma/client";
import {
  createDocumentTemplate,
  getDocumentTemplateMetadata,
  getDocumentTemplateWithBytes,
  listDocumentTemplates,
  archiveDocumentTemplate,
  replaceDocumentTemplate,
} from "../template.service";
import { renderDocxTemplate, createSafeContentDisposition } from "../docx-template-renderer";
import { MAX_GENERATED_DOCX_BYTES } from "../template.types";
import PizZip from "pizzip";

describe("PHASE B: DocumentTemplate Security, Authorization, IDOR & Concurrency Suite", () => {
  let schoolAId: string;
  let schoolBId: string;

  let teacher1Id: string;
  let teacher2Id: string; // Same school, different teacher
  let teacher3Id: string; // Different school
  let revokedTeacherId: string; // Revoked membership in School A

  let activeTemplateId: string;
  let archivedTemplateId: string;
  let sampleDraftId: string;
  let foreignDraftId: string;

  let tc1Id: string; // TeachingContext owned by Teacher 1
  let tc2Id: string; // TeachingContext owned by Teacher 2

  const sampleManifest = {
    version: 1,
    detectedPlaceholders: [
      "JUDUL",
      "ISI_KONTEN",
      "MATA_PELAJARAN",
      "KELAS",
      "NAMA_SEKOLAH",
      "TUJUAN_PEMBELAJARAN",
      "LANGKAH_PEMBELAJARAN",
    ],
    recognized: [
      "JUDUL",
      "ISI_KONTEN",
      "MATA_PELAJARAN",
      "KELAS",
      "NAMA_SEKOLAH",
      "TUJUAN_PEMBELAJARAN",
      "LANGKAH_PEMBELAJARAN",
    ],
    unsupported: [],
    contentBearing: ["ISI_KONTEN", "TUJUAN_PEMBELAJARAN", "LANGKAH_PEMBELAJARAN"],
    hasHeaders: false,
    hasFooters: false,
    hasTables: true,
  };

  function createValidDocxBuffer(): Buffer {
    const zip = new PizZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      </Types>`
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>`
    );
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>{{JUDUL}}</w:t></w:r></w:p>
          <w:p><w:r><w:t>{{TUJUAN_PEMBELAJARAN}}</w:t></w:r></w:p>
          <w:p><w:r><w:t>{{LANGKAH_PEMBELAJARAN}}</w:t></w:r></w:p>
          <w:p><w:r><w:t>{{ISI_KONTEN}}</w:t></w:r></w:p>
        </w:body>
      </w:document>`
    );
    return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  }

  beforeAll(async () => {
    // Initial cleanup of test records if any exist
    const testUserIds = ["sec-user-1", "sec-user-2", "sec-user-3", "sec-user-rev"];
    const testSchools = await prisma.school.findMany({
      where: { normalizedName: { in: ["sma security test a", "sma security test b"] } },
      select: { id: true },
    });
    const testSchoolIds = testSchools.map((s) => s.id);

    await prisma.documentTemplate.deleteMany({
      where: {
        OR: [
          { teacherProfile: { userId: { in: testUserIds } } },
          { schoolId: { in: testSchoolIds } },
        ],
      },
    });
    await prisma.aiContentDraft.deleteMany({
      where: {
        OR: [
          { teacherProfile: { userId: { in: testUserIds } } },
          { schoolId: { in: testSchoolIds } },
        ],
      },
    });
    await prisma.teachingContext.deleteMany({
      where: {
        OR: [
          { teacherProfile: { userId: { in: testUserIds } } },
          { schoolId: { in: testSchoolIds } },
        ],
      },
    });
    await prisma.teacherSchoolMembership.deleteMany({
      where: {
        OR: [
          { teacherProfile: { userId: { in: testUserIds } } },
          { schoolId: { in: testSchoolIds } },
        ],
      },
    });
    await prisma.teacherProfile.deleteMany({
      where: { userId: { in: testUserIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: testUserIds } },
    });
    if (testSchoolIds.length > 0) {
      await prisma.class.deleteMany({ where: { schoolId: { in: testSchoolIds } } });
      await prisma.subject.deleteMany({ where: { schoolId: { in: testSchoolIds } } });
      await prisma.academicPeriod.deleteMany({ where: { schoolId: { in: testSchoolIds } } });
      await prisma.school.deleteMany({ where: { id: { in: testSchoolIds } } });
    }

    // 1. Create School A & B
    const schoolA = await prisma.school.create({
      data: {
        name: "SMA Security Test A",
        normalizedName: "sma security test a",
      },
    });
    schoolAId = schoolA.id;

    const schoolB = await prisma.school.create({
      data: {
        name: "SMA Security Test B",
        normalizedName: "sma security test b",
      },
    });
    schoolBId = schoolB.id;

    // Academic Period, Subject, Class for TeachingContexts
    const periodA = await prisma.academicPeriod.create({
      data: {
        schoolId: schoolAId,
        year: "2026/2027",
        semester: "GANJIL",
        status: "ACTIVE",
      },
    });
    const subA = await prisma.subject.create({
      data: {
        schoolId: schoolAId,
        name: "Biologi",
        normalizedName: "biologi",
      },
    });
    const clsA = await prisma.class.create({
      data: {
        schoolId: schoolAId,
        name: "XI IPA 1",
        normalizedName: "xi ipa 1",
      },
    });

    // 2. Create Users & Teacher Profiles
    const user1 = await prisma.user.create({
      data: {
        id: "sec-user-1",
        name: "Teacher 1",
        email: "sec1@teacher.test",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const tp1 = await prisma.teacherProfile.create({
      data: {
        userId: user1.id,
        activeSchoolId: schoolAId,
      },
    });
    teacher1Id = tp1.id;
    await prisma.teacherSchoolMembership.create({
      data: {
        teacherProfileId: teacher1Id,
        schoolId: schoolAId,
        status: MembershipStatus.ACTIVE,
      },
    });

    const tc1 = await prisma.teachingContext.create({
      data: {
        teacherProfileId: teacher1Id,
        schoolId: schoolAId,
        academicPeriodId: periodA.id,
        subjectId: subA.id,
        classId: clsA.id,
      },
    });
    tc1Id = tc1.id;

    const user2 = await prisma.user.create({
      data: {
        id: "sec-user-2",
        name: "Teacher 2",
        email: "sec2@teacher.test",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const tp2 = await prisma.teacherProfile.create({
      data: {
        userId: user2.id,
        activeSchoolId: schoolAId,
      },
    });
    teacher2Id = tp2.id;
    await prisma.teacherSchoolMembership.create({
      data: {
        teacherProfileId: teacher2Id,
        schoolId: schoolAId,
        status: MembershipStatus.ACTIVE,
      },
    });

    const tc2 = await prisma.teachingContext.create({
      data: {
        teacherProfileId: teacher2Id,
        schoolId: schoolAId,
        academicPeriodId: periodA.id,
        subjectId: subA.id,
        classId: clsA.id,
      },
    });
    tc2Id = tc2.id;

    const user3 = await prisma.user.create({
      data: {
        id: "sec-user-3",
        name: "Teacher 3",
        email: "sec3@teacher.test",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const tp3 = await prisma.teacherProfile.create({
      data: {
        userId: user3.id,
        activeSchoolId: schoolBId,
      },
    });
    teacher3Id = tp3.id;
    await prisma.teacherSchoolMembership.create({
      data: {
        teacherProfileId: teacher3Id,
        schoolId: schoolBId,
        status: MembershipStatus.ACTIVE,
      },
    });

    // Revoked Teacher in School A
    const userRev = await prisma.user.create({
      data: {
        id: "sec-user-rev",
        name: "Revoked Teacher",
        email: "revoked@teacher.test",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const tpRev = await prisma.teacherProfile.create({
      data: {
        userId: userRev.id,
        activeSchoolId: schoolAId,
      },
    });
    revokedTeacherId = tpRev.id;
    await prisma.teacherSchoolMembership.create({
      data: {
        teacherProfileId: revokedTeacherId,
        schoolId: schoolAId,
        status: MembershipStatus.REVOKED,
      },
    });

    const docxBuf = createValidDocxBuffer();

    // 3. Create active template for Teacher 1
    const created = await createDocumentTemplate({
      teacherProfileId: teacher1Id,
      schoolId: schoolAId,
      name: "Template Guru 1",
      contentType: AiContentType.LESSON_PLAN,
      format: DocumentTemplateFormat.DOCX,
      originalFileName: "template_guru1.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBytes: docxBuf,
      fileSize: docxBuf.length,
      checksumSha256: "mock_sha_256",
      placeholderManifest: sampleManifest,
    });
    activeTemplateId = created.id;

    // Archived template for Teacher 1
    const archived = await createDocumentTemplate({
      teacherProfileId: teacher1Id,
      schoolId: schoolAId,
      name: "Template Terarsip",
      contentType: AiContentType.LESSON_PLAN,
      format: DocumentTemplateFormat.DOCX,
      originalFileName: "archived.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBytes: docxBuf,
      fileSize: docxBuf.length,
      checksumSha256: "mock_sha_archived",
      placeholderManifest: sampleManifest,
    });
    await prisma.documentTemplate.update({
      where: { id: archived.id },
      data: { status: EntityStatus.ARCHIVED, archivedAt: new Date() },
    });
    archivedTemplateId = archived.id;

    // 4. Create sample AI content drafts
    const draft1 = await prisma.aiContentDraft.create({
      data: {
        teacherProfileId: teacher1Id,
        schoolId: schoolAId,
        teachingContextId: tc1Id,
        contentType: AiContentType.LESSON_PLAN,
        title: "RPP Biologi Sel Guru 1",
        topic: "Struktur Sel",
        content: "## Tujuan Pembelajaran\n- Memahami membran sel.\n\n## Langkah-Langkah\n- Diskusi kelompok.",
        status: AiDraftStatus.ACTIVE,
      },
    });
    sampleDraftId = draft1.id;

    const draft2 = await prisma.aiContentDraft.create({
      data: {
        teacherProfileId: teacher2Id,
        schoolId: schoolAId,
        teachingContextId: tc2Id,
        contentType: AiContentType.LESSON_PLAN,
        title: "RPP Biologi Sel Guru 2",
        topic: "Struktur Sel Guru 2",
        content: "## Tujuan Pembelajaran\n- Memahami membran sel.",
        status: AiDraftStatus.ACTIVE,
      },
    });
    foreignDraftId = draft2.id;
  }, 45000);

  afterAll(async () => {
    // Cleanup created test records safely
    const tpIds = [teacher1Id, teacher2Id, teacher3Id, revokedTeacherId].filter(Boolean);
    const schIds = [schoolAId, schoolBId].filter(Boolean);

    await prisma.documentTemplate.deleteMany({
      where: {
        OR: [
          { teacherProfileId: { in: tpIds } },
          { schoolId: { in: schIds } },
        ],
      },
    });
    await prisma.aiContentDraft.deleteMany({
      where: {
        OR: [
          { teacherProfileId: { in: tpIds } },
          { schoolId: { in: schIds } },
        ],
      },
    });
    await prisma.teachingContext.deleteMany({
      where: {
        OR: [
          { teacherProfileId: { in: tpIds } },
          { schoolId: { in: schIds } },
        ],
      },
    });
    await prisma.teacherSchoolMembership.deleteMany({
      where: {
        OR: [
          { teacherProfileId: { in: tpIds } },
          { schoolId: { in: schIds } },
        ],
      },
    });
    if (tpIds.length > 0) {
      await prisma.teacherProfile.deleteMany({
        where: { id: { in: tpIds } },
      });
    }
    await prisma.user.deleteMany({
      where: {
        id: { in: ["sec-user-1", "sec-user-2", "sec-user-3", "sec-user-rev"] },
      },
    });
    if (schIds.length > 0) {
      await prisma.class.deleteMany({ where: { schoolId: { in: schIds } } });
      await prisma.subject.deleteMany({ where: { schoolId: { in: schIds } } });
      await prisma.academicPeriod.deleteMany({ where: { schoolId: { in: schIds } } });
      await prisma.school.deleteMany({ where: { id: { in: schIds } } });
    }
  }, 45000);

  // ==========================================================================
  // AUTH & MULTI-TENANCY ISOLATION TESTS
  // ==========================================================================

  it("AUTH: SAME-SCHOOL OTHER TEACHER: Teacher 2 cannot view or access Teacher 1's template", async () => {
    const meta = await getDocumentTemplateMetadata({
      id: activeTemplateId,
      teacherProfileId: teacher2Id,
      schoolId: schoolAId,
    });
    expect(meta).toBeNull();
  }, 30000);

  it("AUTH: CROSS-SCHOOL ISOLATION: Teacher 3 (School B) cannot view Teacher 1's template", async () => {
    const meta = await getDocumentTemplateMetadata({
      id: activeTemplateId,
      teacherProfileId: teacher3Id,
      schoolId: schoolBId,
    });
    expect(meta).toBeNull();
  }, 30000);

  it("AUTH: ARCHIVE IDOR: Teacher 2 cannot archive Teacher 1's template", async () => {
    const success = await archiveDocumentTemplate({
      id: activeTemplateId,
      teacherProfileId: teacher2Id,
      schoolId: schoolAId,
    });
    expect(success).toBe(false);

    // Verify still active
    const check = await getDocumentTemplateMetadata({
      id: activeTemplateId,
      teacherProfileId: teacher1Id,
      schoolId: schoolAId,
    });
    expect(check?.status).toBe(EntityStatus.ACTIVE);
  }, 30000);

  it("AUTH: REPLACE IDOR: Teacher 2 cannot replace Teacher 1's template", async () => {
    await expect(
      replaceDocumentTemplate({
        oldTemplateId: activeTemplateId,
        teacherProfileId: teacher2Id,
        schoolId: schoolAId,
        name: "Malicious Replacement",
        contentType: AiContentType.LESSON_PLAN,
        originalFileName: "evil.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileBytes: Buffer.from("EVIL_BYTES"),
        fileSize: 10,
        checksumSha256: "evil_sha",
        placeholderManifest: sampleManifest,
      })
    ).rejects.toThrow(/tidak ditemukan, tidak aktif/);
  }, 30000);

  it("AUTH: ARCHIVED TEMPLATE EXPORT DENIAL: Cannot retrieve bytes or export with ARCHIVED template", async () => {
    const res = await getDocumentTemplateWithBytes({
      id: archivedTemplateId,
      teacherProfileId: teacher1Id,
      schoolId: schoolAId,
    });
    expect(res).toBeNull();
  }, 30000);

  it("AUTH: LIST NEVER RETURNS FILEBYTES: listDocumentTemplates strips binary bytes completely", async () => {
    const list = await listDocumentTemplates({
      teacherProfileId: teacher1Id,
      schoolId: schoolAId,
    });
    expect(list.length).toBeGreaterThanOrEqual(1);
    const item = list[0] as unknown as Record<string, unknown>;
    expect(item.fileBytes).toBeUndefined();
  }, 30000);

  it("AUTH: SAVED DRAFT IDOR: Teacher 1 cannot export another teacher's saved draft", async () => {
    const foreignDraft = await prisma.aiContentDraft.findFirst({
      where: {
        id: foreignDraftId,
        teacherProfileId: teacher1Id,
        schoolId: schoolAId,
      },
    });
    expect(foreignDraft).toBeNull();
  }, 30000);

  it("AUTH: TRANSIENT CONTEXT IDOR: Teacher 1 cannot bind another teacher's TeachingContext", async () => {
    const foreignContext = await prisma.teachingContext.findFirst({
      where: {
        id: tc2Id,
        teacherProfileId: teacher1Id,
        schoolId: schoolAId,
      },
    });
    expect(foreignContext).toBeNull();
  }, 30000);

  it("AUTH: CONTENT TYPE MISMATCH: LESSON_PLAN draft cannot be exported with RUBRIC template", async () => {
    const rubricTemplate = await createDocumentTemplate({
      teacherProfileId: teacher1Id,
      schoolId: schoolAId,
      name: "Rubrik Template Khusus",
      contentType: AiContentType.RUBRIC,
      format: DocumentTemplateFormat.DOCX,
      originalFileName: "rubrik.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBytes: Buffer.from("RUBRIC_BYTES"),
      fileSize: 12,
      checksumSha256: "sha_rubric",
      placeholderManifest: {
        ...sampleManifest,
        detectedPlaceholders: ["JUDUL", "RUBRIK_PENILAIAN"],
        recognized: ["JUDUL", "RUBRIK_PENILAIAN"],
        contentBearing: ["RUBRIK_PENILAIAN"],
      },
    });

    const draft = await prisma.aiContentDraft.findUnique({
      where: { id: sampleDraftId },
    });
    expect(draft?.contentType).toBe(AiContentType.LESSON_PLAN);
    expect(rubricTemplate.contentType).toBe(AiContentType.RUBRIC);
    expect(draft?.contentType).not.toBe(rubricTemplate.contentType);
  }, 30000);

  // ==========================================================================
  // REPLACE HISTORICAL PRESERVATION & ATOMICITY TESTS
  // ==========================================================================

  it("REPLACE: HISTORICAL PRESERVATION: replacement creates a NEW id while preserving old template as ARCHIVED", async () => {
    const originalBytes = Buffer.from("ORIGINAL_TEMPLATE_BYTES_V1");
    const originalChecksum = "sha256_original_v1";

    const oldTemplate = await createDocumentTemplate({
      teacherProfileId: teacher1Id,
      schoolId: schoolAId,
      name: "Template Versi Asli",
      contentType: AiContentType.LESSON_PLAN,
      format: DocumentTemplateFormat.DOCX,
      originalFileName: "versi_1.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBytes: originalBytes,
      fileSize: originalBytes.length,
      checksumSha256: originalChecksum,
      placeholderManifest: sampleManifest,
    });

    const newBytes = Buffer.from("NEW_REPLACEMENT_BYTES_V2");
    const newChecksum = "sha256_replacement_v2";

    const replaced = await replaceDocumentTemplate({
      oldTemplateId: oldTemplate.id,
      teacherProfileId: teacher1Id,
      schoolId: schoolAId,
      name: "Template Versi Baru",
      contentType: AiContentType.LESSON_PLAN,
      originalFileName: "versi_2.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBytes: newBytes,
      fileSize: newBytes.length,
      checksumSha256: newChecksum,
      placeholderManifest: sampleManifest,
    });

    // 1. Replacement creates a NEW id
    expect(replaced.id).not.toBe(oldTemplate.id);
    expect(replaced.status).toBe(EntityStatus.ACTIVE);
    expect(replaced.name).toBe("Template Versi Baru");
    expect(replaced.checksumSha256).toBe(newChecksum);

    // 2. Old template remains in DB as ARCHIVED
    const oldRecord = await prisma.documentTemplate.findUnique({
      where: { id: oldTemplate.id },
    });
    expect(oldRecord).not.toBeNull();
    expect(oldRecord?.status).toBe(EntityStatus.ARCHIVED);
    expect(oldRecord?.archivedAt).toBeDefined();

    // 3. Old fileBytes and checksum remain strictly unchanged
    expect(Buffer.from(oldRecord!.fileBytes).toString("utf-8")).toBe("ORIGINAL_TEMPLATE_BYTES_V1");
    expect(oldRecord?.checksumSha256).toBe(originalChecksum);
    expect(oldRecord?.name).toBe("Template Versi Asli");
  }, 30000);

  it("REPLACE: INVALID REPLACEMENT LEAVES OLD TEMPLATE ACTIVE", async () => {
    const originalBytes = Buffer.from("UNTOUCHED_BYTES");
    const originalTemplate = await createDocumentTemplate({
      teacherProfileId: teacher1Id,
      schoolId: schoolAId,
      name: "Template Aman",
      contentType: AiContentType.LESSON_PLAN,
      format: DocumentTemplateFormat.DOCX,
      originalFileName: "aman.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBytes: originalBytes,
      fileSize: originalBytes.length,
      checksumSha256: "sha_aman",
      placeholderManifest: sampleManifest,
    });

    // Attempt replace with wrong teacherProfileId (IDOR simulation)
    await expect(
      replaceDocumentTemplate({
        oldTemplateId: originalTemplate.id,
        teacherProfileId: teacher2Id,
        schoolId: schoolAId,
        name: "Replacement Gagal",
        contentType: AiContentType.LESSON_PLAN,
        originalFileName: "gagal.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileBytes: Buffer.from("FAIL_BYTES"),
        fileSize: 10,
        checksumSha256: "sha_fail",
        placeholderManifest: sampleManifest,
      })
    ).rejects.toThrow();

    // Verify old template is still ACTIVE
    const check = await prisma.documentTemplate.findUnique({
      where: { id: originalTemplate.id },
    });
    expect(check?.status).toBe(EntityStatus.ACTIVE);
    expect(check?.archivedAt).toBeNull();
  }, 30000);

  // ==========================================================================
  // REVOKED MEMBERSHIP DENIAL TESTS
  // ==========================================================================

  it("REVOKED: Teacher with REVOKED membership is denied access to all template operations", async () => {
    const membership = await prisma.teacherSchoolMembership.findFirst({
      where: {
        teacherProfileId: revokedTeacherId,
        schoolId: schoolAId,
      },
    });
    expect(membership?.status).toBe(MembershipStatus.REVOKED);

    // 1. List templates for revoked teacher returns empty
    const list = await listDocumentTemplates({
      teacherProfileId: revokedTeacherId,
      schoolId: schoolAId,
    });
    expect(list).toHaveLength(0);

    // 2. Metadata retrieval for revoked teacher is denied (null)
    const meta = await getDocumentTemplateMetadata({
      id: activeTemplateId,
      teacherProfileId: revokedTeacherId,
      schoolId: schoolAId,
    });
    expect(meta).toBeNull();

    // 3. Archiving template by revoked teacher is denied
    const archived = await archiveDocumentTemplate({
      id: activeTemplateId,
      teacherProfileId: revokedTeacherId,
      schoolId: schoolAId,
    });
    expect(archived).toBe(false);

    // 4. Byte retrieval for export by revoked teacher is denied
    const bytes = await getDocumentTemplateWithBytes({
      id: activeTemplateId,
      teacherProfileId: revokedTeacherId,
      schoolId: schoolAId,
    });
    expect(bytes).toBeNull();

    // 5. Replace by revoked teacher fails authorization check
    await expect(
      replaceDocumentTemplate({
        oldTemplateId: activeTemplateId,
        teacherProfileId: revokedTeacherId,
        schoolId: schoolAId,
        name: "Replacement Revoked",
        contentType: AiContentType.LESSON_PLAN,
        originalFileName: "revoked.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileBytes: Buffer.from("REVOKED_BYTES"),
        fileSize: 13,
        checksumSha256: "sha_rev",
        placeholderManifest: sampleManifest,
      })
    ).rejects.toThrow(/tidak ditemukan, tidak aktif, atau Anda tidak memiliki izin/);
  }, 30000);

  // ==========================================================================
  // CONCURRENT REPLACE ATOMICITY TESTS
  // ==========================================================================

  it("REPLACE: CONCURRENT REPLACE CONFLICT: Two simultaneous replacements -> exactly 1 winner, 1 loser, old archived once, exactly 1 active replacement", async () => {
    const target = await createDocumentTemplate({
      teacherProfileId: teacher1Id,
      schoolId: schoolAId,
      name: "Concurrent Replace Target",
      contentType: AiContentType.TASK_INSTRUCTION,
      format: DocumentTemplateFormat.DOCX,
      originalFileName: "concurrent.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBytes: Buffer.from("DOCX_CONCURRENT_BYTES"),
      fileSize: 20,
      checksumSha256: "sha_concurrent",
      placeholderManifest: sampleManifest,
    });

    const p1 = replaceDocumentTemplate({
      oldTemplateId: target.id,
      teacherProfileId: teacher1Id,
      schoolId: schoolAId,
      name: "Replacement Version 1",
      contentType: AiContentType.TASK_INSTRUCTION,
      originalFileName: "v1.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBytes: Buffer.from("V1_BYTES"),
      fileSize: 8,
      checksumSha256: "sha_v1",
      placeholderManifest: sampleManifest,
    });

    const p2 = replaceDocumentTemplate({
      oldTemplateId: target.id,
      teacherProfileId: teacher1Id,
      schoolId: schoolAId,
      name: "Replacement Version 2",
      contentType: AiContentType.TASK_INSTRUCTION,
      originalFileName: "v2.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBytes: Buffer.from("V2_BYTES"),
      fileSize: 8,
      checksumSha256: "sha_v2",
      placeholderManifest: sampleManifest,
    });

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // Old template must be archived exactly once
    const oldRecord = await prisma.documentTemplate.findUnique({
      where: { id: target.id },
    });
    expect(oldRecord?.status).toBe(EntityStatus.ARCHIVED);
    expect(oldRecord?.archivedAt).toBeDefined();

    // Exactly one winner template exists as ACTIVE in DB
    const winnerItem = (fulfilled[0] as PromiseFulfilledResult<{ id: string }>).value;
    const winnerRecord = await prisma.documentTemplate.findUnique({
      where: { id: winnerItem.id },
    });
    expect(winnerRecord?.status).toBe(EntityStatus.ACTIVE);
  }, 30000);

  // ==========================================================================
  // SAME-ORIGIN SECURITY TESTS
  // ==========================================================================

  describe("SAME-ORIGIN ENFORCEMENT", () => {
    it("rejects cross-origin requests on upload route with 403 Forbidden", async () => {
      const { POST: uploadRoute } = await import("@/app/api/templates/docx/upload/route");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest("http://localhost:3000/api/templates/docx/upload", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "https://malicious-attacker.com",
        },
      });

      const res = await uploadRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Cross-Origin/);
    });

    it("rejects cross-origin requests on replace route with 403 Forbidden", async () => {
      const { POST: replaceRoute } = await import("@/app/api/templates/docx/replace/route");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest("http://localhost:3000/api/templates/docx/replace", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "https://evil-site.com",
        },
      });

      const res = await replaceRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Cross-Origin/);
    });

    it("rejects cross-origin requests on export route with 403 Forbidden", async () => {
      const { POST: exportRoute } = await import("@/app/api/templates/docx/export/route");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest("http://localhost:3000/api/templates/docx/export", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "https://evil-site.com",
        },
      });

      const res = await exportRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Cross-Origin/);
    });
  });

  // ==========================================================================
  // OUTPUT HEADER & BOUNDARY TESTS
  // ==========================================================================

  it("OUTPUT: RFC5987 & Safe ASCII Content-Disposition format with CRLF injection protection", () => {
    const maliciousTitle = "Modul Ajar\r\nBiologi: Sel & Jaringan";
    const disposition = createSafeContentDisposition(maliciousTitle);

    expect(disposition).not.toContain("\r");
    expect(disposition).not.toContain("\n");
    expect(disposition).toContain('filename="Modul_Ajar_Biologi_Sel_Jaringan.docx"');
    expect(disposition).toContain("filename*=UTF-8''Modul%20Ajar%20Biologi%20Sel%20Jaringan.docx");
  });

  it("OUTPUT: REJECTS generated DOCX exceeding 4 MB (MAX_GENERATED_DOCX_BYTES)", async () => {
    const docxBuf = createValidDocxBuffer();
    const crypto = await import("crypto");
    // Generate uncompressible random hex string to exceed 4 MB after zip compression
    const uncompressible = crypto.randomBytes(4_500_000).toString("hex");

    await expect(
      renderDocxTemplate(docxBuf, sampleManifest, {
        title: "Dokumen Raksasa",
        content: uncompressible,
        contentType: "LESSON_PLAN",
      })
    ).rejects.toThrow(/melebihi batas/);
  }, 30000);

  // ==========================================================================
  // PRODUCT EXPORT INTEGRATION (SAVED_DRAFT & TRANSIENT MODES)
  // ==========================================================================

  it("HAPPY-PATH: SAVED_DRAFT mode resolves and renders document cleanly", async () => {
    const templateRecord = await getDocumentTemplateWithBytes({
      id: activeTemplateId,
      teacherProfileId: teacher1Id,
      schoolId: schoolAId,
    });
    expect(templateRecord).not.toBeNull();

    const draft = await prisma.aiContentDraft.findUnique({
      where: { id: sampleDraftId },
    });
    expect(draft).not.toBeNull();

    const rendered = await renderDocxTemplate(
      Buffer.from(templateRecord!.fileBytes),
      templateRecord!.placeholderManifest as unknown as typeof sampleManifest,
      {
        title: draft!.title,
        content: draft!.content,
        contentType: draft!.contentType,
        subjectName: "Biologi",
        className: "XI IPA 1",
        schoolName: "SMA Negeri 1 Jakarta",
        teacherName: "Guru Biologi",
      }
    );

    expect(rendered.length).toBeGreaterThan(100);
    expect(rendered.length).toBeLessThan(MAX_GENERATED_DOCX_BYTES);
  }, 30000);

  it("HAPPY-PATH: TRANSIENT mode resolves and renders unsaved editor content cleanly", async () => {
    const templateRecord = await getDocumentTemplateWithBytes({
      id: activeTemplateId,
      teacherProfileId: teacher1Id,
      schoolId: schoolAId,
    });
    expect(templateRecord).not.toBeNull();

    const rendered = await renderDocxTemplate(
      Buffer.from(templateRecord!.fileBytes),
      templateRecord!.placeholderManifest as unknown as typeof sampleManifest,
      {
        title: "Draf Transient Baru (Belum Disimpan)",
        content: "## Tujuan Pembelajaran\n- Eksplorasi konsep difusi osmosis.\n\n## Langkah-Langkah\n- Praktikum laboratorium kentang.",
        contentType: "LESSON_PLAN",
        subjectName: "Biologi",
        className: "XI IPA 1",
        schoolName: "SMA Negeri 1 Jakarta",
        teacherName: "Guru Biologi",
      }
    );

    expect(rendered.length).toBeGreaterThan(100);
    expect(rendered.length).toBeLessThan(MAX_GENERATED_DOCX_BYTES);
  }, 30000);
});
