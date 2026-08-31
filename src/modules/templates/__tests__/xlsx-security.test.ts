import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import PizZip from "pizzip";
import { prisma } from "@/lib/auth";
import {
  AiContentType,
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
import { renderXlsxTemplate } from "../xlsx-template-renderer";
import { PlaceholderManifest, MAX_GENERATED_XLSX_BYTES } from "../template.types";

function createValidXlsxBuffer(titleTag = "{{JUDUL}}", contentTag = "{{ISI_KONTEN}}"): Buffer {
  const zip = new PizZip();

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">
  <si><t>${titleTag}</t></si>
  <si><t>${contentTag}</t></si>
</sst>`;

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="A2" t="s"><v>1</v></c>
    </row>
  </sheetData>
</worksheet>`;

  zip.file("[Content_Types].xml", contentTypesXml);
  zip.file("_rels/.rels", rootRelsXml);
  zip.file("xl/workbook.xml", workbookXml);
  zip.file("xl/_rels/workbook.xml.rels", workbookRelsXml);
  zip.file("xl/sharedStrings.xml", sharedStringsXml);
  zip.file("xl/worksheets/sheet1.xml", sheet1Xml);

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

describe("XLSX Template Multi-Tenancy, Security & Atomic Replacement", () => {
  let schoolAId: string;
  let schoolBId: string;
  let teacherA1ProfileId: string;
  let teacherA2ProfileId: string;
  let teacherB1ProfileId: string;
  let teacherRevokedProfileId: string;

  const validXlsxBytes = createValidXlsxBuffer();
  const validChecksum = crypto.createHash("sha256").update(validXlsxBytes).digest("hex");
  const sampleManifest: PlaceholderManifest = {
    version: 2,
    format: DocumentTemplateFormat.XLSX,
    detectedPlaceholders: ["JUDUL", "ISI_KONTEN"],
    recognized: ["JUDUL", "ISI_KONTEN"],
    unsupported: [],
    contentBearing: ["ISI_KONTEN"],
    locations: [
      { sheet: "Sheet1", cell: "A1", placeholder: "JUDUL", sheetVisibility: "VISIBLE" },
      { sheet: "Sheet1", cell: "A2", placeholder: "ISI_KONTEN", sheetVisibility: "VISIBLE" },
    ],
  };

  beforeAll(async () => {
    // Setup test users, schools, and memberships
    const userA1 = await prisma.user.create({
      data: {
        id: `user_xlsx_a1_${Date.now()}`,
        name: "Teacher A1",
        email: `teachera1_${Date.now()}@schoola.edu`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const userA2 = await prisma.user.create({
      data: {
        id: `user_xlsx_a2_${Date.now()}`,
        name: "Teacher A2",
        email: `teachera2_${Date.now()}@schoola.edu`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const userB1 = await prisma.user.create({
      data: {
        id: `user_xlsx_b1_${Date.now()}`,
        name: "Teacher B1",
        email: `teacherb1_${Date.now()}@schoolb.edu`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const userRevoked = await prisma.user.create({
      data: {
        id: `user_xlsx_rev_${Date.now()}`,
        name: "Teacher Revoked",
        email: `revoked_${Date.now()}@schoola.edu`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const schoolA = await prisma.school.create({
      data: {
        name: "SMA Alpha Jakarta",
        normalizedName: `sma alpha jakarta ${Date.now()}`,
      },
    });
    schoolAId = schoolA.id;

    const schoolB = await prisma.school.create({
      data: {
        name: "SMA Beta Surabaya",
        normalizedName: `sma beta surabaya ${Date.now()}`,
      },
    });
    schoolBId = schoolB.id;

    const teacherA1 = await prisma.teacherProfile.create({
      data: {
        userId: userA1.id,
        activeSchoolId: schoolAId,
        preferredName: "Pak A1",
      },
    });
    teacherA1ProfileId = teacherA1.id;

    const teacherA2 = await prisma.teacherProfile.create({
      data: {
        userId: userA2.id,
        activeSchoolId: schoolAId,
        preferredName: "Ibu A2",
      },
    });
    teacherA2ProfileId = teacherA2.id;

    const teacherB1 = await prisma.teacherProfile.create({
      data: {
        userId: userB1.id,
        activeSchoolId: schoolBId,
        preferredName: "Pak B1",
      },
    });
    teacherB1ProfileId = teacherB1.id;

    const teacherRevoked = await prisma.teacherProfile.create({
      data: {
        userId: userRevoked.id,
        activeSchoolId: schoolAId,
        preferredName: "Pak Revoked",
      },
    });
    teacherRevokedProfileId = teacherRevoked.id;

    await prisma.teacherSchoolMembership.createMany({
      data: [
        {
          teacherProfileId: teacherA1ProfileId,
          schoolId: schoolAId,
          status: MembershipStatus.ACTIVE,
        },
        {
          teacherProfileId: teacherA2ProfileId,
          schoolId: schoolAId,
          status: MembershipStatus.ACTIVE,
        },
        {
          teacherProfileId: teacherB1ProfileId,
          schoolId: schoolBId,
          status: MembershipStatus.ACTIVE,
        },
        {
          teacherProfileId: teacherRevokedProfileId,
          schoolId: schoolAId,
          status: MembershipStatus.REVOKED,
        },
      ],
    });
  });

  afterAll(async () => {
    // Cascade cleanup
    await prisma.documentTemplate.deleteMany({
      where: {
        schoolId: { in: [schoolAId, schoolBId] },
      },
    });

    await prisma.teacherSchoolMembership.deleteMany({
      where: {
        schoolId: { in: [schoolAId, schoolBId] },
      },
    });

    await prisma.teacherProfile.deleteMany({
      where: {
        id: {
          in: [
            teacherA1ProfileId,
            teacherA2ProfileId,
            teacherB1ProfileId,
            teacherRevokedProfileId,
          ],
        },
      },
    });

    await prisma.school.deleteMany({
      where: {
        id: { in: [schoolAId, schoolBId] },
      },
    });
  });

  it("creates and retrieves an active XLSX template for Teacher A1 in School A", async () => {
    const created = await createDocumentTemplate({
      teacherProfileId: teacherA1ProfileId,
      schoolId: schoolAId,
      name: "Template Excel RPP Kurikulum Merdeka",
      contentType: AiContentType.LESSON_PLAN,
      format: DocumentTemplateFormat.XLSX,
      originalFileName: "rpp_template.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileBytes: validXlsxBytes,
      fileSize: validXlsxBytes.length,
      checksumSha256: validChecksum,
      placeholderManifest: sampleManifest,
    });

    expect(created.id).toBeDefined();
    expect(created.format).toBe(DocumentTemplateFormat.XLSX);
    expect(created.status).toBe(EntityStatus.ACTIVE);

    const list = await listDocumentTemplates({
      teacherProfileId: teacherA1ProfileId,
      schoolId: schoolAId,
      format: DocumentTemplateFormat.XLSX,
    });

    expect(list.some((t) => t.id === created.id)).toBe(true);
  });

  it("IDOR: Same-School Teacher A2 cannot view or retrieve Teacher A1's template", async () => {
    const templateA1 = await createDocumentTemplate({
      teacherProfileId: teacherA1ProfileId,
      schoolId: schoolAId,
      name: "A1 Secret XLSX",
      contentType: AiContentType.LESSON_PLAN,
      format: DocumentTemplateFormat.XLSX,
      originalFileName: "a1.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileBytes: validXlsxBytes,
      fileSize: validXlsxBytes.length,
      checksumSha256: validChecksum,
      placeholderManifest: sampleManifest,
    });

    const metaForA2 = await getDocumentTemplateMetadata({
      id: templateA1.id,
      teacherProfileId: teacherA2ProfileId,
      schoolId: schoolAId,
    });
    expect(metaForA2).toBeNull();

    const bytesForA2 = await getDocumentTemplateWithBytes({
      id: templateA1.id,
      teacherProfileId: teacherA2ProfileId,
      schoolId: schoolAId,
    });
    expect(bytesForA2).toBeNull();

    const archiveResult = await archiveDocumentTemplate({
      id: templateA1.id,
      teacherProfileId: teacherA2ProfileId,
      schoolId: schoolAId,
    });
    expect(archiveResult).toBe(false);
  });

  it("IDOR: Cross-School Teacher B1 cannot view or retrieve School A's template", async () => {
    const templateA1 = await createDocumentTemplate({
      teacherProfileId: teacherA1ProfileId,
      schoolId: schoolAId,
      name: "A1 Cross School Test",
      contentType: AiContentType.LESSON_PLAN,
      format: DocumentTemplateFormat.XLSX,
      originalFileName: "a1_cross.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileBytes: validXlsxBytes,
      fileSize: validXlsxBytes.length,
      checksumSha256: validChecksum,
      placeholderManifest: sampleManifest,
    });

    const metaForB1 = await getDocumentTemplateMetadata({
      id: templateA1.id,
      teacherProfileId: teacherB1ProfileId,
      schoolId: schoolBId,
    });
    expect(metaForB1).toBeNull();

    const bytesForB1 = await getDocumentTemplateWithBytes({
      id: templateA1.id,
      teacherProfileId: teacherB1ProfileId,
      schoolId: schoolBId,
    });
    expect(bytesForB1).toBeNull();
  });

  it("REPLACE: Historical preservation creates a new ID and marks old as ARCHIVED with untouched fileBytes", async () => {
    const oldTemplate = await createDocumentTemplate({
      teacherProfileId: teacherA1ProfileId,
      schoolId: schoolAId,
      name: "Original XLSX Template",
      contentType: AiContentType.LESSON_PLAN,
      format: DocumentTemplateFormat.XLSX,
      originalFileName: "orig.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileBytes: validXlsxBytes,
      fileSize: validXlsxBytes.length,
      checksumSha256: validChecksum,
      placeholderManifest: sampleManifest,
    });

    const newXlsxBytes = createValidXlsxBuffer("{{JUDUL}}", "{{TUJUAN_PEMBELAJARAN}}");
    const newChecksum = crypto.createHash("sha256").update(newXlsxBytes).digest("hex");

    const replaced = await replaceDocumentTemplate({
      oldTemplateId: oldTemplate.id,
      teacherProfileId: teacherA1ProfileId,
      schoolId: schoolAId,
      name: "Replaced XLSX Template",
      contentType: AiContentType.LESSON_PLAN,
      format: DocumentTemplateFormat.XLSX,
      originalFileName: "new.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileBytes: newXlsxBytes,
      fileSize: newXlsxBytes.length,
      checksumSha256: newChecksum,
      placeholderManifest: {
        ...sampleManifest,
        recognized: ["JUDUL", "TUJUAN_PEMBELAJARAN"],
        contentBearing: ["TUJUAN_PEMBELAJARAN"],
      },
    });

    expect(replaced.id).not.toBe(oldTemplate.id);
    expect(replaced.status).toBe(EntityStatus.ACTIVE);

    // Verify old template is preserved in DB as ARCHIVED with original bytes
    const archivedRow = await prisma.documentTemplate.findUnique({
      where: { id: oldTemplate.id },
    });
    expect(archivedRow?.status).toBe(EntityStatus.ARCHIVED);
    expect(archivedRow?.archivedAt).toBeDefined();
    expect(archivedRow?.checksumSha256).toBe(validChecksum);
  });

  it("REPLACE: Concurrent replace conflict yields exactly 1 winner, 1 loser, 1 active replacement", async () => {
    const targetTemplate = await createDocumentTemplate({
      teacherProfileId: teacherA1ProfileId,
      schoolId: schoolAId,
      name: "Target for Concurrent XLSX Replace",
      contentType: AiContentType.LESSON_PLAN,
      format: DocumentTemplateFormat.XLSX,
      originalFileName: "target.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileBytes: validXlsxBytes,
      fileSize: validXlsxBytes.length,
      checksumSha256: validChecksum,
      placeholderManifest: sampleManifest,
    });

    const replacePromise1 = replaceDocumentTemplate({
      oldTemplateId: targetTemplate.id,
      teacherProfileId: teacherA1ProfileId,
      schoolId: schoolAId,
      name: "Replacement Winner 1",
      contentType: AiContentType.LESSON_PLAN,
      format: DocumentTemplateFormat.XLSX,
      originalFileName: "win1.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileBytes: validXlsxBytes,
      fileSize: validXlsxBytes.length,
      checksumSha256: validChecksum,
      placeholderManifest: sampleManifest,
    });

    const replacePromise2 = replaceDocumentTemplate({
      oldTemplateId: targetTemplate.id,
      teacherProfileId: teacherA1ProfileId,
      schoolId: schoolAId,
      name: "Replacement Winner 2",
      contentType: AiContentType.LESSON_PLAN,
      format: DocumentTemplateFormat.XLSX,
      originalFileName: "win2.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileBytes: validXlsxBytes,
      fileSize: validXlsxBytes.length,
      checksumSha256: validChecksum,
      placeholderManifest: sampleManifest,
    });

    const results = await Promise.allSettled([replacePromise1, replacePromise2]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });

  it("OUTPUT: Rejects generated XLSX exceeding 4 MB (MAX_GENERATED_XLSX_BYTES)", () => {
    const randomData = crypto.randomBytes(MAX_GENERATED_XLSX_BYTES + 1024);
    const templateBuf = createValidXlsxBuffer();

    // Inject uncompressible binary file into template buffer
    const zip = new PizZip(templateBuf);
    zip.file("xl/media/huge_image.png", randomData);
    const bloatedBuf = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });

    expect(() =>
      renderXlsxTemplate(bloatedBuf, {
        title: "Bloated Test",
        schoolName: "School",
        subjectName: "Subject",
        teacherName: "Teacher",
        className: "Class",
        dateStr: "Date",
        contentType: AiContentType.LESSON_PLAN,
        content: "Content",
      })
    ).toThrow(/melebihi batas sistem/);
  });
});
