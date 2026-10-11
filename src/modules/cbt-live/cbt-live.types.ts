export type CbtSessionStatusView = "WAITING" | "ACTIVE" | "PAUSED" | "ENDED";

export interface CbtSessionStudentProgressView {
  attemptId: string;
  studentId: string;
  studentName: string;
  studentNis?: string;
  status: "WAITING" | "IN_PROGRESS" | "SUBMITTED" | "NEEDS_GRADING";
  currentQuestion: number;
  totalQuestions: number;
  answeredCount: number;
  score: number | null;
  violationCount: number;
  lockedBySystem: boolean;
  lockedAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  isOnline: boolean;
  lastPingAt: string | null;
}

export interface CbtLiveCockpitView {
  sessionId: string;
  token: string;
  status: CbtSessionStatusView;
  quizId: string;
  quizTitle: string;
  durationMinutes: number | null;
  teachingContextId: string;
  className: string;
  subjectName: string;
  totalStudents: number;
  joinedCount: number;
  activeCount: number;
  submittedCount: number;
  lockedCount: number;
  startedAt: string | null;
  pausedAt: string | null;
  endedAt: string | null;
  students: CbtSessionStudentProgressView[];
}

export interface CbtStudentLobbyView {
  sessionId: string;
  token: string;
  status: CbtSessionStatusView;
  quizTitle: string;
  subjectName: string;
  durationMinutes: number | null;
  totalQuestions: number;
  shareToken: string;
  hasExistingAttempt: boolean;
  attemptId?: string;
  isLocked?: boolean;
}
