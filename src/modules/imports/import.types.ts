import { ImportCategory as PrismaImportCategory, AssessmentCategory } from "@prisma/client";

export type ImportCategory = PrismaImportCategory;

export type RowValidationStatus = "VALID" | "WARNING" | "ERROR" | "SKIPPED";

export type RowAction =
  | "CREATE"
  | "REUSE_EXACT"
  | "POSSIBLE_MATCH"
  | "AMBIGUOUS"
  | "SKIP";

export interface BaseValidationRow {
  rowNum: number;
  status: RowValidationStatus;
  message: string;
  action: RowAction;
}

export interface PossibleStudentMatch {
  id: string;
  fullName: string;
  nis: string | null;
}

export interface RosterValidationRow extends BaseValidationRow {
  namaLengkap: string;
  nis: string | null;
  existingStudentId?: string;
  possibleMatches?: PossibleStudentMatch[];
  isAmbiguous?: boolean;
  userChoice?: "USE_EXISTING" | "CREATE_NEW";
}

export interface HistoricalSessionValidationRow extends BaseValidationRow {
  date: string; // YYYY-MM-DD
  actualTopic: string;
  activitySummary?: string | null;
  existingSessionId?: string;
}

export interface AvailableSessionInfo {
  id: string;
  date: string;
  actualTopic: string | null;
  startedAt?: string | null;
}

export interface HistoricalAttendanceValidationRow extends BaseValidationRow {
  studentIdentifier: string;
  sessionDate: string;
  actualTopic?: string | null;
  activitySummary?: string | null;
  sessionIdentifier?: string | null;
  attendanceStatus: "PRESENT" | "SICK" | "PERMISSION" | "ABSENT" | "LATE" | null;
  rawStatusString: string;
  matchedStudentId?: string;
  matchedStudentName?: string;
  matchedSessionId?: string;
  isSessionAmbiguous?: boolean;
  availableSessions?: AvailableSessionInfo[];
}

export interface HistoricalAssessmentValidationRow extends BaseValidationRow {
  studentIdentifier: string;
  assessmentTitle: string;
  assessmentDate: string;
  assessmentTypeName: string;
  confirmedCategory?: AssessmentCategory;
  maxScore: number;
  resultStatus: "GRADED" | "ABSENT" | "EXCUSED" | null;
  rawScore: number | null;
  normalizedScore: number | null;
  finalScore: number | null;
  matchedStudentId?: string;
  matchedStudentName?: string;
  matchedAssessmentTypeId?: string;
  existingAssessmentId?: string;
}

export interface ImportPreviewPayload<TRow = BaseValidationRow> {
  teachingContextId: string;
  schoolId: string;
  category: ImportCategory;
  headers: string[];
  rows: TRow[];
  token: string;
  summary: {
    total: number;
    valid: number;
    warning: number;
    error: number;
    duplicate: number;
  };
}

export interface ImportExecutionResult {
  success: boolean;
  category: ImportCategory;
  totalRows: number;
  importedCount: number;
  reusedCount: number;
  skippedCount: number;
  errorCount: number;
  message: string;
}
