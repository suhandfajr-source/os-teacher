import { prisma } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRscAuthContext } from "@/lib/rsc-auth-context";
import HariIniClient from "./HariIniClient";

export default async function HariIniPage() {
  let authContext = null;
  try {
    authContext = await getRscAuthContext();
  } catch {
    redirect("/login");
  }

  const { profile, activeSchoolId } = authContext;

  if (!activeSchoolId) redirect("/onboarding");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [teachingContexts, todaySessions] = await Promise.all([
    prisma.teachingContext.findMany({
      where: {
        teacherProfileId: profile.id,
        schoolId: activeSchoolId,
      },
      include: {
        academicPeriod: true,
        subject: true,
        class: true,
      },
    }),
    prisma.teachingSession.findMany({
      where: {
        teachingContext: {
          teacherProfileId: profile.id,
          schoolId: activeSchoolId,
        },
        date: { gte: today },
      },
      include: {
        teachingContext: {
          include: { subject: true, class: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

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
