import { AttendanceStatus, AssessmentCategory, AssessmentResultStatus, ParentAccessStatus, ParentInvitationStatus } from "@prisma/client";

export interface CreateParentInvitationInput {
  teachingContextId: string;
  studentId: string;
  recipientEmail: string;
  relationshipLabel?: string | null;
}

export interface PublicInvitationInfo {
  valid: boolean;
  maskedEmail?: string;
  expiresAt?: Date;
  status?: string;
  message?: string;
}

export interface AuthenticatedInvitationDetail {
  id: string;
  recipientEmail: string;
  relationshipLabel?: string | null;
  studentId: string;
  studentName: string;
  teachingContextId: string;
  className: string;
  subjectName: string;
  academicYear: string;
  academicSemester: string;
  teacherName: string;
  expiresAt: Date;
  status: ParentInvitationStatus;
}

export interface ParentContextListItem {
  studentId: string;
  studentName: string;
  relationshipLabel?: string | null;
  teachingContextId: string;
  subjectName: string;
  className: string;
  academicYear: string;
  academicSemester: string;
  teacherName: string;
  accessStatus: ParentAccessStatus;
}

export interface ParentAttendanceSummary {
  presentCount: number;
  lateCount: number;
  sickCount: number;
  permissionCount: number;
  absentCount: number;
  records: Array<{
    sessionId: string;
    date: string;
    status: AttendanceStatus;
  }>;
}

export interface ParentLearningActivityItem {
  sessionId: string;
  date: string;
  actualTopic: string | null;
  attendanceStatus: AttendanceStatus;
}

export interface ParentCompletedAssessmentItem {
  assessmentId: string;
  title: string;
  category: AssessmentCategory;
  date: string;
  minimumPassingScore: number | null;
  resultStatus: AssessmentResultStatus;
  finalScore: number | null;
}

export interface ParentContextDetail {
  studentId: string;
  studentName: string;
  relationshipLabel?: string | null;
  teachingContextId: string;
  subjectName: string;
  className: string;
  academicYear: string;
  academicSemester: string;
  teacherName: string;
  attendance: ParentAttendanceSummary;
  activities: ParentLearningActivityItem[];
  assessments: ParentCompletedAssessmentItem[];
}

export interface TeacherParentAccessItem {
  id: string;
  parentStudentRelationId: string;
  studentId: string;
  studentName: string;
  parentEmail: string;
  parentName: string;
  relationshipLabel?: string | null;
  status: ParentAccessStatus;
  grantedAt: Date;
  revokedAt?: Date | null;
}

export interface TeacherParentInvitationItem {
  id: string;
  studentId: string;
  studentName: string;
  recipientEmail: string;
  relationshipLabel?: string | null;
  status: ParentInvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date | null;
  createdAt: Date;
}
