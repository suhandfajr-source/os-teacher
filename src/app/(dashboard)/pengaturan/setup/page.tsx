import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SetupManager from "./SetupManager";

export default async function SetupPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session) redirect("/login");

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      teachingContexts: {
        include: {
          academicPeriod: true,
          subject: true,
          class: true
        }
      }
    }
  });

  if (!profile || !profile.activeSchoolId) redirect("/onboarding");

  const activeSchool = await prisma.school.findUnique({
    where: { id: profile.activeSchoolId },
    include: {
      academicPeriods: true,
      subjects: true,
      classes: true
    }
  });

  if (!activeSchool) redirect("/onboarding");

  if (!profile) redirect("/onboarding");

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan Setup Dasar</h1>
        <p className="text-muted-foreground mt-2">
          Kelola periode akademik, mata pelajaran, kelas, dan relasi mengajarnya.
        </p>
      </div>
      <SetupManager initialProfile={profile as any} activeSchool={activeSchool as any} />
    </div>
  );
}
