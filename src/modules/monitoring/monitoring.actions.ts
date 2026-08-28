"use server";

import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  verifyActiveSchoolMembership,
  verifyTeachingContextAccess,
  verifyCurrentStudentInTeachingContext,
  verifyStudentHistoricalAccessInContext,
  verifyMonitoringNoteAccess,
} from "@/lib/authorization";
import {
  createMonitoringNoteSchema,
  updateMonitoringNoteSchema,
  resolveMonitoringFollowUpSchema,
  archiveMonitoringNoteSchema,
  CreateMonitoringNoteInput,
  UpdateMonitoringNoteInput,
  ResolveMonitoringFollowUpInput,
  ArchiveMonitoringNoteInput,
  StudentMonitoringRow,
  GlobalContextMonitoringOverview,
} from "./monitoring.types";
import {
  summarizeStudentAttendance,
  summarizeStudentAssessments,
  calculateClassMonitoringMetrics,
  composeStudentActivityTimeline,
  RawAssessmentResultForMonitoring,
  RawAttendanceForTimeline,
  RawNoteForTimeline,
} from "./monitoring.service";
import {
  calculateStudentRunningPerformance,
  PolicyItemSnapshot,
  StudentScoreSnapshot,
} from "../assessment/assessment.service";

// ============================================================================
// 1. CLASS MONITORING QUERIES
// ============================================================================

export async function getClassMonitoringData(teachingContextId: string) {
  const { context } = await verifyTeachingContextAccess(teachingContextId);

  // Binding Amendment 1: CURRENT roster only
  const classStudents = await prisma.classStudent.findMany({
    where: {
      classId: context.classId,
      academicPeriodId: context.academicPeriodId,
    },
    include: {
      student: true,
    },
    orderBy: {
      student: {
        fullName: "asc",
      },
    },
  });

  const currentStudentIds = classStudents.map((cs) => cs.studentId);

  // Binding Amendment 7: Isolated to exact TeachingContext at query level
  const [attendanceRecords, rawResults, activeGradePolicy, activeNotes] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        studentId: { in: currentStudentIds },
        teachingSession: {
          teachingContextId: context.id,
        },
      },
      select: {
        studentId: true,
        status: true,
      },
    }),
    prisma.assessmentResult.findMany({
      where: {
        studentId: { in: currentStudentIds },
        assessment: {
          teachingContextId: context.id,
        },
      },
      include: {
        assessment: {
          include: {
            assessmentType: true,
          },
        },
        remedialAttempts: true,
      },
    }),
    prisma.gradePolicy.findFirst({
      where: {
        teachingContextId: context.id,
        status: "ACTIVE",
      },
      include: {
        items: {
          include: {
            assessmentType: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    prisma.studentMonitoringNote.findMany({
      where: {
        teachingContextId: context.id,
        studentId: { in: currentStudentIds },
        isArchived: false,
      },
    }),
  ]);

  // Group data by studentId
  const attendanceByStudent = new Map<string, Array<{ status: "PRESENT" | "SICK" | "PERMISSION" | "ABSENT" | "LATE" }>>();
  for (const att of attendanceRecords) {
    if (!attendanceByStudent.has(att.studentId)) {
      attendanceByStudent.set(att.studentId, []);
    }
    attendanceByStudent.get(att.studentId)!.push(att);
  }

  const resultsByStudent = new Map<string, RawAssessmentResultForMonitoring[]>();
  for (const res of rawResults) {
    if (!resultsByStudent.has(res.studentId)) {
      resultsByStudent.set(res.studentId, []);
    }
    resultsByStudent.get(res.studentId)!.push(res as RawAssessmentResultForMonitoring);
  }

  const notesByStudent = new Map<string, typeof activeNotes>();
  for (const note of activeNotes) {
    if (!notesByStudent.has(note.studentId)) {
      notesByStudent.set(note.studentId, []);
    }
    notesByStudent.get(note.studentId)!.push(note);
  }

  // Prepare Policy snapshots if active policy exists
  let policySnapshots: PolicyItemSnapshot[] | null = null;
  if (activeGradePolicy && activeGradePolicy.items.length > 0) {
    policySnapshots = activeGradePolicy.items.map((item) => ({
      assessmentTypeId: item.assessmentTypeId,
      assessmentTypeName: item.assessmentType.name,
      category: item.assessmentType.category,
      weight: item.weight,
    }));
  }

  // Compose per-student rows
  const rows: StudentMonitoringRow[] = classStudents.map((cs) => {
    const student = cs.student;
    const studentAttendance = attendanceByStudent.get(student.id) || [];
    const studentResults = resultsByStudent.get(student.id) || [];
    const studentNotes = notesByStudent.get(student.id) || [];

    const attendanceSummary = summarizeStudentAttendance(studentAttendance);
    const assessmentSummary = summarizeStudentAssessments(studentResults);

    let runningPerformanceSummary: { availableWeight: number; score: number | null } | null = null;
    if (policySnapshots) {
      const scoreSnapshots: StudentScoreSnapshot[] = studentResults.map((r) => ({
        assessmentId: r.assessment.id,
        assessmentTypeId: r.assessment.assessmentType.id,
        assessmentTypeName: r.assessment.assessmentType.name,
        assessmentStatus: r.assessment.status,
        resultStatus: r.status,
        finalScore: r.finalScore,
      }));

      const runningGrade = calculateStudentRunningPerformance(
        { id: student.id, fullName: student.fullName, nis: student.nis },
        policySnapshots,
        scoreSnapshots
      );

      runningPerformanceSummary = {
        availableWeight: Number(runningGrade.availableWeight),
        score: runningGrade.runningPerformance !== null ? Number(runningGrade.runningPerformance) : null,
      };
    }

    const openFollowUpCount = studentNotes.filter((n) => n.requiresFollowUp && n.resolvedAt === null).length;

    return {
      studentId: student.id,
      fullName: student.fullName,
      nis: student.nis,
      attendance: attendanceSummary,
      assessment: assessmentSummary,
      runningPerformance: runningPerformanceSummary,
      openFollowUpCount,
      notesCount: studentNotes.length,
    };
  });

  const metrics = calculateClassMonitoringMetrics(rows);

  return {
    context,
    rows,
    metrics,
    hasActiveGradePolicy: !!activeGradePolicy,
  };
}

// ============================================================================
// 2. STUDENT MONITORING DETAIL QUERY
// ============================================================================

export async function getStudentMonitoringDetail(teachingContextId: string, studentId: string) {
  const { context, student, isCurrentRosterStudent } = await verifyStudentHistoricalAccessInContext(
    teachingContextId,
    studentId
  );

  const [attendanceRecords, rawResults, activeGradePolicy, notes] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        studentId: student.id,
        teachingSession: {
          teachingContextId: context.id,
        },
      },
      include: {
        teachingSession: true,
      },
      orderBy: {
        teachingSession: {
          date: "desc",
        },
      },
    }),
    prisma.assessmentResult.findMany({
      where: {
        studentId: student.id,
        assessment: {
          teachingContextId: context.id,
        },
      },
      include: {
        assessment: {
          include: {
            assessmentType: true,
          },
        },
        remedialAttempts: {
          orderBy: {
            attemptDate: "desc",
          },
        },
      },
      orderBy: {
        assessment: {
          assessmentDate: "desc",
        },
      },
    }),
    prisma.gradePolicy.findFirst({
      where: {
        teachingContextId: context.id,
        status: "ACTIVE",
      },
      include: {
        items: {
          include: {
            assessmentType: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    prisma.studentMonitoringNote.findMany({
      where: {
        teachingContextId: context.id,
        studentId: student.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  const attendanceSummary = summarizeStudentAttendance(attendanceRecords);
  const assessmentSummary = summarizeStudentAssessments(rawResults as RawAssessmentResultForMonitoring[]);

  let runningPerformanceResult = null;
  if (activeGradePolicy && activeGradePolicy.items.length > 0) {
    const policySnapshots: PolicyItemSnapshot[] = activeGradePolicy.items.map((item) => ({
      assessmentTypeId: item.assessmentTypeId,
      assessmentTypeName: item.assessmentType.name,
      category: item.assessmentType.category,
      weight: item.weight,
    }));

    const scoreSnapshots: StudentScoreSnapshot[] = rawResults.map((r) => ({
      assessmentId: r.assessment.id,
      assessmentTypeId: r.assessment.assessmentType.id,
      assessmentTypeName: r.assessment.assessmentType.name,
      assessmentStatus: r.assessment.status,
      resultStatus: r.status,
      finalScore: r.finalScore,
    }));

    const runningGrade = calculateStudentRunningPerformance(
      { id: student.id, fullName: student.fullName, nis: student.nis },
      policySnapshots,
      scoreSnapshots
    );

    runningPerformanceResult = {
      availableWeight: Number(runningGrade.availableWeight),
      runningPerformance: runningGrade.runningPerformance !== null ? Number(runningGrade.runningPerformance) : null,
      categories: runningGrade.categories.map((c) => ({
        assessmentTypeId: c.assessmentTypeId,
        assessmentTypeName: c.assessmentTypeName,
        category: c.category,
        weight: Number(c.weight),
        categoryAverage: c.categoryAverage !== null ? Number(c.categoryAverage) : null,
        completedAssessmentCount: c.completedAssessmentCount,
      })),
    };
  }

  // Timeline Composition
  const timeline = composeStudentActivityTimeline(
    attendanceRecords as unknown as RawAttendanceForTimeline[],
    rawResults as RawAssessmentResultForMonitoring[],
    notes as RawNoteForTimeline[]
  );

  return {
    context,
    student: {
      id: student.id,
      fullName: student.fullName,
      nis: student.nis,
      status: student.status,
    },
    isCurrentRosterStudent,
    attendanceSummary,
    assessmentSummary,
    runningPerformance: runningPerformanceResult,
    attendanceRecords,
    assessmentResults: rawResults,
    notes,
    timeline,
  };
}

// ============================================================================
// 3. GLOBAL MONITORING OVERVIEW
// ============================================================================

export async function getGlobalMonitoringOverview(): Promise<GlobalContextMonitoringOverview[]> {
  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

  const contexts = await prisma.teachingContext.findMany({
    where: {
      teacherProfileId: profile.id,
      schoolId: activeSchoolId,
    },
    include: {
      class: true,
      subject: true,
      academicPeriod: true,
      gradePolicy: true,
    },
    orderBy: [
      { class: { name: "asc" } },
      { subject: { name: "asc" } },
    ],
  });

  if (contexts.length === 0) {
    return [];
  }

  // 1. Collect context IDs and unique classId + academicPeriodId pairs
  const contextIds = contexts.map((c) => c.id);
  const classPeriodMap = new Map<string, { classId: string; academicPeriodId: string }>();
  for (const ctx of contexts) {
    const key = `${ctx.classId}:${ctx.academicPeriodId}`;
    if (!classPeriodMap.has(key)) {
      classPeriodMap.set(key, { classId: ctx.classId, academicPeriodId: ctx.academicPeriodId });
    }
  }

  // 2. Batch 3 data queries in parallel (O(1) database operations regardless of context count)
  const [allClassStudents, allOpenNotes, allCompletedResults] = await Promise.all([
    // Query A: Shared Rosters by real (classId, academicPeriodId)
    prisma.classStudent.findMany({
      where: {
        OR: Array.from(classPeriodMap.values()).map((cp) => ({
          classId: cp.classId,
          academicPeriodId: cp.academicPeriodId,
        })),
      },
      select: {
        classId: true,
        academicPeriodId: true,
        studentId: true,
      },
    }),
    // Query B: Open Notes for all authorized TeachingContexts
    prisma.studentMonitoringNote.findMany({
      where: {
        teachingContextId: { in: contextIds },
        requiresFollowUp: true,
        resolvedAt: null,
        isArchived: false,
      },
      select: {
        teachingContextId: true,
        studentId: true,
      },
    }),
    // Query C: Completed & Graded Results with KKTP for all authorized TeachingContexts
    prisma.assessmentResult.findMany({
      where: {
        status: "GRADED",
        finalScore: { not: null },
        assessment: {
          teachingContextId: { in: contextIds },
          status: "COMPLETED",
          minimumPassingScore: { not: null },
        },
      },
      select: {
        studentId: true,
        finalScore: true,
        assessment: {
          select: {
            teachingContextId: true,
            minimumPassingScore: true,
          },
        },
      },
    }),
  ]);

  // 3. Map shared rosters by `${classId}:${academicPeriodId}`
  const rosterMap = new Map<string, Set<string>>();
  for (const cs of allClassStudents) {
    const key = `${cs.classId}:${cs.academicPeriodId}`;
    if (!rosterMap.has(key)) {
      rosterMap.set(key, new Set());
    }
    rosterMap.get(key)!.add(cs.studentId);
  }

  // 4. Map open notes by `teachingContextId`
  const openNotesByContext = new Map<string, Set<string>>();
  for (const note of allOpenNotes) {
    if (!openNotesByContext.has(note.teachingContextId)) {
      openNotesByContext.set(note.teachingContextId, new Set());
    }
    openNotesByContext.get(note.teachingContextId)!.add(note.studentId);
  }

  // 5. Map below-KKTP students by `teachingContextId`
  const belowKktpByContext = new Map<string, Set<string>>();
  for (const r of allCompletedResults) {
    if (r.assessment.minimumPassingScore !== null && r.finalScore !== null) {
      if (Number(r.finalScore) < Number(r.assessment.minimumPassingScore)) {
        const ctxId = r.assessment.teachingContextId;
        if (!belowKktpByContext.has(ctxId)) {
          belowKktpByContext.set(ctxId, new Set());
        }
        belowKktpByContext.get(ctxId)!.add(r.studentId);
      }
    }
  }

  // 6. Assemble overviews in memory per context preserving data isolation
  const overviews: GlobalContextMonitoringOverview[] = contexts.map((ctx) => {
    const rosterKey = `${ctx.classId}:${ctx.academicPeriodId}`;
    const currentStudentSet = rosterMap.get(rosterKey) || new Set<string>();
    const currentStudentCount = currentStudentSet.size;

    if (currentStudentCount === 0) {
      return {
        teachingContextId: ctx.id,
        className: ctx.class.name,
        subjectName: ctx.subject.name,
        academicYear: ctx.academicPeriod.year,
        semester: ctx.academicPeriod.semester,
        currentStudentCount: 0,
        studentsWithOpenFollowUp: 0,
        studentsWithBelowKktp: 0,
        hasActiveGradePolicy: ctx.gradePolicy?.status === "ACTIVE",
      };
    }

    const contextOpenNotes = openNotesByContext.get(ctx.id) || new Set<string>();
    let studentsWithOpenFollowUp = 0;
    for (const studentId of contextOpenNotes) {
      if (currentStudentSet.has(studentId)) {
        studentsWithOpenFollowUp++;
      }
    }

    const contextBelowKktp = belowKktpByContext.get(ctx.id) || new Set<string>();
    let studentsWithBelowKktp = 0;
    for (const studentId of contextBelowKktp) {
      if (currentStudentSet.has(studentId)) {
        studentsWithBelowKktp++;
      }
    }

    return {
      teachingContextId: ctx.id,
      className: ctx.class.name,
      subjectName: ctx.subject.name,
      academicYear: ctx.academicPeriod.year,
      semester: ctx.academicPeriod.semester,
      currentStudentCount,
      studentsWithOpenFollowUp,
      studentsWithBelowKktp,
      hasActiveGradePolicy: ctx.gradePolicy?.status === "ACTIVE",
    };
  });

  return overviews;
}

// ============================================================================
// 4. MONITORING NOTE MUTATION ACTIONS
// ============================================================================

export async function createMonitoringNote(input: CreateMonitoringNoteInput) {
  const validated = createMonitoringNoteSchema.parse(input);

  // Binding Amendment 1: Requires CURRENT roster membership
  const { context, student } = await verifyCurrentStudentInTeachingContext(
    validated.teachingContextId,
    validated.studentId
  );

  const note = await prisma.studentMonitoringNote.create({
    data: {
      teachingContextId: context.id,
      studentId: student.id,
      content: validated.content,
      requiresFollowUp: validated.requiresFollowUp,
      resolvedAt: null,
      isArchived: false,
    },
  });

  revalidatePath(`/kelas/${context.id}/monitoring`);
  revalidatePath(`/kelas/${context.id}/monitoring/${student.id}`);
  revalidatePath(`/monitoring`);
  revalidatePath(`/siswa/${student.id}`);

  return note;
}

export async function updateMonitoringNote(input: UpdateMonitoringNoteInput) {
  const validated = updateMonitoringNoteSchema.parse(input);

  const { note, context } = await verifyMonitoringNoteAccess(validated.noteId);

  // Binding Amendment 6: Archived notes are read-only in V1
  if (note.isArchived) {
    throw new Error("Catatan yang diarsipkan bersifat read-only dan tidak dapat diubah");
  }

  // Invariants:
  // - If requiresFollowUp is false -> resolvedAt MUST be null
  // - If requiresFollowUp is true and was false -> resolvedAt becomes null (OPEN)
  // - If requiresFollowUp is true and was true -> keep existing resolvedAt
  let resolvedAt = note.resolvedAt;
  if (!validated.requiresFollowUp) {
    resolvedAt = null;
  } else if (!note.requiresFollowUp) {
    resolvedAt = null;
  }

  const updated = await prisma.studentMonitoringNote.update({
    where: { id: note.id },
    data: {
      content: validated.content,
      requiresFollowUp: validated.requiresFollowUp,
      resolvedAt,
    },
  });

  revalidatePath(`/kelas/${context.id}/monitoring`);
  revalidatePath(`/kelas/${context.id}/monitoring/${note.studentId}`);
  revalidatePath(`/monitoring`);
  revalidatePath(`/siswa/${note.studentId}`);

  return updated;
}

export async function resolveMonitoringFollowUp(input: ResolveMonitoringFollowUpInput) {
  const validated = resolveMonitoringFollowUpSchema.parse(input);

  const { note, context } = await verifyMonitoringNoteAccess(validated.noteId);

  if (note.isArchived) {
    throw new Error("Catatan yang diarsipkan bersifat read-only");
  }

  if (!note.requiresFollowUp) {
    throw new Error("Catatan ini tidak memiliki status tindak lanjut");
  }

  // Invariant:
  // - If resolved === true -> resolvedAt = now
  // - If resolved === false (Reopen) -> resolvedAt = null, requiresFollowUp remains true
  const updated = await prisma.studentMonitoringNote.update({
    where: { id: note.id },
    data: {
      resolvedAt: validated.resolved === true ? new Date() : null,
    },
  });

  revalidatePath(`/kelas/${context.id}/monitoring`);
  revalidatePath(`/kelas/${context.id}/monitoring/${note.studentId}`);
  revalidatePath(`/monitoring`);
  revalidatePath(`/siswa/${note.studentId}`);

  return updated;
}

export async function archiveMonitoringNote(input: ArchiveMonitoringNoteInput) {
  const validated = archiveMonitoringNoteSchema.parse(input);

  const { note, context } = await verifyMonitoringNoteAccess(validated.noteId);

  const updated = await prisma.studentMonitoringNote.update({
    where: { id: note.id },
    data: {
      isArchived: true,
    },
  });

  revalidatePath(`/kelas/${context.id}/monitoring`);
  revalidatePath(`/kelas/${context.id}/monitoring/${note.studentId}`);
  revalidatePath(`/monitoring`);
  revalidatePath(`/siswa/${note.studentId}`);

  return updated;
}
