import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireSuperAdmin } from "@/lib/superadmin";

/**
 * Story 5 — Layout area backstop superadmin `/admin/*` (F3).
 * Route group TOP-LEVEL terpisah dari (dashboard): superadmin tidak punya
 * TeacherProfile/activeSchoolId — menest di (dashboard) akan ter-redirect
 * ke /onboarding. Validasi nyata server-side via requireSuperAdmin();
 * percobaan akses non-admin ter-audit dengan dedup 60 detik (OQ-7/G-9).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireSuperAdmin();
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            KLASSA Admin — Backstop Platform
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="hover:text-emerald-400 transition-colors">
              Konsol
            </Link>
            <Link href="/admin/audit" className="hover:text-emerald-400 transition-colors">
              AuditLog
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      <footer className="max-w-6xl mx-auto px-4 py-6 text-xs text-slate-500">
        Setiap aksi tercatat di AuditLog. Backstop platform-level — bukan gerbang harian.
      </footer>
    </div>
  );
}
