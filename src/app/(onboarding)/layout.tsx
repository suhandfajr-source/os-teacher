import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { redirect } from "next/navigation";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
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
    <div className="h-full w-full bg-muted/20 flex flex-col items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="w-full max-w-2xl my-auto py-8">
        {children}
      </div>
    </div>
  );
}
