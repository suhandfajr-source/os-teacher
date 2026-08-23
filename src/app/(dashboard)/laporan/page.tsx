import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ReportingClient from "./ReportingClient";
import {
  getTeachingJournalReport,
  getAttendanceRecapReport,
  getScoreRecapReport,
  getMonitoringReport,
  getAcademicCoverageReport,
} from "@/modules/reporting/reporting.actions";
import { ReportType } from "@/modules/reporting/reporting.types";

export default async function ReportingPage({
  searchParams,
}: {
  searchParams: Promise<{
    contextId?: string;
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

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile || !profile.activeSchoolId) redirect("/onboarding");

  // Fetch teaching contexts owned by this teacher in the active school
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

  const params = await searchParams;
  let activeContextId = params?.contextId;
  if (!activeContextId && formattedContexts.length > 0) {
    activeContextId = formattedContexts[0].id;
  }

  const reportType: ReportType = params?.type || "JOURNAL";

  let journalData = null;
  let attendanceData = null;
  let scoreData = null;
  let monitoringData = null;
  let coverageData = null;

  if (activeContextId) {
    try {
      if (reportType === "JOURNAL") {
        journalData = await getTeachingJournalReport(activeContextId, {
          startDate: params?.startDate,
          endDate: params?.endDate,
        });
      } else if (reportType === "ATTENDANCE") {
        attendanceData = await getAttendanceRecapReport(activeContextId, {
          startDate: params?.startDate,
          endDate: params?.endDate,
          studentSearch: params?.studentSearch,
        });
      } else if (reportType === "SCORE") {
        scoreData = await getScoreRecapReport(activeContextId, {
          studentSearch: params?.studentSearch,
        });
      } else if (reportType === "MONITORING") {
        monitoringData = await getMonitoringReport(activeContextId, {
          studentSearch: params?.studentSearch,
        });
      } else if (reportType === "COVERAGE") {
        coverageData = await getAcademicCoverageReport(activeContextId);
      }
    } catch (err) {
      console.error("Error fetching report data:", err);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      <ReportingClient
        contexts={formattedContexts}
        initialContextId={activeContextId}
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
