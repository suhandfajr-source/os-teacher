import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { AccountBannedBanner } from "@/components/AccountBannedBanner";
import { FloatingAgentLauncher } from "@/components/agent/FloatingAgentLauncher";
import { redirect } from "next/navigation";
import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { isCurrentPlatformAdmin } from "@/lib/superadmin";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Single-Admin Lane I4 — superadmin tidak pernah masuk jalur guru.
  if (await isCurrentPlatformAdmin()) {
    redirect("/admin");
  }

  let authContext = null;
  try {
    authContext = await getRscAuthContext();
  } catch {
    redirect("/login");
  }

  if (!authContext?.profile?.onboardingCompleted || !authContext?.activeSchoolId) {
    redirect("/onboarding");
  }

  const isBanned = authContext.isBanned;
  const banReason = authContext.banReason;

  return (
    <div className="h-full w-full bg-[#F4F7F6] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden transition-colors">
      {/* Full-Screen Main Shell */}
      <div className="w-full h-full flex flex-col md:flex-row overflow-hidden pb-[60px] md:pb-0 relative">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <Topbar />
          {isBanned && <AccountBannedBanner banReason={banReason} />}
          <main
            className={`flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 ${
              isBanned ? "pointer-events-none select-none opacity-85" : ""
            }`}
          >
            {children}
          </main>
        </div>
      </div>
      <FloatingAgentLauncher />
      <BottomNav />
    </div>
  );
}
