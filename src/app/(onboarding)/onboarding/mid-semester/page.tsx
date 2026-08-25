import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import MidSemesterWizard from "./MidSemesterWizard";

export default async function MidSemesterOnboardingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      teachingContexts: {
        include: {
          class: true,
          subject: true,
          academicPeriod: true,
        },
      },
    },
  });

  let activeSchool = null;
  if (profile?.activeSchoolId) {
    activeSchool = await prisma.school.findUnique({
      where: { id: profile.activeSchoolId },
      include: {
        academicPeriods: true,
        subjects: true,
        classes: true,
      },
    });
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <MidSemesterWizard
        profile={profile as never}
        activeSchool={activeSchool as never}
        userEmail={session.user.email}
        userName={session.user.name}
      />
    </div>
  );
}
