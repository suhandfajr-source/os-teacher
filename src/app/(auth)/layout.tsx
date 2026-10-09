import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { redirect } from "next/navigation";
import { KlassaLogo, ModularCockpitArtwork } from "@/components/brand";
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
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-teal-50/40 to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/20 animate-gradient-pan text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row relative overflow-x-hidden font-sans selection:bg-teal-500 selection:text-white">
      
      {/* Dynamic Animated Ambient Background Blobs (Shift, Float, Orbit) */}
      <div className="absolute -top-28 -left-28 w-[420px] h-[420px] bg-teal-300/25 dark:bg-teal-800/15 rounded-full blur-3xl pointer-events-none animate-mesh-shift" />
      <div className="absolute top-1/3 -left-16 w-80 h-80 bg-emerald-300/20 dark:bg-emerald-800/15 rounded-full blur-3xl pointer-events-none animate-mesh-shift-reverse" />
      <div className="absolute -bottom-24 left-1/4 w-[460px] h-[460px] bg-cyan-300/20 dark:bg-cyan-800/15 rounded-full blur-3xl pointer-events-none animate-mesh-shift" />

      {/* ─────────────────────────────────────────────────────────────
          SISI KIRI: FORM & BRANDING (PADA PC) / FULL-SCREEN UNIFIED (MOBILE)
      ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 p-6 sm:p-10 lg:p-12 xl:p-16 flex flex-col justify-between z-10 bg-transparent min-h-screen relative">
        
        {/* Top Brand Logo */}
        <div className="w-full max-w-[380px] mx-auto lg:mr-auto lg:ml-auto pt-2">
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

        {/* Form Content Area (Centering with max-w-[380px] to avoid edge crowd) */}
        <div className="my-auto py-5 w-full max-w-[380px] mx-auto lg:mr-auto lg:ml-auto">
          {children}
        </div>

        {/* Bottom Micro Switcher & Copyright (Aligned with Form) */}
        <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 w-full max-w-[380px] mx-auto lg:mr-auto lg:ml-auto pb-2">
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
          SISI KANAN: S-CURVE WAVE + 3D MODULAR COCKPIT (DESKTOP SAJA)
      ───────────────────────────────────────────────────────────── */}
      <ModularCockpitArtwork theme="teal" portalType="teacher" className="hidden lg:flex" />

    </div>
  );
}
