import { AttendanceStatus, AssessmentResultStatus, SessionStatus, EntityStatus } from "@prisma/client";

export type ReportType = "JOURNAL" | "ATTENDANCE" | "SCORE" | "MONITORING" | "COVERAGE";

export interface ReportDateFilter {
  startDate?: string;
  endDate?: string;
}

export interface JournalReportSessionRow {
  id: string;
  date: Date;
  status: SessionStatus;
  plannedTopic: string | null;
  actualTopic: string | null;
  activitySummary: string | null;
  reflection: string | null;
  attendanceCounts: {
    total: number;
    present: number;
    late: number;
    sick: number;
    permission: number;
    absent: number;
  };
  assignments: Array<{
    id: string;
    title: string;
    dueDate: Date | null;
  }>;
  objectives: Array<{
    id: string;
    code: string | null;
    description: string;
  }>;
}

export interface TeachingJournalReportData {
  contextInfo: {
    id: string;
    schoolName: string;
    className: string;
    subjectName: string;
    academicPeriodYear: string;
    academicPeriodSemester: string;
    teacherName: string;
  };
  totalSessions: number;
  completedSessionsCount: number;
  inProgressSessionsCount: number;
  sessions: JournalReportSessionRow[];
}

export interface AttendanceRecapStudentRow {
  studentId: string;
  fullName: string;
  nis: string | null;
  isCurrentRoster: boolean;
  rosterStatusLabel: string; // "Aktif di kelas" | "Tidak di roster saat ini"
  recordsBySessionId: Record<
    string,
    {
      status: AttendanceStatus | "NOT_RECORDED" | "NOT_ENROLLED";
      note: string | null;
    }
  >;
  summary: {
    recordedSessionsCount: number;
    presentCount: number;
    lateCount: number;
    sickCount: number;
    permissionCount: number;
    absentCount: number;
  };
}

export interface AttendanceRecapReportData {
  contextInfo: {
    id: string;
    schoolName: string;
    className: string;
    subjectName: string;
    academicPeriodYear: string;
    academicPeriodSemester: string;
    teacherName: string;
  };
  sessions: Array<{
    id: string;
    date: Date;
    actualTopic: string | null;
    plannedTopic: string | null;
    status: SessionStatus;
  }>;
  students: AttendanceRecapStudentRow[];
}

export interface ScoreRecapAssessmentColumn {
  id: string;
  title: string;
  assessmentDate: Date;
  assessmentTypeName: string;
  maxScore: number;
  minimumPassingScore: number | null;
}

export interface ScoreRecapStudentRow {
  studentId: string;
  fullName: string;
  nis: string | null;
  isCurrentRoster: boolean;
  rosterStatusLabel: string; // "Aktif di kelas" | "Tidak di roster saat ini"
  scoresByAssessmentId: Record<
    string,
    {
      status: AssessmentResultStatus | "NOT_ENROLLED";
      rawScore: number | null;
      normalizedScore: number | null;
      finalScore: number | null;
      remedialAttemptsCount: number;
    }
  >;
  runningPerformance: number | null;
  availableWeight: number | null;
}

export interface ScoreRecapReportData {
  contextInfo: {
    id: string;
    schoolName: string;
    className: string;
    subjectName: string;
    academicPeriodYear: string;
    academicPeriodSemester: string;
    teacherName: string;
  };
  hasActiveGradePolicy: boolean;
  gradePolicyStatus: string | null;
  assessments: ScoreRecapAssessmentColumn[];
  students: ScoreRecapStudentRow[];
}

export interface MonitoringReportStudentRow {
  studentId: string;
  fullName: string;
  nis: string | null;
  isCurrentRoster: boolean;
  rosterStatusLabel: string;
  attendance: {
    totalRecorded: number;
    present: number;
    late: number;
    sick: number;
    permission: number;
    absent: number;
  };
  assessment: {
    completedGradedCount: number;
    belowKktpCount: number;
    remedialAttemptsCount: number;
    latestGradedScore: number | null;
  };
  notesSummary: {
    totalNotes: number;
    openFollowUpCount: number;
    resolvedFollowUpCount: number;
  };
  notes: Array<{
    id: string;
    content: string;
    requiresFollowUp: boolean;
    resolvedAt: Date | null;
    isArchived: boolean;
    createdAt: Date;
  }>;
}

export interface MonitoringReportData {
  contextInfo: {
    id: string;
    schoolName: string;
    className: string;
    subjectName: string;
    academicPeriodYear: string;
    academicPeriodSemester: string;
    teacherName: string;
  };
  students: MonitoringReportStudentRow[];
}

export interface AcademicCoverageObjectiveRow {
  id: string;
  code: string | null;
  description: string;
  orderIndex: number;
  status: EntityStatus;
  completedTeachingSessionsCount: number;
  latestTaughtDate: Date | null;
  completedAssessmentsCount: number;
}

export interface AcademicCoverageReportData {
  contextInfo: {
    id: string;
    schoolName: string;
    className: string;
    subjectName: string;
    academicPeriodYear: string;
    academicPeriodSemester: string;
    teacherName: string;
    curriculumName: string | null;
    phase: string | null;
    academicNote: string | null;
    cpText: string | null;
  };
  totalObjectivesCount: number;
  activeObjectivesCount: number;
  archivedObjectivesCount: number;
  objectives: AcademicCoverageObjectiveRow[];
}
