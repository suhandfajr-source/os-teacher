"use server";

import { prisma } from "@/lib/auth";
import { verifyStudentSession } from "@/modules/student-auth/student-session";

/**
 * Sunset /parent/* — pengayaan Mode Keluarga (migrasi fitur portal ortu):
 * rincian penilaian per mapel + aktivitas belajar per sesi, student-scoped
 * ke rombel periode aktif. Query meniru kontrak getParentContextDetail
 * (parent.service): Assessment COMPLETED + result GRADED untuk finalScore
 * (glosarium nilai FINAL), sesi COMPLETED dengan bukti partisipasi
 * (AttendanceRecord siswa) — Binding Amendment 6.
 */
interface FamilyAssessmentItem {
  id: string;
  title: string;
  category: string;
  date: string; // YYYY-MM-DD
  finalScore: number | null;
  minimumPassingScore: number | null;
  resultStatus: string;
}

interface FamilyActivityItem {
  id: string;
  date: string; // YYYY-MM-DD
  actualTopic: string | null;
  attendanceStatus: string;
}

interface FamilySubjectDetail {
  teachingContextId: string;
  subjectName: string;
  teacherName: string | null;
  assessments: FamilyAssessmentItem[];
  activities: FamilyActivityItem[];
}

/** Aktivitas per mapel dibatasi N terbaru — Mode Keluarga mobile. */
const MAX_ACTIVITIES_PER_SUBJECT = 5;

export async function getStudentFamilyDetailAction(): Promise<{
  success: boolean;
  error?: string;
  subjects?: FamilySubjectDetail[];
}> {
  try {
    const session = await verifyStudentSession();
    if (!session) {
      return { success: false, error: "Sesi tidak valid atau telah berakhir." };
    }

    const student = await prisma.student.findUnique({
      where: { id: session.studentId },
      include: {
        classMemberships: {
          include: { academicPeriod: { select: { status: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const activeMembership = student?.classMemberships.find(
      (cm) => cm.academicPeriod.status === "ACTIVE"
    );

    if (!activeMembership) {
      return { success: true, subjects: [] };
    }

    const contexts = await prisma.teachingContext.findMany({
      where: {
        classId: activeMembership.classId,
        academicPeriodId: activeMembership.academicPeriodId,
      },
      include: {
        subject: { select: { name: true } },
        teacherProfile: { include: { user: { select: { name: true } } } },
      },
      orderBy: { subject: { name: "asc" } },
    });

    const ctxIds = contexts.map((c) => c.id);

    // Penilaian selesai yang melibatkan siswa — finalScore hanya jika GRADED
    const assessments = ctxIds.length
      ? await prisma.assessment.findMany({
          where: {
            teachingContextId: { in: ctxIds },
            status: "COMPLETED",
            results: { some: { studentId: student!.id } },
          },
          include: {
            assessmentType: true,
            results: { where: { studentId: student!.id } },
          },
          orderBy: { assessmentDate: "desc" },
        })
      : [];

    // Sesi selesai yang diikuti siswa (bukti partisipasi: AttendanceRecord)
    const sessions = ctxIds.length
      ? await prisma.teachingSession.findMany({
          where: {
            teachingContextId: { in: ctxIds },
            status: "COMPLETED",
            attendanceRecords: { some: { studentId: student!.id } },
          },
          include: {
            attendanceRecords: { where: { studentId: student!.id } },
          },
          orderBy: { date: "desc" },
        })
      : [];

    return {
      success: true,
      subjects: contexts.map((ctx) => ({
        teachingContextId: ctx.id,
        subjectName: ctx.subject.name,
        teacherName: ctx.teacherProfile.preferredName || ctx.teacherProfile.user.name,
        assessments: assessments
          .filter((a) => a.teachingContextId === ctx.id)
          .map((a) => {
            const res = a.results[0];
            const resultStatus = res?.status ?? "PENDING";
            const finalScore =
              resultStatus === "GRADED" && res?.finalScore ? Number(res.finalScore) : null;
            return {
              id: a.id,
              title: a.title,
              category: a.assessmentType.category,
              date: a.assessmentDate.toISOString().split("T")[0],
              finalScore,
              minimumPassingScore: a.minimumPassingScore ? Number(a.minimumPassingScore) : null,
              resultStatus,
            };
          }),
        activities: sessions
          .filter((s) => s.teachingContextId === ctx.id)
          .slice(0, MAX_ACTIVITIES_PER_SUBJECT)
          .map((s) => ({
            id: s.id,
            date: s.date.toISOString().split("T")[0],
            actualTopic: s.actualTopic,
            attendanceStatus: s.attendanceRecords[0]?.status ?? "PRESENT",
          })),
      })),
    };
  } catch (err) {
    console.error("[getStudentFamilyDetailAction]", err);
    return { success: false, error: "Gagal memuat detail pantauan keluarga." };
  }
}
