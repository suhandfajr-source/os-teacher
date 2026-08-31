"use server";

import { headers } from "next/headers";
import { auth, prisma } from "@/lib/auth";
import { AiContentType, DocumentTemplateFormat, MembershipStatus } from "@prisma/client";
import {
  archiveDocumentTemplate,
  getDocumentTemplateMetadata,
  listDocumentTemplates,
} from "./template.service";
import { DocumentTemplateItem } from "./template.types";

/**
 * Resolves the authenticated teacher context with ACTIVE membership.
 */
async function resolveTeacherAuth() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    throw new Error("UNAUTHORIZED: Sesi login tidak ditemukan.");
  }

  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!teacher || !teacher.activeSchoolId) {
    throw new Error("FORBIDDEN: Profil guru atau sekolah aktif tidak ditemukan.");
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
    throw new Error("FORBIDDEN: Keanggotaan sekolah guru tidak aktif atau telah dicabut.");
  }

  return {
    teacherProfileId: teacher.id,
    schoolId: teacher.activeSchoolId,
    teacherName: teacher.preferredName || session.user.name || "Guru",
  };
}

/**
 * Server Action: List active templates for current teacher & school.
 */
export async function listDocumentTemplatesAction(params?: {
  contentType?: AiContentType;
  format?: DocumentTemplateFormat;
}): Promise<{ success: boolean; data?: DocumentTemplateItem[]; error?: string }> {
  try {
    const authCtx = await resolveTeacherAuth();
    const list = await listDocumentTemplates({
      teacherProfileId: authCtx.teacherProfileId,
      schoolId: authCtx.schoolId,
      contentType: params?.contentType,
      format: params?.format,
    });

    return { success: true, data: list };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Server Action: Get metadata detail of a template.
 */
export async function getDocumentTemplateDetailAction(params: {
  templateId: string;
}): Promise<{ success: boolean; data?: DocumentTemplateItem; error?: string }> {
  try {
    const authCtx = await resolveTeacherAuth();
    const template = await getDocumentTemplateMetadata({
      id: params.templateId,
      teacherProfileId: authCtx.teacherProfileId,
      schoolId: authCtx.schoolId,
    });

    if (!template) {
      return { success: false, error: "Template tidak ditemukan atau bukan milik Anda." };
    }

    return { success: true, data: template };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Server Action: Archive a template.
 */
export async function archiveDocumentTemplateAction(params: {
  templateId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const authCtx = await resolveTeacherAuth();
    const success = await archiveDocumentTemplate({
      id: params.templateId,
      teacherProfileId: authCtx.teacherProfileId,
      schoolId: authCtx.schoolId,
    });

    if (!success) {
      return {
        success: false,
        error: "Gagal mengarsipkan template. Pastikan template aktif dan milik Anda.",
      };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}
