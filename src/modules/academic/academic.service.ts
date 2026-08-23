import { z } from "zod";
import { AcademicPlanType, EntityStatus } from "@prisma/client";

export const saveAcademicProfileSchema = z.object({
  teachingContextId: z.string().min(1, "Teaching Context ID is required"),
  curriculumName: z.string().trim().nullable().optional(),
  phase: z.string().trim().nullable().optional(),
  academicNote: z.string().trim().nullable().optional(),
  cpText: z.string().trim().nullable().optional(),
});

export const createLearningObjectiveSchema = z.object({
  teachingContextId: z.string().min(1, "Teaching Context ID is required"),
  code: z.string().trim().nullable().optional(),
  description: z.string().trim().min(1, "Deskripsi Tujuan Pembelajaran wajib diisi"),
  orderIndex: z.number().int().min(0, "Order index minimal 0").optional(),
});

export const updateLearningObjectiveSchema = z.object({
  objectiveId: z.string().min(1, "Objective ID is required"),
  code: z.string().trim().nullable().optional(),
  description: z.string().trim().min(1, "Deskripsi Tujuan Pembelajaran wajib diisi"),
});

export const reorderLearningObjectivesSchema = z.object({
  teachingContextId: z.string().min(1, "Teaching Context ID is required"),
  orderedObjectiveIds: z.array(z.string().min(1)),
});

export const createAcademicPlanItemSchema = z.object({
  teachingContextId: z.string().min(1, "Teaching Context ID is required"),
  planType: z.nativeEnum(AcademicPlanType, { message: "Jenis program harus PROTA atau PROSEM" }),
  title: z.string().trim().min(1, "Judul program wajib diisi"),
  targetMonth: z
    .number()
    .int()
    .min(1, "Bulan harus antara 1 dan 12")
    .max(12, "Bulan harus antara 1 dan 12")
    .nullable()
    .optional(),
  allocatedHours: z.number().int().positive("Alokasi jam harus lebih besar dari 0").nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  orderIndex: z.number().int().min(0, "Order index minimal 0").optional(),
});

export const updateAcademicPlanItemSchema = z.object({
  planItemId: z.string().min(1, "Plan Item ID is required"),
  planType: z.nativeEnum(AcademicPlanType, { message: "Jenis program harus PROTA atau PROSEM" }),
  title: z.string().trim().min(1, "Judul program wajib diisi"),
  targetMonth: z
    .number()
    .int()
    .min(1, "Bulan harus antara 1 dan 12")
    .max(12, "Bulan harus antara 1 dan 12")
    .nullable()
    .optional(),
  allocatedHours: z.number().int().positive("Alokasi jam harus lebih besar dari 0").nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const reorderAcademicPlanItemsSchema = z.object({
  teachingContextId: z.string().min(1, "Teaching Context ID is required"),
  planType: z.nativeEnum(AcademicPlanType),
  orderedPlanItemIds: z.array(z.string().min(1)),
});

export const linkSessionObjectivesSchema = z.object({
  teachingSessionId: z.string().min(1, "Teaching Session ID is required"),
  objectiveIds: z.array(z.string().min(1)),
});

export const linkAssessmentObjectivesSchema = z.object({
  assessmentId: z.string().min(1, "Assessment ID is required"),
  objectiveIds: z.array(z.string().min(1)),
});

/**
 * Validates that an objective is active for normal mutation / linking.
 */
export function assertActiveObjective(status: EntityStatus): void {
  if (status !== EntityStatus.ACTIVE) {
    throw new Error("Tujuan Pembelajaran yang diarsipkan bersifat historis dan tidak dapat diubah atau ditautkan baru");
  }
}

/**
 * Deterministic helper to get month name label in Indonesian.
 */
export function getMonthNameIndonesian(monthNumber: number | null | undefined): string | null {
  if (!monthNumber || monthNumber < 1 || monthNumber > 12) return null;
  const monthNames = [
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
  return monthNames[monthNumber - 1];
}
