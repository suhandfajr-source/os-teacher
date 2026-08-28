import { redirect } from "next/navigation";
import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { getGlobalMonitoringOverview } from "@/modules/monitoring/monitoring.actions";
import { MonitoringOverviewClient } from "./MonitoringOverviewClient";

export default async function GlobalMonitoringPage() {
  let authContext = null;
  try {
    authContext = await getRscAuthContext();
  } catch {
    redirect("/login");
  }

  const { activeSchoolId } = authContext;

  if (!activeSchoolId) redirect("/onboarding");

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
