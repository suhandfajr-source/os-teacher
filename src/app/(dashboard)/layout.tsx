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

  if (!authContext?.profile?.onboardingCompleted) {
    redirect("/onboarding");
  }

  return (
    <>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden pb-[60px] md:pb-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/20">
          {children}
        </main>
      </div>
      <BottomNav />
    </>
  );
}
