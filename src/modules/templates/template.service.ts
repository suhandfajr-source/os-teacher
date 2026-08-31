import { prisma } from "@/lib/auth";
import { Prisma, AiContentType, DocumentTemplateFormat, EntityStatus } from "@prisma/client";
import { DocumentTemplateItem, PlaceholderManifest } from "./template.types";

export interface CreateTemplateParams {
  teacherProfileId: string;
  schoolId: string;
  name: string;
  contentType: AiContentType;
  format?: DocumentTemplateFormat;
  originalFileName: string;
  mimeType: string;
  fileBytes: Buffer;
  fileSize: number;
  checksumSha256: string;
  placeholderManifest: PlaceholderManifest;
}

export interface ReplaceTemplateParams extends CreateTemplateParams {
  oldTemplateId: string;
}

/**
 * Lists active document templates for a teacher in a school without returning binary bytes.
 */
export async function listDocumentTemplates(params: {
  teacherProfileId: string;
  schoolId: string;
  contentType?: AiContentType;
}): Promise<DocumentTemplateItem[]> {
  const templates = await prisma.documentTemplate.findMany({
    where: {
      teacherProfileId: params.teacherProfileId,
      schoolId: params.schoolId,
      status: EntityStatus.ACTIVE,
      ...(params.contentType ? { contentType: params.contentType } : {}),
    },
    select: {
      id: true,
      name: true,
      contentType: true,
      format: true,
      originalFileName: true,
      fileSize: true,
      checksumSha256: true,
      placeholderManifest: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return templates.map((t: (typeof templates)[number]) => ({
    ...t,
    placeholderManifest: t.placeholderManifest as unknown as PlaceholderManifest,
  }));
}

/**
 * Gets template metadata without binary fileBytes.
 */
export async function getDocumentTemplateMetadata(params: {
  id: string;
  teacherProfileId: string;
  schoolId: string;
  status?: EntityStatus;
}): Promise<DocumentTemplateItem | null> {
  const template = await prisma.documentTemplate.findFirst({
    where: {
      id: params.id,
      teacherProfileId: params.teacherProfileId,
      schoolId: params.schoolId,
      status: params.status || EntityStatus.ACTIVE,
    },
    select: {
      id: true,
      name: true,
      contentType: true,
      format: true,
      originalFileName: true,
      fileSize: true,
      checksumSha256: true,
      placeholderManifest: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
    },
  });

  if (!template) return null;

  return {
    ...template,
    placeholderManifest: template.placeholderManifest as unknown as PlaceholderManifest,
  };
}

/**
 * Gets template with fileBytes for server-side export rendering.
 */
export async function getDocumentTemplateWithBytes(params: {
  id: string;
  teacherProfileId: string;
  schoolId: string;
}) {
  return prisma.documentTemplate.findFirst({
    where: {
      id: params.id,
      teacherProfileId: params.teacherProfileId,
      schoolId: params.schoolId,
      status: EntityStatus.ACTIVE,
    },
  });
}

/**
 * Creates a new active document template.
 */
export async function createDocumentTemplate(params: CreateTemplateParams): Promise<DocumentTemplateItem> {
  const created = await prisma.documentTemplate.create({
    data: {
      teacherProfileId: params.teacherProfileId,
      schoolId: params.schoolId,
      name: params.name,
      contentType: params.contentType,
      format: params.format || DocumentTemplateFormat.DOCX,
      originalFileName: params.originalFileName,
      mimeType: params.mimeType,
      fileBytes: new Uint8Array(params.fileBytes),
      fileSize: params.fileSize,
      checksumSha256: params.checksumSha256,
      placeholderManifest: params.placeholderManifest as unknown as object,
      status: EntityStatus.ACTIVE,
    },
    select: {
      id: true,
      name: true,
      contentType: true,
      format: true,
      originalFileName: true,
      fileSize: true,
      checksumSha256: true,
      placeholderManifest: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
    },
  });

  return {
    ...created,
    placeholderManifest: created.placeholderManifest as unknown as PlaceholderManifest,
  };
}

/**
 * Archives an existing template.
 */
export async function archiveDocumentTemplate(params: {
  id: string;
  teacherProfileId: string;
  schoolId: string;
}): Promise<boolean> {
  const updateResult = await prisma.documentTemplate.updateMany({
    where: {
      id: params.id,
      teacherProfileId: params.teacherProfileId,
      schoolId: params.schoolId,
      status: EntityStatus.ACTIVE,
    },
    data: {
      status: EntityStatus.ARCHIVED,
      archivedAt: new Date(),
    },
  });

  return updateResult.count === 1;
}

/**
 * Replaces an existing active template atomically using updateMany and create in a short transaction.
 */
export async function replaceDocumentTemplate(
  params: ReplaceTemplateParams
): Promise<DocumentTemplateItem> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Archive old template atomically with status check
    const updateResult = await tx.documentTemplate.updateMany({
      where: {
        id: params.oldTemplateId,
        teacherProfileId: params.teacherProfileId,
        schoolId: params.schoolId,
        status: EntityStatus.ACTIVE,
      },
      data: {
        status: EntityStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    if (updateResult.count !== 1) {
      throw new Error(
        "Template lama tidak ditemukan, tidak aktif, atau Anda tidak memiliki izin untuk menggantinya."
      );
    }

    // 2. Insert new active template
    const created = await tx.documentTemplate.create({
      data: {
        teacherProfileId: params.teacherProfileId,
        schoolId: params.schoolId,
        name: params.name,
        contentType: params.contentType,
        format: params.format || DocumentTemplateFormat.DOCX,
        originalFileName: params.originalFileName,
        mimeType: params.mimeType,
        fileBytes: new Uint8Array(params.fileBytes),
        fileSize: params.fileSize,
        checksumSha256: params.checksumSha256,
        placeholderManifest: params.placeholderManifest as unknown as object,
        status: EntityStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        contentType: true,
        format: true,
        originalFileName: true,
        fileSize: true,
        checksumSha256: true,
        placeholderManifest: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        archivedAt: true,
      },
    });

    return {
      ...created,
      placeholderManifest: created.placeholderManifest as unknown as PlaceholderManifest,
    };
  });
}
