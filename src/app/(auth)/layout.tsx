import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { redirect } from "next/navigation";

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
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
