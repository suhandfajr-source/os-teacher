import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStudentMonitoringDetail } from "@/modules/monitoring/monitoring.actions";
import { StudentMonitoringDetailClient } from "./StudentMonitoringDetailClient";

export default async function StudentMonitoringDetailPage({
  params,
}: {
  params: Promise<{ teachingContextId: string; studentId: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const { teachingContextId, studentId } = await params;

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile || !profile.activeSchoolId) redirect("/onboarding");

  let data;
  try {
    data = await getStudentMonitoringDetail(teachingContextId, studentId);
  } catch (error) {
    console.error("Error loading student monitoring detail:", error);
    redirect(`/kelas/${teachingContextId}/monitoring`);
  }

  return <StudentMonitoringDetailClient initialData={data} />;
}
