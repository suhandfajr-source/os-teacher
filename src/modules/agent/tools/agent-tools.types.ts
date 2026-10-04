import { z } from "zod";

export const getTeacherClassesSchema = z.object({
  activeOnly: z.boolean().optional().default(true),
});

export const getClassStudentsSchema = z.object({
  classId: z.string().min(1, "ID Kelas wajib diisi"),
});

export const getStudentAttendanceSummarySchema = z.object({
  classId: z.string().min(1, "ID Kelas wajib diisi"),
  studentId: z.string().optional(),
});

export const getStudentAcademicSummarySchema = z.object({
  classId: z.string().min(1, "ID Kelas wajib diisi"),
  studentId: z.string().optional(),
});

export const analyzeClassPerformanceSchema = z.object({
  classId: z.string().min(1, "ID Kelas wajib diisi"),
  kkm: z.number().min(0).max(100).optional().default(75),
});

export type GetTeacherClassesInput = z.infer<typeof getTeacherClassesSchema>;
export type GetClassStudentsInput = z.infer<typeof getClassStudentsSchema>;
export type GetStudentAttendanceSummaryInput = z.infer<typeof getStudentAttendanceSummarySchema>;
export type GetStudentAcademicSummaryInput = z.infer<typeof getStudentAcademicSummarySchema>;
export type AnalyzeClassPerformanceInput = z.infer<typeof analyzeClassPerformanceSchema>;
