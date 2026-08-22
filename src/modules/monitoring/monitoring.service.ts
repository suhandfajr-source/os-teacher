import { Prisma } from "@prisma/client";
import {
  AttendanceFactualSummary,
  AssessmentFactualSummary,
  ClassMonitoringSummaryMetrics,
  MonitoringTimelineEvent,
  StudentMonitoringRow,
} from "./monitoring.types";

/**
 * Summarizes factual attendance counts for a single student within a TeachingContext.
 * Adheres to Binding Amendment 5: Factual counts only, no invented percentage formula.
 */
export function summarizeStudentAttendance(
  records: Array<{ status: "PRESENT" | "SICK" | "PERMISSION" | "ABSENT" | "LATE" }>
): AttendanceFactualSummary {
  let presentCount = 0;
  let lateCount = 0;
  let sickCount = 0;
  let permissionCount = 0;
  let absentCount = 0;

  for (const record of records) {
    if (record.status === "PRESENT") presentCount++;
    else if (record.status === "LATE") lateCount++;
    else if (record.status === "SICK") sickCount++;
    else if (record.status === "PERMISSION") permissionCount++;
    else if (record.status === "ABSENT") absentCount++;
  }

  return {
    totalRecordedSessions: records.length,
    presentCount,
    lateCount,
    sickCount,
    permissionCount,
    absentCount,
  };
}

export interface RawAssessmentResultForMonitoring {
  id: string;
  status: "PENDING" | "GRADED" | "ABSENT" | "EXCUSED";
  finalScore: Prisma.Decimal | number | null;
  assessment: {
    id: string;
    title: string;
    status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
    assessmentDate: Date;
    minimumPassingScore: Prisma.Decimal | number | null;
    assessmentType: {
      id: string;
      name: string;
    };
  };
  remedialAttempts?: Array<{
    id: string;
    score: Prisma.Decimal | number;
    attemptDate: Date;
    note: string | null;
  }>;
}

/**
 * Summarizes factual assessment outcomes for a single student within a TeachingContext.
 * Adheres to Binding Amendments 2, 3, 4:
 * - Only COMPLETED assessments and GRADED results with non-null finalScore are included.
 * - PENDING, ABSENT, EXCUSED, null are excluded and never converted to 0.
 * - belowKktpCount strictly requires completed + graded + finalScore < minimumPassingScore.
 * - latestGradedScore is the most recent completed + graded numeric score.
 */
export function summarizeStudentAssessments(
  results: RawAssessmentResultForMonitoring[]
): AssessmentFactualSummary {
  let gradedResultCount = 0;
  let belowKktpCount = 0;
  let remedialCount = 0;
  let latestGradedScore: number | null = null;
  let latestGradedDate: Date | null = null;

  for (const res of results) {
    // Collect remedial count regardless
    if (res.remedialAttempts && res.remedialAttempts.length > 0) {
      remedialCount += res.remedialAttempts.length;
    }

    // Strict requirement: Assessment must be COMPLETED, result GRADED, and finalScore not null
    if (res.assessment.status === "COMPLETED" && res.status === "GRADED" && res.finalScore !== null) {
      gradedResultCount++;

      const numFinalScore = Number(res.finalScore);

      // Check KKTP threshold if minimumPassingScore is set
      if (res.assessment.minimumPassingScore !== null && res.assessment.minimumPassingScore !== undefined) {
        const kktp = Number(res.assessment.minimumPassingScore);
        if (numFinalScore < kktp) {
          belowKktpCount++;
        }
      }

      // Check latest graded score by assessmentDate
      const aDate = new Date(res.assessment.assessmentDate);
      if (!latestGradedDate || aDate.getTime() >= latestGradedDate.getTime()) {
        latestGradedDate = aDate;
        latestGradedScore = numFinalScore;
      }
    }
  }

  return {
    gradedResultCount,
    latestGradedScore,
    belowKktpCount,
    remedialCount,
  };
}

/**
 * Calculates class-level summary metrics for UNIQUE current students.
 * Adheres to Binding Amendment 2:
 * - studentsWithBelowKktp counts UNIQUE current students with >= 1 valid completed+graded score below KKTP.
 * - studentsWithRemedial counts UNIQUE current students with >= 1 remedial attempt.
 * - studentsWithAbsence counts UNIQUE current students with >= 1 absence/sick/permission.
 * - studentsWithOpenFollowUp counts UNIQUE current students with >= 1 open follow-up note.
 */
export function calculateClassMonitoringMetrics(
  rows: StudentMonitoringRow[]
): ClassMonitoringSummaryMetrics {
  let studentsWithBelowKktp = 0;
  let studentsWithRemedial = 0;
  let studentsWithAbsence = 0;
  let studentsWithOpenFollowUp = 0;

  for (const row of rows) {
    if (row.assessment.belowKktpCount > 0) {
      studentsWithBelowKktp++;
    }
    if (row.assessment.remedialCount > 0) {
      studentsWithRemedial++;
    }
    if (row.attendance.absentCount + row.attendance.sickCount + row.attendance.permissionCount > 0) {
      studentsWithAbsence++;
    }
    if (row.openFollowUpCount > 0) {
      studentsWithOpenFollowUp++;
    }
  }

  return {
    totalCurrentStudents: rows.length,
    studentsWithBelowKktp,
    studentsWithRemedial,
    studentsWithAbsence,
    studentsWithOpenFollowUp,
  };
}

export interface RawAttendanceForTimeline {
  id: string;
  status: "PRESENT" | "SICK" | "PERMISSION" | "ABSENT" | "LATE";
  note: string | null;
  createdAt: Date;
  teachingSession: {
    id: string;
    date: Date;
    plannedTopic: string | null;
    actualTopic: string | null;
  };
}

export interface RawNoteForTimeline {
  id: string;
  content: string;
  requiresFollowUp: boolean;
  resolvedAt: Date | null;
  isArchived: boolean;
  createdAt: Date;
}

/**
 * Composes a unified, chronological timeline of factual student events within the TeachingContext.
 * Adheres to Binding Amendment 4: Displays persisted facts only, no fabricated score transitions.
 */
export function composeStudentActivityTimeline(
  attendanceRecords: RawAttendanceForTimeline[],
  assessmentResults: RawAssessmentResultForMonitoring[],
  notes: RawNoteForTimeline[]
): MonitoringTimelineEvent[] {
  const events: MonitoringTimelineEvent[] = [];

  // 1. Attendance Events
  for (const att of attendanceRecords) {
    const sessionTopic = att.teachingSession.actualTopic || att.teachingSession.plannedTopic || "Pertemuan Pembelajaran";
    let statusLabel = "Hadir";
    let variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" = "success";

    if (att.status === "ABSENT") {
      statusLabel = "Tidak Hadir (Alpa)";
      variant = "destructive";
    } else if (att.status === "SICK") {
      statusLabel = "Sakit";
      variant = "warning";
    } else if (att.status === "PERMISSION") {
      statusLabel = "Izin";
      variant = "secondary";
    } else if (att.status === "LATE") {
      statusLabel = "Terlambat";
      variant = "warning";
    }

    events.push({
      id: `att-${att.id}`,
      type: "ATTENDANCE",
      date: att.teachingSession.date,
      title: `Presensi: ${sessionTopic}`,
      description: att.note ? `Status: ${statusLabel} (${att.note})` : `Status: ${statusLabel}`,
      badge: {
        text: statusLabel,
        variant,
      },
    });
  }

  // 2. Completed Assessment & Remedial Events
  for (const res of assessmentResults) {
    // Only completed assessments appear on academic timeline
    if (res.assessment.status === "COMPLETED") {
      if (res.status === "GRADED" && res.finalScore !== null) {
        const numScore = Number(res.finalScore);
        const kktp = res.assessment.minimumPassingScore ? Number(res.assessment.minimumPassingScore) : null;
        const isTuntas = kktp === null || numScore >= kktp;

        events.push({
          id: `res-${res.id}`,
          type: "ASSESSMENT",
          date: res.assessment.assessmentDate,
          title: `Penilaian: ${res.assessment.title}`,
          description: `Jenis: ${res.assessment.assessmentType.name} • Nilai Akhir: ${numScore.toFixed(1)}${kktp ? ` (KKTP: ${kktp})` : ""}`,
          badge: {
            text: isTuntas ? "Tuntas" : "Di Bawah KKTP",
            variant: isTuntas ? "success" : "destructive",
          },
        });
      }

      // Remedial attempts for this assessment
      if (res.remedialAttempts && res.remedialAttempts.length > 0) {
        for (const rem of res.remedialAttempts) {
          const remScore = Number(rem.score);
          events.push({
            id: `rem-${rem.id}`,
            type: "REMEDIAL",
            date: rem.attemptDate,
            title: `Remedial: ${res.assessment.title}`,
            description: rem.note
              ? `Skor Remedial: ${remScore.toFixed(1)} • Catatan: ${rem.note}`
              : `Skor Remedial: ${remScore.toFixed(1)}`,
            badge: {
              text: "Remedial",
              variant: "secondary",
            },
          });
        }
      }
    }
  }

  // 3. Notes Events (Only non-archived or all historical)
  for (const note of notes) {
    let badgeText = "Catatan";
    let variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" = "outline";

    if (note.requiresFollowUp) {
      if (note.resolvedAt) {
        badgeText = "Tindak Lanjut Selesai";
        variant = "secondary";
      } else {
        badgeText = "Perlu Tindak Lanjut";
        variant = "warning";
      }
    }

    events.push({
      id: `note-${note.id}`,
      type: "NOTE",
      date: note.createdAt,
      title: "Catatan Monitoring Guru",
      description: note.content,
      badge: {
        text: badgeText,
        variant,
      },
    });
  }

  // Sort strictly descending by date
  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
