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
    <div className="min-h-screen w-full bg-white text-slate-900 flex flex-col lg:flex-row relative overflow-x-hidden font-sans selection:bg-teal-500 selection:text-white">
      
      {/* ─────────────────────────────────────────────────────────────
          SISI KIRI: FORM & BRANDING (50% VIEWPORT EDGE-TO-EDGE)
      ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 p-6 sm:p-8 lg:p-12 pb-10 sm:pb-12 lg:pb-12 pl-8 sm:pl-12 lg:pl-16 flex flex-col justify-between z-10 bg-white min-h-screen">
        
        {/* Top Brand Logo */}
        <div>
          <Link href="/" className="inline-flex items-center hover:opacity-90 transition-opacity">
            <KlassaLogo variant="horizontal" size="xs" priority />
          </Link>
        </div>

        {/* Form Content Area */}
        <div className="my-auto py-4 max-w-[360px] w-full">
          {children}
        </div>

        {/* Bottom Micro Switcher & Copyright with Safe Elevation */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>&copy; {new Date().getFullYear()} KLASSA &bull; Naik Kelas Bersama</span>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          SISI KANAN: 50% VIEWPORT S-CURVE WAVE + 3D MODULAR COCKPIT
      ───────────────────────────────────────────────────────────── */}
      <ModularCockpitArtwork theme="teal" portalType="teacher" />

    </div>
  );
}
