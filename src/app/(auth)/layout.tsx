import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { redirect } from "next/navigation";
import { KlassaLogo, AtomicEcosystemHero } from "@/components/brand";
import Link from "next/link";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  let authContext = null;

  try {
    authContext = await getRscAuthContext();
  } catch {
    authContext = null;
  }

  // Only redirect away from login if the teacher is fully authenticated and active
  if (authContext) {
    if (authContext.profile?.onboardingCompleted && authContext.activeSchoolId) {
      redirect("/");
    } else {
      redirect("/onboarding");
    }
  }

  return (
    <div className="min-h-svh lg:h-svh w-full bg-gradient-to-br from-slate-50 via-teal-50/40 to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/20 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row relative overflow-x-clip font-sans selection:bg-teal-500 selection:text-white">
      
      {/* Dynamic Animated Ambient Background Blobs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 -left-28 w-[420px] h-[420px] bg-teal-300/25 dark:bg-teal-800/15 rounded-full blur-3xl animate-mesh-shift" />
        <div className="absolute top-1/3 -left-16 w-80 h-80 bg-emerald-300/20 dark:bg-emerald-800/15 rounded-full blur-3xl animate-mesh-shift-reverse" />
        <div className="absolute -bottom-24 left-1/4 w-[460px] h-[460px] bg-cyan-300/20 dark:bg-cyan-800/15 rounded-full blur-3xl animate-mesh-shift" />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SISI KIRI: FORM & BRANDING (FULLSCREEN, CLEAN NO OVERFLOW)
      ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 p-6 sm:p-8 lg:p-10 flex flex-col justify-between z-10 bg-transparent min-h-svh lg:min-h-0 lg:h-full relative overflow-y-auto">
        
        {/* Top Brand Logo */}
        <div className="w-full max-w-[400px] mx-auto pt-1">
          <div className="flex items-center justify-between">
            <Link 
              href="/" 
              className="inline-flex items-center hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] transition-all"
              aria-label="Beranda KLASSA"
            >
              <KlassaLogo variant="horizontal" size="xs" priority />
            </Link>

            {/* Quick Badge Portal di Mobile */}
            <span className="lg:hidden text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-teal-50/90 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-300 border border-teal-200/60 shadow-xs">
              Guru
            </span>
          </div>
        </div>

        {/* Form Content Area */}
        <div className="my-auto py-4 w-full max-w-[400px] mx-auto">
          {children}
        </div>

        {/* Bottom Micro Switcher & Copyright */}
        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 w-full max-w-[400px] mx-auto pb-1">
          <span>&copy; {new Date().getFullYear()} KLASSA &bull; Guru</span>
          <Link
            href="/portal-siswa"
            className="font-bold text-[#0F766E] dark:text-teal-400 hover:underline"
          >
            Masuk Portal Siswa &rarr;
          </Link>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          SISI KANAN: KLASSA ATOMIC ECOSYSTEM HERO (DESKTOP)
      ───────────────────────────────────────────────────────────── */}
      <AtomicEcosystemHero className="hidden lg:flex" />

    </div>
  );
}
