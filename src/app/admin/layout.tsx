import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, FileText, ArrowLeft } from "lucide-react";
import { requireSuperAdmin } from "@/lib/superadmin";
import { prisma } from "@/lib/auth";
import { KlassaLogo } from "@/components/brand";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

/**
 * Story 5 + Superadmin PC Desktop Redesign (CAP-ADM-01).
 * Layout full-width responsive desktop shell untuk area backstop superadmin `/admin/*`.
 * Mendukung Dark Mode & Light Mode dengan standar tema Modern Edu-Teal KLASSA.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let userEmail = "Superadmin";
  try {
    const admin = await requireSuperAdmin();
    const u = await prisma.user.findUnique({
      where: { id: admin.userId },
      select: { email: true },
    });
    if (u?.email) userEmail = u.email;
  } catch {
    redirect("/login");
  }

  return (
    <div className="w-full min-h-screen bg-[#F6F8F8] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white flex-1 overflow-x-hidden transition-colors duration-200">
      {/* Topbar Global Desktop */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md transition-colors">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-3 group">
              <KlassaLogo variant="horizontal" size="xs" priority />
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/60 shadow-xs">
                SUPERADMIN
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-3 py-1.5 rounded-full font-medium">
              <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
              <span>Login: <strong className="text-slate-900 dark:text-slate-200 font-semibold">{userEmail}</strong></span>
            </div>

            {/* Theme Toggle Button (Light / Dark Mode) */}
            <ThemeToggle />

            <Link
              href="/admin/audit"
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/60 bg-teal-50/50 dark:bg-slate-900 border border-teal-200/60 dark:border-slate-800 transition-colors flex items-center gap-1.5"
            >
              <FileText className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              AuditLog
            </Link>

            <Link
              href="/"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100/80 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-900 border border-slate-200/80 dark:border-slate-800 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali ke Aplikasi
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area: 100% Full Width PC Desktop */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 px-6 py-4 text-xs text-slate-500 transition-colors flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-500" />
          <span>Setiap mutasi terekam permanen di AuditLog platform.</span>
        </div>
        <div>
          <span>KLASSA Education Engine · Superadmin Lane</span>
        </div>
      </footer>
    </div>
  );
}
