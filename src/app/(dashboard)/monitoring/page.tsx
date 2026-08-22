import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getGlobalMonitoringOverview } from "@/modules/monitoring/monitoring.actions";
import { MonitoringOverviewClient } from "./MonitoringOverviewClient";

export default async function GlobalMonitoringPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile || !profile.activeSchoolId) redirect("/onboarding");

  const overviews = await getGlobalMonitoringOverview();

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Monitoring Siswa</h1>
        <p className="text-muted-foreground mt-1">
          Ringkasan factual status perkembangan dan catatan tindak lanjut per kelas Anda.
        </p>
      </div>

      <MonitoringOverviewClient overviews={overviews} />
    </div>
  );
}
