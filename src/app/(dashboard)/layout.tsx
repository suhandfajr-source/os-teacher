import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/auth"; // using the prisma client

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let session = null;
  try {
    session = await auth.api.getSession({
      headers: await headers()
    });
  } catch (err) {
    console.warn("Session check error, treating as unauthenticated:", err);
    session = null;
  }

  if (!session) {
    redirect("/login");
  }

  let profile = null;
  try {
    // Check onboarding status
    profile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id }
    });
  } catch (err) {
    console.warn("Profile lookup warning:", err);
  }

  if (!profile?.onboardingCompleted) {
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
