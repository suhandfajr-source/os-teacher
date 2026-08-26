import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (session) {
      const profile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id }
      });
      
      if (profile?.onboardingCompleted) {
        redirect("/");
      } else {
        redirect("/onboarding");
      }
    }
  } catch (err) {
    // If database is not reachable or no session, proceed to render login/register page
    console.warn("AuthLayout session check skipped:", err);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
