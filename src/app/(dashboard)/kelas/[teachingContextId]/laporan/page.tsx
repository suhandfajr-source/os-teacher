import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ReportingClient from "@/app/(dashboard)/laporan/ReportingClient";
import {
  getTeachingJournalReport,
  getAttendanceRecapReport,
  getScoreRecapReport,
  getMonitoringReport,
  getAcademicCoverageReport,
} from "@/modules/reporting/reporting.actions";
import { ReportType } from "@/modules/reporting/reporting.types";
import KelasTabs from "../KelasTabs";

export default async function ContextualReportingPage({
  params,
  searchParams,
}: {
  params: Promise<{ teachingContextId: string }>;
  searchParams: Promise<{
    type?: ReportType;
    startDate?: string;
    endDate?: string;
    studentSearch?: string;
  }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const { teachingContextId } = await params;
  const sParams = await searchParams;

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile || !profile.activeSchoolId) redirect("/onboarding");

  // Fetch teaching contexts for selector
  const contexts = await prisma.teachingContext.findMany({
    where: {
      teacherProfileId: profile.id,
      schoolId: profile.activeSchoolId,
    },
    include: {
      class: true,
      subject: true,
      academicPeriod: true,
    },
    orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
  });

  const formattedContexts = contexts.map((c) => ({
    id: c.id,
    className: c.class.name,
    subjectName: c.subject.name,
    academicPeriodYear: c.academicPeriod.year,
    academicPeriodSemester: c.academicPeriod.semester,
  }));

  const reportType: ReportType = sParams?.type || "JOURNAL";

  let journalData = null;
  let attendanceData = null;
  let scoreData = null;
  let monitoringData = null;
  let coverageData = null;

  try {
    if (reportType === "JOURNAL") {
      journalData = await getTeachingJournalReport(teachingContextId, {
        startDate: sParams?.startDate,
        endDate: sParams?.endDate,
      });
    } else if (reportType === "ATTENDANCE") {
      attendanceData = await getAttendanceRecapReport(teachingContextId, {
        startDate: sParams?.startDate,
        endDate: sParams?.endDate,
        studentSearch: sParams?.studentSearch,
      });
    } else if (reportType === "SCORE") {
      scoreData = await getScoreRecapReport(teachingContextId, {
        studentSearch: sParams?.studentSearch,
      });
    } else if (reportType === "MONITORING") {
      monitoringData = await getMonitoringReport(teachingContextId, {
        studentSearch: sParams?.studentSearch,
      });
    } else if (reportType === "COVERAGE") {
      coverageData = await getAcademicCoverageReport(teachingContextId);
    }
  } catch (err) {
    console.error("Error fetching contextual report:", err);
    redirect(`/kelas/${teachingContextId}`);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      <KelasTabs teachingContextId={teachingContextId} />
      <ReportingClient
        contexts={formattedContexts}
        initialContextId={teachingContextId}
        initialReportType={reportType}
        journalData={journalData}
        attendanceData={attendanceData}
        scoreData={scoreData}
        monitoringData={monitoringData}
        coverageData={coverageData}
      />
    </div>
  );
}
