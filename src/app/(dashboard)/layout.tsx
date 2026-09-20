import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { redirect } from "next/navigation";
import { getRscAuthContext } from "@/lib/rsc-auth-context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let authContext = null;
  try {
    authContext = await getRscAuthContext();
  } catch {
    redirect("/login");
  }

  if (!authContext?.profile?.onboardingCompleted || !authContext?.activeSchoolId) {
    redirect("/onboarding");
  }

  return (
    <div className="h-full w-full bg-[#EBF1F6] bg-ambient-pattern flex items-center justify-center p-0 md:p-3 lg:p-4 overflow-hidden">
      {/* Floating Main Shell Container */}
      <div className="w-full max-w-[1520px] h-full md:h-[calc(100vh-1.5rem)] lg:h-[calc(100vh-2rem)] bg-white rounded-none md:rounded-3xl lg:rounded-4xl md:shadow-shell md:border md:border-white/80 flex flex-col md:flex-row overflow-hidden pb-[60px] md:pb-0 relative">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden bg-[#F4F7F6] md:m-2.5 md:rounded-2xl lg:rounded-3xl md:border md:border-slate-200/60">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-7">
            {children}
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
