import React from 'react';
import Link from 'next/link';
import { prisma } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { BookOpen, Users, Calendar, Sparkles, ArrowRight, Settings } from 'lucide-react';
import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { cn } from "@/lib/utils";
import { getTodayScheduleStreamAction } from "@/modules/schedule/schedule.actions";
import { TodayScheduleStream } from "@/components/schedule/TodayScheduleStream";

export default async function DashboardPage() {
  let authContext = null;
  try {
    authContext = await getRscAuthContext();
  } catch {
    redirect("/login");
  }

  const { session, profile, activeSchoolId, activeSchool } = authContext;

  if (!profile.activeSchoolId) {
    redirect("/onboarding");
  }

  // Fetch teaching contexts, schedule stream and reachable students in parallel
  const [teachingContexts, scheduleStream, reachableStudentsCount] = await Promise.all([
    prisma.teachingContext.findMany({
      where: {
        teacherProfileId: profile.id,
        schoolId: activeSchoolId,
      },
      include: {
        class: true,
        subject: true,
        academicPeriod: true,
      },
      orderBy: [
        { class: { name: "asc" } },
        { subject: { name: "asc" } },
      ],
    }),
    getTodayScheduleStreamAction(),
    prisma.student.count({
      where: {
        schoolId: activeSchoolId,
        status: "ACTIVE",
        classMemberships: {
          some: {
            class: {
              teachingContexts: {
                some: {
                  teacherProfileId: profile.id,
                },
              },
            },
          },
        },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-16">
      {/* 1. GREETING HEADER */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Beranda</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">
          Selamat datang, <span className="font-semibold text-foreground">{session.user.name}</span>. 
          {activeSchool ? ` Anda mengajar di ${activeSchool.name}.` : ""}
        </p>
      </div>

      {/* 2. REAL-TIME TODAY SCHEDULE STREAM (DAILY COMMAND CENTER) */}
      <TodayScheduleStream
        initialData={scheduleStream}
        schoolName={activeSchool?.name}
      />

      {/* 3. REAL STATISTICS CARDS */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-2xs rounded-2xl bg-teal-50/70 border-teal-200/80 hover:bg-teal-50 hover:border-teal-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-teal-800 uppercase tracking-wider">
              Konteks Mengajar
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-2xs">
              <BookOpen className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-slate-900">{teachingContexts.length}</div>
            <p className="text-[11px] text-teal-800/80 font-medium mt-1">
              Kombinasi kelas, mata pelajaran & periode aktif
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs rounded-2xl bg-amber-50/70 border-amber-200/80 hover:bg-amber-50 hover:border-amber-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              Jadwal Hari Ini
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-2xs">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-slate-900">
              {scheduleStream.items.length}{" "}
              <span className="text-xs text-amber-800 font-semibold">Sesi Mengajar</span>
            </div>
            <p className="text-[11px] text-amber-800/80 font-medium mt-1">
              {scheduleStream.items.filter((i) => i.status === "COMPLETED").length} selesai,{" "}
              {scheduleStream.items.filter((i) => i.status === "IN_PROGRESS" || i.status === "TIME_TO_TEACH").length} butuh perhatian
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs rounded-2xl bg-indigo-50/70 border-indigo-200/80 hover:bg-indigo-50 hover:border-indigo-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-indigo-800 uppercase tracking-wider">
              Siswa Terdaftar
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-slate-900">{reachableStudentsCount}</div>
            <p className="text-[11px] text-indigo-800/80 font-medium mt-1">
              Siswa aktif pada kelas yang Anda ampu
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 4. ACTION / NEXT STEPS HUB */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col justify-between shadow-2xs rounded-2xl bg-white border-slate-200/80 hover:border-teal-300 hover:shadow-xs transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <Calendar className="h-4 w-4 text-teal-700" />
              Sesi Mengajar & Presensi
            </CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Mulai sesi pembelajaran hari ini, catat presensi siswa, dan buat catatan jurnal mengajar.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link
              href="/hari-ini"
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-full sm:w-auto text-xs font-semibold rounded-xl bg-teal-700 hover:bg-teal-800 text-white")}
            >
              Buka Menu Hari Ini
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between shadow-2xs rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-teal-50/50 border-indigo-200/80 hover:border-indigo-300 hover:shadow-xs transition-all">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base text-slate-900">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                AI Content Studio
              </CardTitle>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                Co-Pilot
              </span>
            </div>
            <CardDescription className="text-xs text-slate-600">
              Buat draf materi, rencana aktivitas, instruksi tugas, dan rubrik pembelajaran dengan bantuan AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link
              href="/ai-studio"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "w-full sm:w-auto text-xs font-semibold rounded-xl text-indigo-700 border-indigo-200 bg-white hover:bg-indigo-50"
              )}
            >
              Buka AI Studio
              <ArrowRight className="h-3.5 w-3.5 ml-1.5 text-indigo-600" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* 5. QUICK CLASS NAVIGATOR */}
      <Card className="shadow-2xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Daftar Kelas Diampu</CardTitle>
              <CardDescription className="text-xs">
                Akses cepat ke detail kelas, lembar penilaian, presensi, dan pengelolaan siswa.
              </CardDescription>
            </div>
            <Link
              href="/kelas"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>Semua Kelas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {teachingContexts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground space-y-3">
              <p className="text-xs">Belum ada kelas atau mata pelajaran yang diatur.</p>
              <Link
                href="/pengaturan/setup"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs font-semibold")}
              >
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Atur Kelas di Pengaturan
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teachingContexts.map((tc) => (
                <Link
                  key={tc.id}
                  href={`/kelas/${tc.id}`}
                  className="p-4 rounded-xl border bg-card hover:border-primary transition-all duration-150 flex flex-col justify-between hover:shadow-xs group"
                >
                  <div>
                    <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                      {tc.subject.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{tc.class.name}</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-3 pt-2 border-t flex items-center justify-between">
                    <span>{tc.academicPeriod.semester} {tc.academicPeriod.year}</span>
                    <span className="text-primary font-semibold flex items-center">
                      Masuk Kelas &rarr;
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
