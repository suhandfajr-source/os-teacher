import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import RuangMengajarClient, { SessionWithAttendance } from "./RuangMengajarClient";

export default async function KelasDetailPage({
  params,
}: {
  params: Promise<{ teachingContextId: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const { teachingContextId } = await params;

  let authResult;
  try {
    authResult = await verifyTeachingContextAccess(teachingContextId);
  } catch {
    redirect("/kelas");
  }

  const { context } = authResult;

  // 1. Fetch full context info
  const fullContext = await prisma.teachingContext.findUnique({
    where: { id: context.id },
    include: {
      class: true,
      subject: true,
      academicPeriod: true,
    },
  });

  if (!fullContext) redirect("/kelas");

  // 2. Fetch all sessions with attendance
  const rawSessions = await prisma.teachingSession.findMany({
    where: { teachingContextId },
    orderBy: { date: "desc" },
    include: {
      attendanceRecords: {
        select: {
          status: true,
        },
      },
    },
  });

  const sessions: SessionWithAttendance[] = rawSessions.map((s) => ({
    id: s.id,
    status: s.status,
    date: s.date,
    actualTopic: s.actualTopic,
    plannedTopic: s.plannedTopic,
    activitySummary: s.activitySummary,
    attendanceRecordedAt: s.attendanceRecordedAt,
    attendanceRecords: s.attendanceRecords.map((r) => ({
      status: r.status,
    })),
  }));

  // 3. Fetch roster
  const rawRoster = await prisma.classStudent.findMany({
    where: {
      classId: fullContext.classId,
      academicPeriodId: fullContext.academicPeriodId,
      student: {
        status: "ACTIVE",
      },
    },
    include: {
      student: true,
    },
    orderBy: {
      student: { fullName: "asc" },
    },
  });

  const roster = rawRoster.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    student: {
      id: r.student.id,
      fullName: r.student.fullName,
      nis: r.student.nis,
    },
  }));

  // 4. Calculate metrics
  const completedCount = sessions.filter((s) => s.status === "COMPLETED").length;
  const totalSessions = sessions.length;
  const journalFilledCount = sessions.filter(
    (s) => s.actualTopic && s.actualTopic.trim().length > 0
  ).length;

  let totalPresent = 0;
  let totalRecords = 0;
  sessions.forEach((s) => {
    s.attendanceRecords.forEach((r) => {
      totalRecords++;
      if (r.status === "PRESENT" || r.status === "LATE") {
        totalPresent++;
      }
    });
  });

  const avgAttendancePct =
    totalRecords > 0 ? ((totalPresent / totalRecords) * 100).toFixed(1) : "100";

  return (
    <RuangMengajarClient
      teachingContextId={teachingContextId}
      classId={fullContext.classId}
      academicPeriodId={fullContext.academicPeriodId}
      context={{
        className: fullContext.class.name,
        subjectName: fullContext.subject.name,
        academicPeriodYear: fullContext.academicPeriod.year,
        academicPeriodSemester: fullContext.academicPeriod.semester,
      }}
      sessions={sessions}
      roster={roster}
      metrics={{
        completedCount,
        totalSessions,
        avgAttendancePct,
        journalFilledCount,
      }}
    />
  );
}
