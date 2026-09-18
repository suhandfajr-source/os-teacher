import { z } from "zod";
import { EntityStatus } from "@prisma/client";

export const AcademicPlanTypeEnum = z.enum(["PROTA", "PROSEM"], {
  message: "Jenis program harus PROTA atau PROSEM",
});

export const PlanItemCategoryEnum = z.enum(["REGULAR_MATERIAL", "STS", "SAS", "RESERVE"]);

export const weeklyDistributionSlotSchema = z.object({
  month: z.number().int().min(1).max(12),
  week: z.number().int().min(1).max(5),
  hours: z.number().int().positive(),
});

export const saveAcademicProfileSchema = z.object({
  teachingContextId: z.string().min(1, "Teaching Context ID is required"),
  curriculumName: z.string().trim().nullable().optional(),
  phase: z.string().trim().nullable().optional(),
  academicNote: z.string().trim().nullable().optional(),
  cpText: z.string().trim().nullable().optional(),
  hoursPerWeek: z.number().int().min(1).max(10).optional(),
  effectiveWeeksSem1: z.number().int().min(1).max(25).optional(),
  effectiveWeeksSem2: z.number().int().min(1).max(25).optional(),
});

export const createLearningObjectiveSchema = z.object({
  teachingContextId: z.string().min(1, "Teaching Context ID is required"),
  code: z.string().trim().nullable().optional(),
  description: z.string().trim().min(1, "Deskripsi Tujuan Pembelajaran wajib diisi"),
  orderIndex: z.number().int().min(0, "Order index minimal 0").optional(),
  targetSemester: z.number().int().min(1).max(2).nullable().optional(),
  allocatedHours: z.number().int().positive().nullable().optional(),
});

export const updateLearningObjectiveSchema = z.object({
  objectiveId: z.string().min(1, "Objective ID is required"),
  code: z.string().trim().nullable().optional(),
  description: z.string().trim().min(1, "Deskripsi Tujuan Pembelajaran wajib diisi"),
  targetSemester: z.number().int().min(1).max(2).nullable().optional(),
  allocatedHours: z.number().int().positive().nullable().optional(),
});

export const reorderLearningObjectivesSchema = z.object({
  teachingContextId: z.string().min(1, "Teaching Context ID is required"),
  orderedObjectiveIds: z.array(z.string().min(1)),
});

export const createAcademicPlanItemSchema = z.object({
  teachingContextId: z.string().min(1, "Teaching Context ID is required"),
  learningObjectiveId: z.string().nullable().optional(),
  planType: AcademicPlanTypeEnum,
  category: PlanItemCategoryEnum.optional(),
  title: z.string().trim().min(1, "Judul program wajib diisi"),
  targetMonth: z
    .number()
    .int()
    .min(1, "Bulan harus antara 1 dan 12")
    .max(12, "Bulan harus antara 1 dan 12")
    .nullable()
    .optional(),
  targetSemester: z.number().int().min(1).max(2).optional(),
  allocatedHours: z.number().int().positive("Alokasi jam harus lebih besar dari 0").nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  weeklyDistribution: z.array(weeklyDistributionSlotSchema).nullable().optional(),
  orderIndex: z.number().int().min(0, "Order index minimal 0").optional(),
});

export const updateAcademicPlanItemSchema = z.object({
  planItemId: z.string().min(1, "Plan Item ID is required"),
  learningObjectiveId: z.string().nullable().optional(),
  planType: AcademicPlanTypeEnum,
  category: PlanItemCategoryEnum.optional(),
  title: z.string().trim().min(1, "Judul program wajib diisi"),
  targetMonth: z
    .number()
    .int()
    .min(1, "Bulan harus antara 1 dan 12")
    .max(12, "Bulan harus antara 1 dan 12")
    .nullable()
    .optional(),
  targetSemester: z.number().int().min(1).max(2).optional(),
  allocatedHours: z.number().int().positive("Alokasi jam harus lebih besar dari 0").nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  weeklyDistribution: z.array(weeklyDistributionSlotSchema).nullable().optional(),
});

export const bulkSaveAcademicPlanSchema = z.object({
  teachingContextId: z.string().min(1, "Teaching Context ID is required"),
  planType: AcademicPlanTypeEnum,
  targetSemester: z.number().int().min(1).max(2),
  items: z.array(
    z.object({
      id: z.string().optional(),
      learningObjectiveId: z.string().nullable().optional(),
      category: PlanItemCategoryEnum.optional(),
      title: z.string().trim().min(1, "Judul wajib diisi"),
      allocatedHours: z.number().int().positive("Alokasi jam harus lebih dari 0"),
      notes: z.string().trim().nullable().optional(),
      weeklyDistribution: z.array(weeklyDistributionSlotSchema).nullable().optional(),
    })
  ),
});

export const reorderAcademicPlanItemsSchema = z.object({
  teachingContextId: z.string().min(1, "Teaching Context ID is required"),
  planType: AcademicPlanTypeEnum,
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

/**
 * Helper to calculate target total semester hours given weeks and weekly load.
 */
export function calculateSemesterTargetHours(effectiveWeeks: number, hoursPerWeek: number): number {
  return Math.max(0, effectiveWeeks) * Math.max(0, hoursPerWeek);
}
