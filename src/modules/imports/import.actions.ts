"use server";

import { prisma } from "@/lib/auth";
import { verifyActiveSchoolMembership, verifyTeachingContextAccess } from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import {
  ImportPreviewPayload,
  ImportExecutionResult,
  RosterValidationRow,
  HistoricalSessionValidationRow,
  HistoricalAttendanceValidationRow,
  HistoricalAssessmentValidationRow,
} from "./import.types";
import {
  parseRawWorkbook,
  validateRosterImport,
  executeRosterImport,
  validateHistoricalSessionsImport,
  executeHistoricalSessionsImport,
  validateHistoricalAttendanceImport,
  executeHistoricalAttendanceImport,
  validateHistoricalAssessmentsImport,
  executeHistoricalAssessmentsImport,
} from "./import.service";
import { suggestColumnMapping } from "./import.utils";

// ============================================================================
// 1. FILE INSPECTION / HEADER EXTRACTION ACTION
// ============================================================================

export async function inspectImportFile(formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) throw new Error("File tidak ditemukan.");

  const buffer = await file.arrayBuffer();
  const { sheetNames, headers } = parseRawWorkbook(buffer);
  const suggestions = suggestColumnMapping(headers);

  return {
    success: true,
    sheetNames,
    headers,
    suggestions,
  };
}

// ============================================================================
// 2. CONTEXT PREREQUISITES ACTION
// ============================================================================

export async function getTeachingContextImportPrerequisitesAction(teachingContextId: string) {
  const { activeSchoolId, context } = await verifyTeachingContextAccess(teachingContextId);

  const [assessmentTypes, existingSessions, roster] = await Promise.all([
    prisma.assessmentType.findMany({
      where: { teachingContextId: context.id, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.teachingSession.findMany({
      where: { teachingContextId: context.id },
      select: { id: true, date: true, actualTopic: true, status: true },
      orderBy: { date: "desc" },
    }),
    prisma.classStudent.findMany({
      where: {
        classId: context.classId,
        academicPeriodId: context.academicPeriodId,
      },
      include: {
        student: true,
      },
      orderBy: { student: { fullName: "asc" } },
    }),
  ]);

  return {
    schoolId: activeSchoolId,
    teachingContext: {
      id: context.id,
      classId: context.classId,
      academicPeriodId: context.academicPeriodId,
      subjectId: context.subjectId,
    },
    assessmentTypes,
    existingSessions: existingSessions.map((s) => ({
      id: s.id,
      date: s.date.toISOString().slice(0, 10),
      actualTopic: s.actualTopic,
      status: s.status,
    })),
    rosterCount: roster.length,
    roster: roster.map((r) => ({
      id: r.student.id,
      fullName: r.student.fullName,
      nis: r.student.nis,
    })),
  };
}

// ============================================================================
// 3. VALIDATE IMPORT ACTIONS
// ============================================================================

export async function validateRosterAction(
  teachingContextId: string,
  formData: FormData,
  mapping: { namaCol: string; nisCol?: string }
): Promise<ImportPreviewPayload<RosterValidationRow>> {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();
  await verifyTeachingContextAccess(teachingContextId);

  const file = formData.get("file") as File;
  if (!file) throw new Error("File tidak ditemukan.");

  const buffer = await file.arrayBuffer();
  return await validateRosterImport(activeSchoolId, teachingContextId, profile.id, buffer, mapping);
}

export async function validateHistoricalSessionsAction(
  teachingContextId: string,
  formData: FormData,
  mapping: { dateCol: string; topicCol: string; summaryCol?: string }
): Promise<ImportPreviewPayload<HistoricalSessionValidationRow>> {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();
  await verifyTeachingContextAccess(teachingContextId);

  const file = formData.get("file") as File;
  if (!file) throw new Error("File tidak ditemukan.");

  const buffer = await file.arrayBuffer();
  return await validateHistoricalSessionsImport(
    activeSchoolId,
    teachingContextId,
    profile.id,
    buffer,
    mapping
  );
}

export async function validateHistoricalAttendanceAction(
  teachingContextId: string,
  formData: FormData,
  mapping: {
    studentCol: string;
    dateCol: string;
    statusCol: string;
    sessionCol?: string;
    topicCol?: string;
    summaryCol?: string;
  }
): Promise<ImportPreviewPayload<HistoricalAttendanceValidationRow>> {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();
  await verifyTeachingContextAccess(teachingContextId);

  const file = formData.get("file") as File;
  if (!file) throw new Error("File tidak ditemukan.");

  const buffer = await file.arrayBuffer();
  return await validateHistoricalAttendanceImport(
    activeSchoolId,
    teachingContextId,
    profile.id,
    buffer,
    mapping
  );
}

export async function validateHistoricalAssessmentsAction(
  teachingContextId: string,
  formData: FormData,
  mapping: {
    studentCol: string;
    titleCol: string;
    dateCol: string;
    scoreCol?: string;
    typeCol?: string;
    maxScoreCol?: string;
    statusCol?: string;
  }
): Promise<ImportPreviewPayload<HistoricalAssessmentValidationRow>> {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();
  await verifyTeachingContextAccess(teachingContextId);

  const file = formData.get("file") as File;
  if (!file) throw new Error("File tidak ditemukan.");

  const buffer = await file.arrayBuffer();
  return await validateHistoricalAssessmentsImport(
    activeSchoolId,
    teachingContextId,
    profile.id,
    buffer,
    mapping
  );
}

// ============================================================================
// 4. EXECUTE IMPORT ACTIONS
// ============================================================================

export async function executeRosterImportAction(
  teachingContextId: string,
  rows: RosterValidationRow[],
  token: string
): Promise<ImportExecutionResult> {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();
  await verifyTeachingContextAccess(teachingContextId);

  const result = await executeRosterImport(
    activeSchoolId,
    teachingContextId,
    profile.id,
    rows,
    token
  );

  revalidatePath(`/kelas`);
  revalidatePath(`/kelas/${teachingContextId}`);
  revalidatePath(`/siswa`);
  return result;
}

export async function executeHistoricalSessionsImportAction(
  teachingContextId: string,
  rows: HistoricalSessionValidationRow[],
  token: string
): Promise<ImportExecutionResult> {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();
  await verifyTeachingContextAccess(teachingContextId);

  const result = await executeHistoricalSessionsImport(
    activeSchoolId,
    teachingContextId,
    profile.id,
    rows,
    token
  );

  revalidatePath(`/kelas/${teachingContextId}`);
  revalidatePath(`/kelas/${teachingContextId}/pertemuan`);
  revalidatePath(`/hari-ini`);
  return result;
}

export async function executeHistoricalAttendanceImportAction(
  teachingContextId: string,
  rows: HistoricalAttendanceValidationRow[],
  token: string
): Promise<ImportExecutionResult> {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();
  await verifyTeachingContextAccess(teachingContextId);

  const result = await executeHistoricalAttendanceImport(
    activeSchoolId,
    teachingContextId,
    profile.id,
    rows,
    token
  );

  revalidatePath(`/kelas/${teachingContextId}`);
  revalidatePath(`/kelas/${teachingContextId}/pertemuan`);
  revalidatePath(`/kelas/${teachingContextId}/absensi`);
  revalidatePath(`/laporan`);
  return result;
}

export async function executeHistoricalAssessmentsImportAction(
  teachingContextId: string,
  rows: HistoricalAssessmentValidationRow[],
  token: string
): Promise<ImportExecutionResult> {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();
  await verifyTeachingContextAccess(teachingContextId);

  const result = await executeHistoricalAssessmentsImport(
    activeSchoolId,
    teachingContextId,
    profile.id,
    rows,
    token
  );

  revalidatePath(`/kelas/${teachingContextId}`);
  revalidatePath(`/kelas/${teachingContextId}/penilaian`);
  revalidatePath(`/assessment`);
  revalidatePath(`/laporan`);
  return result;
}
