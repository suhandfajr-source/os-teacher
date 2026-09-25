import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { isCurrentPlatformAdmin } from "@/lib/superadmin";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles } from "lucide-react";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  // Single-Admin Lane I4 — superadmin tidak pernah disodori wizard guru.
  if (await isCurrentPlatformAdmin()) {
    redirect("/admin");
  }

  let authContext = null;

  try {
    authContext = await getRscAuthContext();
  } catch {
    authContext = null;
  }

  // If already fully onboarded with active school, send to dashboard
  if (authContext && authContext.profile?.onboardingCompleted && authContext.activeSchoolId) {
    redirect("/");
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-slate-100 to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col items-center justify-between p-4 sm:p-6 overflow-y-auto font-sans relative">
      {/* Subtle Ambient Glowing Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-80 bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-indigo-500/10 dark:from-teal-500/20 dark:via-emerald-500/15 dark:to-indigo-500/20 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-10 w-96 h-96 bg-teal-500/5 dark:bg-teal-500/10 blur-3xl pointer-events-none rounded-full" />

      {/* Top Navbar Header */}
      <header className="w-full max-w-2xl flex items-center justify-between py-2 z-10">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              KLASSA
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
                Pendidik
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Asisten Manajemen Pembelajaran Cerdas</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Form Container */}
      <main className="w-full max-w-2xl z-10 my-auto py-6">
        {children}
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-2xl text-center py-3 z-10 text-[11px] text-slate-400 dark:text-slate-500">
        Platform Guru Terpadu · Data tersimpan aman dan terenkripsi
      </footer>
    </div>
  );
}
