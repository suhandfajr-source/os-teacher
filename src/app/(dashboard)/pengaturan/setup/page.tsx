import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SetupManager from "./SetupManager";

export default async function SetupPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      teachingContexts: {
        include: {
          academicPeriod: true,
          subject: true,
          class: true,
        },
      },
      memberships: {
        where: { status: "ACTIVE" },
        include: {
          school: true,
        },
      },
    },
  });

  if (!profile || !profile.activeSchoolId) redirect("/onboarding");

  const activeSchool = await prisma.school.findUnique({
    where: { id: profile.activeSchoolId },
    include: {
      academicPeriods: true,
      subjects: true,
      classes: true,
    },
  });

  if (!activeSchool) redirect("/onboarding");

  // Ambil daftar seluruh guru di sekolah aktif ini (Panel Guru Sekolah - CAP-3)
  const schoolTeachers = await prisma.teacherSchoolMembership.findMany({
    where: { schoolId: activeSchool.id },
    include: {
      teacherProfile: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
    },
    orderBy: [{ workspaceRole: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan Setup Dasar</h1>
        <p className="text-muted-foreground mt-2">
          Kelola periode akademik, mata pelajaran, kelas, rekan guru sekolah, dan saklar sekolah aktif.
        </p>
      </div>
      <SetupManager
        initialProfile={profile as never}
        activeSchool={activeSchool as never}
        schoolTeachers={schoolTeachers as never}
      />
    </div>
  );
}
