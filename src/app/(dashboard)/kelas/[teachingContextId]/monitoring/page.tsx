import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getClassMonitoringData } from "@/modules/monitoring/monitoring.actions";
import { ClassMonitoringClient } from "./ClassMonitoringClient";

export default async function ClassMonitoringPage({
  params,
}: {
  params: Promise<{ teachingContextId: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const { teachingContextId } = await params;

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile || !profile.activeSchoolId) redirect("/onboarding");

  let data;
  try {
    data = await getClassMonitoringData(teachingContextId);
  } catch (error) {
    console.error("Error loading class monitoring data:", error);
    redirect(`/kelas/${teachingContextId}`);
  }

  return <ClassMonitoringClient initialData={data} />;
}
