import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { redirect } from "next/navigation";
import { KlassaLogo, ModularCockpitArtwork } from "@/components/brand";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

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
    <div className="min-h-screen w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row relative overflow-x-hidden font-sans selection:bg-teal-500 selection:text-white">
      
      {/* ─────────────────────────────────────────────────────────────
          SISI KIRI: FORM & BRANDING (DEKAT DENGAN GARIS GELOMBANG)
      ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 p-6 sm:p-8 lg:p-12 flex flex-col justify-between z-10 bg-white dark:bg-slate-950 min-h-screen">
        
        {/* Top Brand Logo (Aligned with Form) */}
        <div className="w-full max-w-[380px] mx-auto lg:ml-auto lg:mr-8 xl:mr-14 pt-1">
          <Link 
            href="/" 
            className="inline-flex items-center hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] transition-all"
            aria-label="Beranda KLASSA"
          >
            <KlassaLogo variant="horizontal" size="xs" priority />
          </Link>
        </div>

        {/* Form Content Area (Didekatkan ke garis gelombang sisi kanan) */}
        <div className="my-auto py-6 w-full max-w-[380px] mx-auto lg:ml-auto lg:mr-8 xl:mr-14">
          {children}
        </div>

        {/* Bottom Micro Switcher & Copyright (Aligned with Form) */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 w-full max-w-[380px] mx-auto lg:ml-auto lg:mr-8 xl:mr-14 pb-1">
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
          SISI KANAN: S-CURVE WAVE + 3D MODULAR COCKPIT (MENYATU DENGAN BACKGROUND PUTIH)
      ───────────────────────────────────────────────────────────── */}
      <ModularCockpitArtwork theme="teal" portalType="teacher" />

    </div>
  );
}
