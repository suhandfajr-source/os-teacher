import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import HariIniClient from "./HariIniClient";

export default async function HariIniPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile || !profile.activeSchoolId) redirect("/onboarding");

  const teachingContexts = await prisma.teachingContext.findMany({
    where: {
      teacherProfileId: profile.id,
      schoolId: profile.activeSchoolId,
    },
    include: {
      academicPeriod: true,
      subject: true,
      class: true,
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySessions = await prisma.teachingSession.findMany({
    where: {
      teachingContextId: { in: teachingContexts.map((tc) => tc.id) },
      date: { gte: today },
    },
    include: {
      teachingContext: {
        include: { subject: true, class: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hari Ini</h1>
        <p className="text-muted-foreground mt-2">
          Mulai mengajar dan kelola sesi yang sedang berlangsung.
        </p>
      </div>
      <HariIniClient teachingContexts={teachingContexts} todaySessions={todaySessions} />
    </div>
  );
}
