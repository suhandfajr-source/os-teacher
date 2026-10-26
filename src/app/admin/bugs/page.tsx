import { requireSuperAdmin } from "@/lib/superadmin";
import { listBugReports } from "@/modules/bug-reports/bug-report.service";
import { AdminBugTicketsClient } from "./AdminBugTicketsClient";

export const dynamic = "force-dynamic";

export default async function AdminBugsPage() {
  await requireSuperAdmin();
  const initialData = await listBugReports({ limit: 50 });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Daftar Tiket Kendala & Bug Pengguna</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pantau dan kelola tiket masalah yang dilaporkan pengguna langsung dari aplikasi.
          </p>
        </div>
      </div>

      <AdminBugTicketsClient initialData={initialData} />
    </div>
  );
}
