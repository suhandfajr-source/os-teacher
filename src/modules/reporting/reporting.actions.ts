"use server";

import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import {
  reportQueryFilterSchema,
  parseDateRangeFilter,
} from "./reporting.service";
import {
  TeachingJournalReportData,
  AttendanceRecapReportData,
  ScoreRecapReportData,
  MonitoringReportData,
  AcademicCoverageReportData,
  AttendanceRecapStudentRow,
  ScoreRecapStudentRow,
  MonitoringReportStudentRow,
} from "./reporting.types";
import { calculateStudentRunningPerformance } from "@/modules/assessment/assessment.service";
import { SessionStatus, AssessmentStatus, AttendanceStatus, Prisma } from "@prisma/client";

/**
 * Teaching Journal Report.
 * Derived from TeachingSession, AttendanceRecord, Assignment, and TeachingSessionLearningObjective.
 */
export async function getTeachingJournalReport(
  teachingContextId: string,
  filters?: { startDate?: string; endDate?: string }
): Promise<TeachingJournalReportData> {
  reportQueryFilterSchema.parse({ teachingContextId, ...filters });
  const { context } = await verifyTeachingContextAccess(teachingContextId);

  const { startDate, endDate } = parseDateRangeFilter(filters?.startDate, filters?.endDate);

  const whereClause: {
    teachingContextId: string;
    date?: { gte?: Date; lte?: Date };
  } = {
    teachingContextId: context.id,
  };

  if (startDate || endDate) {
    whereClause.date = {};
    if (startDate) whereClause.date.gte = startDate;
    if (endDate) whereClause.date.lte = endDate;
  }

  const [contextDetails, sessions] = await Promise.all([
    prisma.teachingContext.findUniqueOrThrow({
      where: { id: context.id },
      include: {
        school: true,
        class: true,
        subject: true,
        academicPeriod: true,
        teacherProfile: { include: { user: true } },
      },
    }),
    prisma.teachingSession.findMany({
      where: whereClause,
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      include: {
        attendanceRecords: true,
        assignments: {
          select: {
            id: true,
            title: true,
            dueDate: true,
          },
        },
        learningObjectiveLinks: {
          select: {
            id: true,
            snapshotCode: true,
            snapshotDescription: true,
          },
        },
      },
    }),
  ]);

  let completedCount = 0;
  let inProgressCount = 0;

  const sessionRows = sessions.map((session) => {
    if (session.status === SessionStatus.COMPLETED) {
      completedCount++;
    } else {
      inProgressCount++;
    }

    let present = 0;
    let late = 0;
    let sick = 0;
    let permission = 0;
    let absent = 0;

    for (const att of session.attendanceRecords) {
      if (att.status === "PRESENT") present++;
      else if (att.status === "LATE") late++;
      else if (att.status === "SICK") sick++;
      else if (att.status === "PERMISSION") permission++;
      else if (att.status === "ABSENT") absent++;
    }

    return {
      id: session.id,
      date: session.date,
      status: session.status,
      plannedTopic: session.plannedTopic,
      actualTopic: session.actualTopic,
      activitySummary: session.activitySummary,
      reflection: session.reflection,
      attendanceCounts: {
        total: session.attendanceRecords.length,
        present,
        late,
        sick,
        permission,
        absent,
      },
      assignments: session.assignments.map((a) => ({
        id: a.id,
        title: a.title,
        dueDate: a.dueDate,
      })),
      objectives: session.learningObjectiveLinks.map((o) => ({
        id: o.id,
        code: o.snapshotCode,
        description: o.snapshotDescription,
      })),
    };
  });

  return {
    contextInfo: {
      id: contextDetails.id,
      schoolName: contextDetails.school.name,
      className: contextDetails.class.name,
      subjectName: contextDetails.subject.name,
      academicPeriodYear: contextDetails.academicPeriod.year,
      academicPeriodSemester: contextDetails.academicPeriod.semester,
      teacherName: contextDetails.teacherProfile.preferredName || contextDetails.teacherProfile.user.name,
    },
    totalSessions: sessions.length,
    completedSessionsCount: completedCount,
    inProgressSessionsCount: inProgressCount,
    sessions: sessionRows,
  };
}

/**
 * Attendance Recap Report.
 * Authoritative participant truth comes from AttendanceRecord snapshots.
 * Preserves former-roster historical facts. Late enrollees receive "—" (NOT_ENROLLED).
 */
export async function getAttendanceRecapReport(
  teachingContextId: string,
  filters?: { startDate?: string; endDate?: string; studentSearch?: string; includeHistoricalRoster?: boolean }
): Promise<AttendanceRecapReportData> {
  reportQueryFilterSchema.parse({ teachingContextId, ...filters });
  const { context } = await verifyTeachingContextAccess(teachingContextId);

  const { startDate, endDate } = parseDateRangeFilter(filters?.startDate, filters?.endDate);

  const sessionWhere: {
    teachingContextId: string;
    attendanceRecordedAt?: { not: null };
    date?: { gte?: Date; lte?: Date };
  } = {
    teachingContextId: context.id,
    attendanceRecordedAt: { not: null },
  };

  if (startDate || endDate) {
    sessionWhere.date = {};
    if (startDate) sessionWhere.date.gte = startDate;
    if (endDate) sessionWhere.date.lte = endDate;
  }

  const [contextDetails, sessions, currentClassMemberships, historicalAttendanceRecords] = await Promise.all([
    prisma.teachingContext.findUniqueOrThrow({
      where: { id: context.id },
      include: {
        school: true,
        class: true,
        subject: true,
        academicPeriod: true,
        teacherProfile: { include: { user: true } },
      },
    }),
    prisma.teachingSession.findMany({
      where: sessionWhere,
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        date: true,
        plannedTopic: true,
        actualTopic: true,
        status: true,
      },
    }),
    prisma.classStudent.findMany({
      where: {
        classId: context.classId,
        academicPeriodId: context.academicPeriodId,
      },
      include: {
        student: true,
      },
      orderBy: { student: { fullName: "asc" } },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        teachingSession: {
          teachingContextId: context.id,
          attendanceRecordedAt: { not: null },
        },
      },
      include: {
        student: true,
      },
    }),
  ]);

  // Set of current enrolled student IDs
  const currentStudentMap = new Map(currentClassMemberships.map((cs) => [cs.studentId, cs.student]));

  // Map of studentId -> Student for all students encountered in history or current roster
  const allStudentsMap = new Map<string, { id: string; fullName: string; nis: string | null }>();

  // Add all current students
  for (const cs of currentClassMemberships) {
    allStudentsMap.set(cs.studentId, {
      id: cs.student.id,
      fullName: cs.student.fullName,
      nis: cs.student.nis,
    });
  }

  // Add historical students with recorded attendance
  for (const att of historicalAttendanceRecords) {
    if (!allStudentsMap.has(att.studentId)) {
      allStudentsMap.set(att.studentId, {
        id: att.student.id,
        fullName: att.student.fullName,
        nis: att.student.nis,
      });
    }
  }

  // Index attendance by studentId -> sessionId -> AttendanceRecord
  const attendanceLookup = new Map<string, Map<string, { status: AttendanceStatus; note: string | null }>>();

  for (const att of historicalAttendanceRecords) {
    if (!attendanceLookup.has(att.studentId)) {
      attendanceLookup.set(att.studentId, new Map());
    }
    attendanceLookup.get(att.studentId)!.set(att.teachingSessionId, {
      status: att.status,
      note: att.note,
    });
  }

  // Build rows
  let studentsList = Array.from(allStudentsMap.values());

  if (filters?.studentSearch) {
    const searchLower = filters.studentSearch.toLowerCase();
    studentsList = studentsList.filter(
      (s) => s.fullName.toLowerCase().includes(searchLower) || (s.nis && s.nis.toLowerCase().includes(searchLower))
    );
  }

  // Sort: current roster first (alphabetical), then former roster (alphabetical)
  studentsList.sort((a, b) => {
    const aCurrent = currentStudentMap.has(a.id);
    const bCurrent = currentStudentMap.has(b.id);
    if (aCurrent && !bCurrent) return -1;
    if (!aCurrent && bCurrent) return 1;
    return a.fullName.localeCompare(b.fullName);
  });

  const studentRows: AttendanceRecapStudentRow[] = studentsList.map((student) => {
    const isCurrentRoster = currentStudentMap.has(student.id);
    const rosterStatusLabel = isCurrentRoster ? "Aktif di kelas" : "Tidak di roster saat ini";

    const studentAttMap = attendanceLookup.get(student.id);
    const recordsBySessionId: AttendanceRecapStudentRow["recordsBySessionId"] = {};

    let recordedCount = 0;
    let present = 0;
    let late = 0;
    let sick = 0;
    let permission = 0;
    let absent = 0;

    for (const session of sessions) {
      const record = studentAttMap?.get(session.id);
      if (record) {
        recordsBySessionId[session.id] = {
          status: record.status,
          note: record.note,
        };
        recordedCount++;
        if (record.status === "PRESENT") present++;
        else if (record.status === "LATE") late++;
        else if (record.status === "SICK") sick++;
        else if (record.status === "PERMISSION") permission++;
        else if (record.status === "ABSENT") absent++;
      } else {
        // Not a participant in this historical session snapshot
        recordsBySessionId[session.id] = {
          status: "NOT_ENROLLED",
          note: null,
        };
      }
    }

    return {
      studentId: student.id,
      fullName: student.fullName,
      nis: student.nis,
      isCurrentRoster,
      rosterStatusLabel,
      recordsBySessionId,
      summary: {
        recordedSessionsCount: recordedCount,
        presentCount: present,
        lateCount: late,
        sickCount: sick,
        permissionCount: permission,
        absentCount: absent,
      },
    };
  });

  return {
    contextInfo: {
      id: contextDetails.id,
      schoolName: contextDetails.school.name,
      className: contextDetails.class.name,
      subjectName: contextDetails.subject.name,
      academicPeriodYear: contextDetails.academicPeriod.year,
      academicPeriodSemester: contextDetails.academicPeriod.semester,
      teacherName: contextDetails.teacherProfile.preferredName || contextDetails.teacherProfile.user.name,
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      date: s.date,
      actualTopic: s.actualTopic,
      plannedTopic: s.plannedTopic,
      status: s.status,
    })),
    students: studentRows,
  };
}

/**
 * Assessment & Score Recap Report.
 * Authoritative participant truth comes from AssessmentResult.
 * Rows include all historical results (GRADED, ABSENT, EXCUSED, PENDING).
 * Aggregation reuses calculateStudentRunningPerformance for COMPLETED assessments and GRADED non-null scores.
 */
export async function getScoreRecapReport(
  teachingContextId: string,
  filters?: { studentSearch?: string; includeHistoricalRoster?: boolean }
): Promise<ScoreRecapReportData> {
  reportQueryFilterSchema.parse({ teachingContextId, ...filters });
  const { context } = await verifyTeachingContextAccess(teachingContextId);

  const [contextDetails, completedAssessments, gradePolicy, currentClassMemberships, allAssessmentResults] =
    await Promise.all([
      prisma.teachingContext.findUniqueOrThrow({
        where: { id: context.id },
        include: {
          school: true,
          class: true,
          subject: true,
          academicPeriod: true,
          teacherProfile: { include: { user: true } },
        },
      }),
      prisma.assessment.findMany({
        where: {
          teachingContextId: context.id,
          status: AssessmentStatus.COMPLETED,
        },
        orderBy: [{ assessmentDate: "asc" }, { createdAt: "asc" }],
        include: {
          assessmentType: true,
        },
      }),
      prisma.gradePolicy.findUnique({
        where: { teachingContextId: context.id },
        include: {
          items: {
            include: { assessmentType: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
      prisma.classStudent.findMany({
        where: {
          classId: context.classId,
          academicPeriodId: context.academicPeriodId,
        },
        include: { student: true },
        orderBy: { student: { fullName: "asc" } },
      }),
      prisma.assessmentResult.findMany({
        where: {
          assessment: {
            teachingContextId: context.id,
            status: AssessmentStatus.COMPLETED,
          },
        },
        include: {
          student: true,
          remedialAttempts: true,
        },
      }),
    ]);

  const hasActiveGradePolicy = gradePolicy?.status === "ACTIVE";

  // Build union of students
  const currentStudentMap = new Map(currentClassMemberships.map((cs) => [cs.studentId, cs.student]));
  const allStudentsMap = new Map<string, { id: string; fullName: string; nis: string | null }>();

  for (const cs of currentClassMemberships) {
    allStudentsMap.set(cs.studentId, {
      id: cs.student.id,
      fullName: cs.student.fullName,
      nis: cs.student.nis,
    });
  }

  for (const res of allAssessmentResults) {
    if (!allStudentsMap.has(res.studentId)) {
      allStudentsMap.set(res.studentId, {
        id: res.student.id,
        fullName: res.student.fullName,
        nis: res.student.nis,
      });
    }
  }

  // Lookup of studentId -> assessmentId -> result
  const resultsLookup = new Map<string, Map<string, (typeof allAssessmentResults)[0]>>();
  for (const res of allAssessmentResults) {
    if (!resultsLookup.has(res.studentId)) {
      resultsLookup.set(res.studentId, new Map());
    }
    resultsLookup.get(res.studentId)!.set(res.assessmentId, res);
  }

  let studentsList = Array.from(allStudentsMap.values());

  if (filters?.studentSearch) {
    const searchLower = filters.studentSearch.toLowerCase();
    studentsList = studentsList.filter(
      (s) => s.fullName.toLowerCase().includes(searchLower) || (s.nis && s.nis.toLowerCase().includes(searchLower))
    );
  }

  studentsList.sort((a, b) => {
    const aCurrent = currentStudentMap.has(a.id);
    const bCurrent = currentStudentMap.has(b.id);
    if (aCurrent && !bCurrent) return -1;
    if (!aCurrent && bCurrent) return 1;
    return a.fullName.localeCompare(b.fullName);
  });

  // Prepare policy items for calculateStudentRunningPerformance
  const policyItemsSnapshot =
    hasActiveGradePolicy && gradePolicy
      ? gradePolicy.items.map((item) => ({
          assessmentTypeId: item.assessmentTypeId,
          assessmentTypeName: item.assessmentType.name,
          category: item.assessmentType.category,
          weight: item.weight,
        }))
      : [];

  const studentRows: ScoreRecapStudentRow[] = studentsList.map((student) => {
    const isCurrentRoster = currentStudentMap.has(student.id);
    const rosterStatusLabel = isCurrentRoster ? "Aktif di kelas" : "Tidak di roster saat ini";

    const studentResultsMap = resultsLookup.get(student.id);
    const scoresByAssessmentId: ScoreRecapStudentRow["scoresByAssessmentId"] = {};

    const studentScoreSnapshotsForCalculation: Array<{
      assessmentId: string;
      assessmentTypeId: string;
      assessmentTypeName: string;
      assessmentStatus: "COMPLETED";
      resultStatus: "PENDING" | "GRADED" | "ABSENT" | "EXCUSED";
      finalScore: Prisma.Decimal | null;
    }> = [];

    for (const assessment of completedAssessments) {
      const res = studentResultsMap?.get(assessment.id);
      if (res) {
        scoresByAssessmentId[assessment.id] = {
          status: res.status,
          rawScore: res.rawScore ? Number(res.rawScore) : null,
          normalizedScore: res.normalizedScore ? Number(res.normalizedScore) : null,
          finalScore: res.finalScore ? Number(res.finalScore) : null,
          remedialAttemptsCount: res.remedialAttempts.length,
        };

        studentScoreSnapshotsForCalculation.push({
          assessmentId: assessment.id,
          assessmentTypeId: assessment.assessmentTypeId,
          assessmentTypeName: assessment.assessmentType.name,
          assessmentStatus: "COMPLETED",
          resultStatus: res.status,
          finalScore: res.finalScore,
        });
      } else {
        scoresByAssessmentId[assessment.id] = {
          status: "NOT_ENROLLED",
          rawScore: null,
          normalizedScore: null,
          finalScore: null,
          remedialAttemptsCount: 0,
        };
      }
    }

    let runningPerformance: number | null = null;
    let availableWeight: number | null = null;

    if (hasActiveGradePolicy && policyItemsSnapshot.length > 0) {
      const calc = calculateStudentRunningPerformance(
        student,
        policyItemsSnapshot,
        studentScoreSnapshotsForCalculation
      );
      runningPerformance = calc.runningPerformance ? Number(calc.runningPerformance) : null;
      availableWeight = calc.availableWeight ? Number(calc.availableWeight) : null;
    }

    return {
      studentId: student.id,
      fullName: student.fullName,
      nis: student.nis,
      isCurrentRoster,
      rosterStatusLabel,
      scoresByAssessmentId,
      runningPerformance,
      availableWeight,
    };
  });

  return {
    contextInfo: {
      id: contextDetails.id,
      schoolName: contextDetails.school.name,
      className: contextDetails.class.name,
      subjectName: contextDetails.subject.name,
      academicPeriodYear: contextDetails.academicPeriod.year,
      academicPeriodSemester: contextDetails.academicPeriod.semester,
      teacherName: contextDetails.teacherProfile.preferredName || contextDetails.teacherProfile.user.name,
    },
    hasActiveGradePolicy,
    gradePolicyStatus: gradePolicy?.status || null,
    assessments: completedAssessments.map((a) => ({
      id: a.id,
      title: a.title,
      assessmentDate: a.assessmentDate,
      assessmentTypeName: a.assessmentType.name,
      maxScore: Number(a.maxScore),
      minimumPassingScore: a.minimumPassingScore ? Number(a.minimumPassingScore) : null,
    })),
    students: studentRows,
  };
}

/**
 * Monitoring & Follow-Up Report.
 * Authoritative factual signals from Stage 05 + teacher-owned monitoring notes.
 */
export async function getMonitoringReport(
  teachingContextId: string,
  filters?: { studentSearch?: string; includeHistoricalRoster?: boolean }
): Promise<MonitoringReportData> {
  reportQueryFilterSchema.parse({ teachingContextId, ...filters });
  const { context } = await verifyTeachingContextAccess(teachingContextId);

  const [contextDetails, currentClassMemberships, attendanceRecords, assessmentResults, notes] = await Promise.all([
    prisma.teachingContext.findUniqueOrThrow({
      where: { id: context.id },
      include: {
        school: true,
        class: true,
        subject: true,
        academicPeriod: true,
        teacherProfile: { include: { user: true } },
      },
    }),
    prisma.classStudent.findMany({
      where: {
        classId: context.classId,
        academicPeriodId: context.academicPeriodId,
      },
      include: { student: true },
      orderBy: { student: { fullName: "asc" } },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        teachingSession: {
          teachingContextId: context.id,
          attendanceRecordedAt: { not: null },
        },
      },
    }),
    prisma.assessmentResult.findMany({
      where: {
        assessment: {
          teachingContextId: context.id,
          status: AssessmentStatus.COMPLETED,
        },
      },
      include: {
        assessment: true,
        remedialAttempts: true,
      },
    }),
    prisma.studentMonitoringNote.findMany({
      where: {
        teachingContextId: context.id,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const currentStudentMap = new Map(currentClassMemberships.map((cs) => [cs.studentId, cs.student]));
  const allStudentsMap = new Map<string, { id: string; fullName: string; nis: string | null }>();

  for (const cs of currentClassMemberships) {
    allStudentsMap.set(cs.studentId, {
      id: cs.student.id,
      fullName: cs.student.fullName,
      nis: cs.student.nis,
    });
  }

  if (filters?.includeHistoricalRoster) {
    for (const att of attendanceRecords) {
      if (!allStudentsMap.has(att.studentId)) {
        const s = await prisma.student.findUnique({ where: { id: att.studentId } });
        if (s) allStudentsMap.set(s.id, { id: s.id, fullName: s.fullName, nis: s.nis });
      }
    }
    for (const note of notes) {
      if (!allStudentsMap.has(note.studentId)) {
        const s = await prisma.student.findUnique({ where: { id: note.studentId } });
        if (s) allStudentsMap.set(s.id, { id: s.id, fullName: s.fullName, nis: s.nis });
      }
    }
  }

  let studentsList = Array.from(allStudentsMap.values());

  if (filters?.studentSearch) {
    const searchLower = filters.studentSearch.toLowerCase();
    studentsList = studentsList.filter(
      (s) => s.fullName.toLowerCase().includes(searchLower) || (s.nis && s.nis.toLowerCase().includes(searchLower))
    );
  }

  studentsList.sort((a, b) => {
    const aCurrent = currentStudentMap.has(a.id);
    const bCurrent = currentStudentMap.has(b.id);
    if (aCurrent && !bCurrent) return -1;
    if (!aCurrent && bCurrent) return 1;
    return a.fullName.localeCompare(b.fullName);
  });

  const studentRows: MonitoringReportStudentRow[] = studentsList.map((student) => {
    const isCurrentRoster = currentStudentMap.has(student.id);
    const rosterStatusLabel = isCurrentRoster ? "Aktif di kelas" : "Tidak di roster saat ini";

    const studentAtts = attendanceRecords.filter((a) => a.studentId === student.id);
    let present = 0;
    let late = 0;
    let sick = 0;
    let permission = 0;
    let absent = 0;

    for (const a of studentAtts) {
      if (a.status === "PRESENT") present++;
      else if (a.status === "LATE") late++;
      else if (a.status === "SICK") sick++;
      else if (a.status === "PERMISSION") permission++;
      else if (a.status === "ABSENT") absent++;
    }

    const studentResults = assessmentResults.filter((r) => r.studentId === student.id);
    let completedGradedCount = 0;
    let belowKktpCount = 0;
    let remedialAttemptsCount = 0;
    let latestGradedScore: number | null = null;
    let latestDate: Date | null = null;

    for (const r of studentResults) {
      remedialAttemptsCount += r.remedialAttempts.length;
      if (r.status === "GRADED" && r.finalScore !== null) {
        completedGradedCount++;
        const numScore = Number(r.finalScore);
        if (r.assessment.minimumPassingScore && numScore < Number(r.assessment.minimumPassingScore)) {
          belowKktpCount++;
        }
        const aDate = new Date(r.assessment.assessmentDate);
        if (!latestDate || aDate >= latestDate) {
          latestDate = aDate;
          latestGradedScore = numScore;
        }
      }
    }

    const studentNotes = notes.filter((n) => n.studentId === student.id);
    let openFollowUp = 0;
    let resolvedFollowUp = 0;

    for (const n of studentNotes) {
      if (n.requiresFollowUp) {
        if (n.resolvedAt) resolvedFollowUp++;
        else openFollowUp++;
      }
    }

    return {
      studentId: student.id,
      fullName: student.fullName,
      nis: student.nis,
      isCurrentRoster,
      rosterStatusLabel,
      attendance: {
        totalRecorded: studentAtts.length,
        present,
        late,
        sick,
        permission,
        absent,
      },
      assessment: {
        completedGradedCount,
        belowKktpCount,
        remedialAttemptsCount,
        latestGradedScore,
      },
      notesSummary: {
        totalNotes: studentNotes.length,
        openFollowUpCount: openFollowUp,
        resolvedFollowUpCount: resolvedFollowUp,
      },
      notes: studentNotes.map((n) => ({
        id: n.id,
        content: n.content,
        requiresFollowUp: n.requiresFollowUp,
        resolvedAt: n.resolvedAt,
        isArchived: n.isArchived,
        createdAt: n.createdAt,
      })),
    };
  });

  return {
    contextInfo: {
      id: contextDetails.id,
      schoolName: contextDetails.school.name,
      className: contextDetails.class.name,
      subjectName: contextDetails.subject.name,
      academicPeriodYear: contextDetails.academicPeriod.year,
      academicPeriodSemester: contextDetails.academicPeriod.semester,
      teacherName: contextDetails.teacherProfile.preferredName || contextDetails.teacherProfile.user.name,
    },
    students: studentRows,
  };
}

/**
 * Academic Coverage Report.
 * Evaluates factual linkage to COMPLETED TeachingSessions and COMPLETED Assessments.
 * No AI guesswork, no fake compliance bars.
 */
export async function getAcademicCoverageReport(teachingContextId: string): Promise<AcademicCoverageReportData> {
  reportQueryFilterSchema.parse({ teachingContextId });
  const { context } = await verifyTeachingContextAccess(teachingContextId);

  const [contextDetails, profile, objectives] = await Promise.all([
    prisma.teachingContext.findUniqueOrThrow({
      where: { id: context.id },
      include: {
        school: true,
        class: true,
        subject: true,
        academicPeriod: true,
        teacherProfile: { include: { user: true } },
      },
    }),
    prisma.academicContextProfile.findUnique({
      where: { teachingContextId: context.id },
    }),
    prisma.learningObjective.findMany({
      where: { teachingContextId: context.id },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      include: {
        sessionLinks: {
          where: {
            teachingSession: { status: SessionStatus.COMPLETED },
          },
          include: {
            teachingSession: {
              select: { date: true },
            },
          },
        },
        assessmentLinks: {
          where: {
            assessment: { status: AssessmentStatus.COMPLETED },
          },
        },
      },
    }),
  ]);

  let activeCount = 0;
  let archivedCount = 0;

  const rows = objectives.map((obj) => {
    if (obj.status === "ACTIVE") activeCount++;
    else archivedCount++;

    let latestDate: Date | null = null;
    for (const link of obj.sessionLinks) {
      const sDate = new Date(link.teachingSession.date);
      if (!latestDate || sDate >= latestDate) {
        latestDate = sDate;
      }
    }

    return {
      id: obj.id,
      code: obj.code,
      description: obj.description,
      orderIndex: obj.orderIndex,
      status: obj.status,
      completedTeachingSessionsCount: obj.sessionLinks.length,
      latestTaughtDate: latestDate,
      completedAssessmentsCount: obj.assessmentLinks.length,
    };
  });

  return {
    contextInfo: {
      id: contextDetails.id,
      schoolName: contextDetails.school.name,
      className: contextDetails.class.name,
      subjectName: contextDetails.subject.name,
      academicPeriodYear: contextDetails.academicPeriod.year,
      academicPeriodSemester: contextDetails.academicPeriod.semester,
      teacherName: contextDetails.teacherProfile.preferredName || contextDetails.teacherProfile.user.name,
      curriculumName: profile?.curriculumName || null,
      phase: profile?.phase || null,
      academicNote: profile?.academicNote || null,
      cpText: profile?.cpText || null,
    },
    totalObjectivesCount: objectives.length,
    activeObjectivesCount: activeCount,
    archivedObjectivesCount: archivedCount,
    objectives: rows,
  };
}
