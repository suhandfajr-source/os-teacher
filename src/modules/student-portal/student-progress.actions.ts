"use server";

/**
 * Story 7 (CAP-9) — Actions Student Progress untuk portal siswa.
 * Seluruh identitas di-derive dari verifyStudentSession() (Amendum B1);
 * semua query di-scope ke periode aktif rombel (§9.4).
 *
 * Satu core loader bersama (batched, tanpa N+1) melayani halaman Nilai
 * dan widget beranda — dua action tipis di atasnya agar tidak berdrift.
 */
import { prisma } from "@/lib/auth";
import { verifyStudentSession } from "@/modules/student-auth/student-session";
import type { PolicyItemSnapshot } from "@/modules/assessment/assessment.service";
import {
  buildSubjectProgress,
  buildSubjectSummary,
  summarizeMonthlyAttendance,
  type AssessmentForProgress,
  type AssessmentStatusLite,
  type LearningObjectiveForProgress,
  type MonthlyAttendanceRecap,
  type ResultStatusLite,
  type SubjectProgress,
  type SubjectProgressSummary,
} from "./student-progress.service";

export interface StudentProgressPageData {
  hasActivePeriod: boolean;
  student: { fullName: string; className: string; academicYear: string };
  subjects: SubjectProgress[];
  attendance: MonthlyAttendanceRecap[];
}

export interface StudentProgressWidgetData {
  hasActivePeriod: boolean;
  subjects: SubjectProgressSummary[];
}

const GENERIC_ERROR = "Gagal memuat data. Silakan coba beberapa saat lagi.";

/** Resolusi membership rombel prioritas periode aktif (pola student-portal.actions). */
async function resolveActiveMembership(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      classMemberships: {
        include: {
          class: { select: { name: true, gradeLevel: true } },
          academicPeriod: { select: { id: true, year: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!student) return null;

  const activeMembership =
    student.classMemberships.find((cm) => cm.academicPeriod.status === "ACTIVE") ??
    student.classMemberships[0] ??
    null;

  return { student, activeMembership };
}

interface ProgressCoreResult {
  hasActivePeriod: boolean;
  student: { fullName: string; className: string; academicYear: string };
  subjects: SubjectProgress[];
  attendance: MonthlyAttendanceRecap[];
}

/**
 * Core loader: semua query batched per-tabel (gradePolicy, assessment,
 * learningObjective) — tidak ada N+1 per teaching context.
 */
async function loadProgressCore(
  studentId: string,
  options: { includeAttendance: boolean }
): Promise<ProgressCoreResult> {
  const resolved = await resolveActiveMembership(studentId);
  if (!resolved) throw new Error("STUDENT_NOT_FOUND");

  const { student, activeMembership } = resolved;
  if (!activeMembership || activeMembership.academicPeriod.status !== "ACTIVE") {
    return {
      hasActivePeriod: false,
      student: { fullName: student.fullName, className: "Belum Ada Rombel", academicYear: "-" },
      subjects: [],
      attendance: [],
    };
  }

  const classId = activeMembership.classId;
  const academicPeriodId = activeMembership.academicPeriodId;

  const contexts = await prisma.teachingContext.findMany({
    where: { classId, academicPeriodId },
    include: {
      subject: { select: { name: true } },
      teacherProfile: { include: { user: { select: { name: true } } } },
    },
    orderBy: { subject: { name: "asc" } },
  });
  const contextIds = contexts.map((c) => c.id);

  // Batched — tiga query di bawah melayani semua mapel sekaligus
  const [policies, assessments, learningObjectives, attendanceRecords] = await Promise.all([
    prisma.gradePolicy.findMany({
      where: { teachingContextId: { in: contextIds }, status: "ACTIVE" },
      include: { items: { include: { assessmentType: true }, orderBy: { sortOrder: "asc" } } },
    }),
    // Hanya assessment COMPLETED yang bisa FINAL — filter pertama (laporan ganda
    // tetap ditegakkan di service via isFinalScore). orderBy deterministik:
    // snapshot LO diambil dari link penilaian TERBARU.
    prisma.assessment.findMany({
      where: { teachingContextId: { in: contextIds }, status: "COMPLETED" },
      orderBy: [{ assessmentDate: "desc" }, { createdAt: "desc" }],
      include: {
        assessmentType: { select: { id: true, name: true } },
        learningObjectiveLinks: {
          select: { learningObjectiveId: true, snapshotCode: true, snapshotDescription: true },
        },
        results: {
          where: { studentId },
          select: { status: true, finalScore: true, remedialAttempts: { select: { score: true } } },
        },
      },
    }),
    prisma.learningObjective.findMany({
      where: { teachingContextId: { in: contextIds } },
      orderBy: { orderIndex: "asc" },
    }),
    options.includeAttendance
      ? prisma.attendanceRecord.findMany({
          where: {
            studentId,
            teachingSession: { teachingContext: { classId, academicPeriodId } },
          },
          include: { teachingSession: { select: { date: true } } },
        })
      : Promise.resolve([]),
  ]);

  const policyByContext = new Map(policies.map((p) => [p.teachingContextId, p]));
  const assessmentsByContext = new Map<string, typeof assessments>();
  for (const a of assessments) {
    const list = assessmentsByContext.get(a.teachingContextId) ?? [];
    list.push(a);
    assessmentsByContext.set(a.teachingContextId, list);
  }
  const losByContext = new Map<string, typeof learningObjectives>();
  for (const lo of learningObjectives) {
    const list = losByContext.get(lo.teachingContextId) ?? [];
    list.push(lo);
    losByContext.set(lo.teachingContextId, list);
  }

  const subjects: SubjectProgress[] = contexts.map((tc) => {
    const ctxAssessments = assessmentsByContext.get(tc.id) ?? [];
    const ctxLos = losByContext.get(tc.id) ?? [];
    const policy = policyByContext.get(tc.id);
    const policyItems: PolicyItemSnapshot[] = policy
      ? policy.items.map((item) => ({
          assessmentTypeId: item.assessmentTypeId,
          assessmentTypeName: item.assessmentType.name,
          category: item.assessmentType.category,
          weight: item.weight,
        }))
      : [];

    // Snapshot fallback per LO: assessment terurut terbaru-dulu → link pertama
    // yang ditemui adalah snapshot TERBARU (deterministik).
    const snapshotByLo = new Map<string, { code: string | null; description: string | null }>();
    for (const a of ctxAssessments) {
      for (const link of a.learningObjectiveLinks) {
        if (!snapshotByLo.has(link.learningObjectiveId)) {
          snapshotByLo.set(link.learningObjectiveId, {
            code: link.snapshotCode,
            description: link.snapshotDescription,
          });
        }
      }
    }

    const assessmentsForProgress: AssessmentForProgress[] = ctxAssessments.map((a) => {
      const result = a.results[0] ?? null;
      return {
        id: a.id,
        title: a.title,
        assessmentTypeId: a.assessmentType.id,
        assessmentTypeName: a.assessmentType.name,
        assessmentStatus: a.status as AssessmentStatusLite,
        assessmentDate: new Date(a.assessmentDate),
        maxScore: Number(a.maxScore),
        minimumPassingScore: a.minimumPassingScore !== null ? Number(a.minimumPassingScore) : null,
        resultStatus: result ? (result.status as ResultStatusLite) : null,
        finalScore: result?.finalScore !== null && result?.finalScore !== undefined ? Number(result.finalScore) : null,
        remedialScores: result ? result.remedialAttempts.map((r) => Number(r.score)) : [],
        learningObjectiveIds: a.learningObjectiveLinks.map((l) => l.learningObjectiveId),
      };
    });

    const losForProgress: LearningObjectiveForProgress[] = ctxLos.map((lo) => {
      const snapshot = snapshotByLo.get(lo.id);
      return {
        id: lo.id,
        code: lo.code,
        description: lo.description,
        orderIndex: lo.orderIndex,
        status: lo.status,
        fallbackCode: snapshot?.code ?? null,
        fallbackDescription: snapshot?.description ?? null,
      };
    });

    return buildSubjectProgress({
      teachingContextId: tc.id,
      subjectName: tc.subject.name,
      teacherName: tc.teacherProfile?.user?.name ?? null,
      policyActive: policyItems.length > 0,
      policyItems,
      assessments: assessmentsForProgress,
      learningObjectives: losForProgress,
    });
  });

  return {
    hasActivePeriod: true,
    student: {
      fullName: student.fullName,
      className: `${activeMembership.class.name} (${activeMembership.class.gradeLevel || "Kelas"})`,
      academicYear: activeMembership.academicPeriod.year,
    },
    subjects,
    attendance: options.includeAttendance
      ? summarizeMonthlyAttendance(
          attendanceRecords.map((r) => ({
            status: r.status,
            date: new Date(r.teachingSession.date),
          }))
        )
      : [],
  };
}

/** Data lengkap halaman Nilai: pohon ketuntasan + nilai berjalan + presensi. */
export async function getStudentProgressDataAction(): Promise<{
  success: boolean;
  data?: StudentProgressPageData;
  error?: string;
}> {
  try {
    const session = await verifyStudentSession();
    if (!session) {
      return { success: false, error: "Sesi tidak valid atau telah berakhir." };
    }
    const core = await loadProgressCore(session.studentId, { includeAttendance: true });
    return { success: true, data: core };
  } catch (err: unknown) {
    // Detail error hanya untuk log server — pesan ke siswa selalu generik
    console.error("[student-progress] getStudentProgressDataAction:", err);
    return { success: false, error: GENERIC_ERROR };
  }
}

/** Widget ketuntasan ringkas untuk beranda (2.4) — tanpa presensi. */
export async function getStudentProgressWidgetAction(): Promise<{
  success: boolean;
  data?: StudentProgressWidgetData;
  error?: string;
}> {
  try {
    const session = await verifyStudentSession();
    if (!session) {
      return { success: false, error: "Sesi tidak valid atau telah berakhir." };
    }
    const core = await loadProgressCore(session.studentId, { includeAttendance: false });
    return {
      success: true,
      data: {
        hasActivePeriod: core.hasActivePeriod,
        subjects: core.subjects.map((s) => buildSubjectSummary(s)),
      },
    };
  } catch (err: unknown) {
    console.error("[student-progress] getStudentProgressWidgetAction:", err);
    return { success: false, error: GENERIC_ERROR };
  }
}
