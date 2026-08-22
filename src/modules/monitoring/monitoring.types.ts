import { z } from "zod";

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const createMonitoringNoteSchema = z.object({
  teachingContextId: z.string().min(1, "Teaching context ID wajib diisi"),
  studentId: z.string().min(1, "Student ID wajib diisi"),
  content: z.string().trim().min(1, "Catatan tidak boleh kosong").max(2000, "Catatan maksimal 2000 karakter"),
  requiresFollowUp: z.boolean().default(false),
});

export const updateMonitoringNoteSchema = z.object({
  noteId: z.string().min(1, "Note ID wajib diisi"),
  content: z.string().trim().min(1, "Catatan tidak boleh kosong").max(2000, "Catatan maksimal 2000 karakter"),
  requiresFollowUp: z.boolean(),
});

export const resolveMonitoringFollowUpSchema = z.object({
  noteId: z.string().min(1, "Note ID wajib diisi"),
  resolved: z.boolean(),
});

export const archiveMonitoringNoteSchema = z.object({
  noteId: z.string().min(1, "Note ID wajib diisi"),
});

export type CreateMonitoringNoteInput = z.infer<typeof createMonitoringNoteSchema>;
export type UpdateMonitoringNoteInput = z.infer<typeof updateMonitoringNoteSchema>;
export type ResolveMonitoringFollowUpInput = z.infer<typeof resolveMonitoringFollowUpSchema>;
export type ArchiveMonitoringNoteInput = z.infer<typeof archiveMonitoringNoteSchema>;

// ============================================================================
// SUMMARY & FACTUAL TYPES
// ============================================================================

export interface AttendanceFactualSummary {
  totalRecordedSessions: number;
  presentCount: number;
  lateCount: number;
  sickCount: number;
  permissionCount: number;
  absentCount: number;
}

export interface AssessmentFactualSummary {
  gradedResultCount: number;
  latestGradedScore: number | null;
  belowKktpCount: number;
  remedialCount: number;
}

export interface StudentRunningPerformanceSummary {
  availableWeight: number;
  score: number | null;
}

export interface StudentMonitoringRow {
  studentId: string;
  fullName: string;
  nis: string | null;
  attendance: AttendanceFactualSummary;
  assessment: AssessmentFactualSummary;
  runningPerformance: StudentRunningPerformanceSummary | null;
  openFollowUpCount: number;
  notesCount: number;
}

export interface ClassMonitoringSummaryMetrics {
  totalCurrentStudents: number;
  studentsWithBelowKktp: number; // Unique current students with >= 1 valid completed+graded score below KKTP
  studentsWithRemedial: number; // Unique current students with >= 1 remedial attempt
  studentsWithAbsence: number; // Unique current students with >= 1 (absent + sick + permission)
  studentsWithOpenFollowUp: number; // Unique current students with >= 1 open follow-up note
}

export interface MonitoringNoteItem {
  id: string;
  teachingContextId: string;
  studentId: string;
  content: string;
  requiresFollowUp: boolean;
  resolvedAt: Date | string | null;
  isArchived: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  student?: {
    fullName: string;
    nis: string | null;
  };
}

export type MonitoringTimelineEventType = "ATTENDANCE" | "ASSESSMENT" | "REMEDIAL" | "NOTE";

export interface MonitoringTimelineEvent {
  id: string;
  type: MonitoringTimelineEventType;
  date: Date | string;
  title: string;
  description: string;
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
  };
}

export interface GlobalContextMonitoringOverview {
  teachingContextId: string;
  className: string;
  subjectName: string;
  academicYear: string;
  semester: string;
  currentStudentCount: number;
  studentsWithOpenFollowUp: number;
  studentsWithBelowKktp: number;
  hasActiveGradePolicy: boolean;
}
