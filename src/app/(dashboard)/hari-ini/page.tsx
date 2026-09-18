import { prisma } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { getTodayScheduleStreamAction } from "@/modules/schedule/schedule.actions";
import { TodayScheduleStream } from "@/components/schedule/TodayScheduleStream";
import HariIniClient from "./HariIniClient";

export default async function HariIniPage() {
  let authContext = null;
  try {
    authContext = await getRscAuthContext();
  } catch {
    redirect("/login");
  }

  const { profile, activeSchoolId, activeSchool } = authContext;

  if (!activeSchoolId) redirect("/onboarding");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [teachingContexts, todaySessions, scheduleStream] = await Promise.all([
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
    getTodayScheduleStreamAction(),
  ]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mengajar Hari Ini</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">
          Pantau linimasa jam mengajar dan buka ruang kelas yang sedang berlangsung.
        </p>
      </div>

      {/* 1. REAL-TIME TODAY SCHEDULE STREAM */}
      <TodayScheduleStream
        initialData={scheduleStream}
        schoolName={activeSchool?.name}
      />

      {/* 2. CLASS SESSION LAUNCHER */}
      <div className="pt-2 border-t">
        <HariIniClient teachingContexts={teachingContexts} todaySessions={todaySessions} />
      </div>
    </div>
  );
}
