import { z } from "zod";
import { Prisma } from "@prisma/client";

export const AssessmentCategoryEnum = z.enum([
  "ASSIGNMENT",
  "FORMATIVE",
  "SUMMATIVE",
  "MIDTERM",
  "FINAL_TERM",
  "SCHOOL_EXAM",
  "PRACTICE",
  "PROJECT",
  "OTHER",
]);

export const AssessmentStatusEnum = z.enum([
  "DRAFT",
  "IN_PROGRESS",
  "COMPLETED",
  "ARCHIVED",
]);

export const AssessmentResultStatusEnum = z.enum([
  "PENDING",
  "GRADED",
  "ABSENT",
  "EXCUSED",
]);

export const GradePolicyStatusEnum = z.enum(["DRAFT", "ACTIVE"]);

// -------------------------------------------------------------
// ASSESSMENT TYPE SCHEMAS
// -------------------------------------------------------------
export const createAssessmentTypeSchema = z.object({
  teachingContextId: z.string().min(1, "Teaching context ID is required"),
  name: z.string().min(1, "Nama jenis penilaian harus diisi").max(100),
  category: AssessmentCategoryEnum.default("OTHER"),
});

export const renameAssessmentTypeSchema = z.object({
  id: z.string().min(1, "ID jenis penilaian harus diisi"),
  name: z.string().min(1, "Nama baru jenis penilaian harus diisi").max(100),
});

// -------------------------------------------------------------
// GRADE POLICY SCHEMAS
// -------------------------------------------------------------
export const gradePolicyItemInputSchema = z.object({
  assessmentTypeId: z.string().min(1, "Jenis penilaian harus diisi"),
  weight: z.number().min(0, "Bobot tidak boleh negatif").max(100, "Bobot maksimal 100%"),
  sortOrder: z.number().int().optional().default(0),
});

export const updateGradePolicyItemsSchema = z.object({
  gradePolicyId: z.string().min(1, "Grade policy ID is required"),
  items: z.array(gradePolicyItemInputSchema).min(1, "Minimal harus ada satu komponen bobot"),
});

export const copyGradePolicySchema = z.object({
  sourceTeachingContextId: z.string().min(1, "Sumber kelas harus diisi"),
  targetTeachingContextId: z.string().min(1, "Target kelas harus diisi"),
  confirmed: z.boolean().optional().default(false),
});

// -------------------------------------------------------------
// ASSESSMENT SCHEMAS
// -------------------------------------------------------------
export const createAssessmentSchema = z.object({
  teachingContextId: z.string().min(1, "Teaching context ID is required"),
  assessmentTypeId: z.string().min(1, "Jenis penilaian harus dipilih"),
  teachingSessionId: z.string().nullable().optional(),
  title: z.string().min(1, "Judul penilaian harus diisi").max(200),
  description: z.string().nullable().optional(),
  assessmentDate: z.coerce.date(),
  maxScore: z.number().positive("Skor maksimum harus lebih besar dari 0").max(999999.99),
  minimumPassingScore: z.number().min(0, "KKTP minimal 0").max(100, "KKTP maksimal 100").nullable().optional(),
});

export const updateAssessmentMetadataSchema = z.object({
  assessmentId: z.string().min(1, "Assessment ID is required"),
  title: z.string().min(1, "Judul penilaian harus diisi").max(200).optional(),
  description: z.string().nullable().optional(),
  assessmentDate: z.coerce.date().optional(),
  assessmentTypeId: z.string().optional(),
  teachingSessionId: z.string().nullable().optional(),
  maxScore: z.number().positive("Skor maksimum harus lebih besar dari 0").max(999999.99).optional(),
  minimumPassingScore: z.number().min(0, "KKTP minimal 0").max(100, "KKTP maksimal 100").nullable().optional(),
});

// -------------------------------------------------------------
// SCORE SAVING SCHEMAS
// -------------------------------------------------------------
export const scoreEntryInputSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  status: AssessmentResultStatusEnum,
  rawScore: z.number().min(0, "Skor tidak boleh negatif").nullable().optional(),
  note: z.string().nullable().optional(),
});

export const saveAssessmentScoresSchema = z.object({
  assessmentId: z.string().min(1, "Assessment ID is required"),
  scores: z.array(scoreEntryInputSchema),
});

// -------------------------------------------------------------
// REMEDIAL SCHEMAS
// -------------------------------------------------------------
export const recordRemedialAttemptSchema = z.object({
  assessmentResultId: z.string().min(1, "Assessment Result ID is required"),
  score: z.number().min(0, "Skor remedial minimal 0").max(100, "Skor remedial maksimal 100"),
  newFinalScore: z.number().min(0, "Nilai akhir baru minimal 0").max(100, "Nilai akhir baru maksimal 100"),
  note: z.string().nullable().optional(),
  attemptDate: z.coerce.date().optional(),
});

// -------------------------------------------------------------
// TYPES
// -------------------------------------------------------------
export type CreateAssessmentTypeInput = z.infer<typeof createAssessmentTypeSchema>;
export type RenameAssessmentTypeInput = z.infer<typeof renameAssessmentTypeSchema>;
export type GradePolicyItemInput = z.infer<typeof gradePolicyItemInputSchema>;
export type UpdateGradePolicyItemsInput = z.infer<typeof updateGradePolicyItemsSchema>;
export type CopyGradePolicyInput = z.infer<typeof copyGradePolicySchema>;
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentMetadataInput = z.infer<typeof updateAssessmentMetadataSchema>;
export type ScoreEntryInput = z.infer<typeof scoreEntryInputSchema>;
export type SaveAssessmentScoresInput = z.infer<typeof saveAssessmentScoresSchema>;
export type RecordRemedialAttemptInput = z.infer<typeof recordRemedialAttemptSchema>;

export interface AssessmentBasicStatistics {
  totalParticipants: number;
  gradedCount: number;
  pendingCount: number;
  absentCount: number;
  excusedCount: number;
  averageScore: Prisma.Decimal | null;
  highestScore: Prisma.Decimal | null;
  lowestScore: Prisma.Decimal | null;
  tuntasCount: number | null;
  perluRemedialCount: number | null;
  masteryPercentage: Prisma.Decimal | null;
}

export interface StudentCategoryPerformance {
  assessmentTypeId: string;
  assessmentTypeName: string;
  category: string;
  weight: Prisma.Decimal;
  categoryAverage: Prisma.Decimal | null;
  completedAssessmentCount: number;
}

export interface StudentRunningGrade {
  studentId: string;
  studentName: string;
  nis: string | null;
  availableWeight: Prisma.Decimal;
  runningPerformance: Prisma.Decimal | null;
  categories: StudentCategoryPerformance[];
}
