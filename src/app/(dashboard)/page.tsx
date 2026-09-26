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
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Beranda</h1>
        <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm mt-1">
          Selamat datang, <span className="font-bold text-slate-900 dark:text-white">{session.user.name}</span>. 
          {activeSchool ? ` Anda mengajar di ${activeSchool.name}.` : ""}
        </p>
      </div>

      {/* 2. REAL-TIME TODAY SCHEDULE STREAM (DAILY COMMAND CENTER) */}
      <TodayScheduleStream
        initialData={scheduleStream}
        schoolName={activeSchool?.name}
      />

      {/* 3. REAL STATISTICS CARDS */}
      <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 pt-3">
        {/* Stat 1: Konteks Mengajar */}
        <div className="bg-white rounded-3xl p-6 pt-8 shadow-squircle-card hover:shadow-squircle-card-hover border border-slate-100/90 relative flex flex-col justify-between transition-all">
          <div className="absolute -top-4 left-6 w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 text-white flex items-center justify-center shadow-floating-badge">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
              Konteks Mengajar
            </span>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">{teachingContexts.length}</div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Kombinasi kelas, mata pelajaran & periode aktif
            </p>
          </div>
        </div>

        {/* Stat 2: Jadwal Hari Ini */}
        <div className="bg-white rounded-3xl p-6 pt-8 shadow-squircle-card hover:shadow-squircle-card-hover border border-slate-100/90 relative flex flex-col justify-between transition-all">
          <div className="absolute -top-4 left-6 w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-floating-badge">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Jadwal Hari Ini
            </span>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">
              {scheduleStream.items.length}{" "}
              <span className="text-xs text-amber-800 font-semibold">Sesi</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {scheduleStream.items.filter((i) => i.status === "COMPLETED").length} selesai,{" "}
              {scheduleStream.items.filter((i) => i.status === "IN_PROGRESS" || i.status === "TIME_TO_TEACH").length} butuh perhatian
            </p>
          </div>
        </div>

        {/* Stat 3: Siswa Terdaftar */}
        <div className="bg-white rounded-3xl p-6 pt-8 shadow-squircle-card hover:shadow-squircle-card-hover border border-slate-100/90 relative flex flex-col justify-between transition-all sm:col-span-2 lg:col-span-1">
          <div className="absolute -top-4 left-6 w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-400 text-white flex items-center justify-center shadow-floating-badge">
            <Users className="h-5 w-5" />
          </div>
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">
              Siswa Terdaftar
            </span>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">{reachableStudentsCount}</div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Siswa aktif pada kelas yang Anda ampu
            </p>
          </div>
        </div>
      </div>

      {/* 4. ACTION / NEXT STEPS HUB */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="bg-white rounded-3xl p-6 shadow-squircle-card hover:shadow-squircle-card-hover border border-slate-100 flex flex-col justify-between transition-all">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 font-bold text-base text-slate-900">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Calendar className="h-4 w-4" />
              </div>
              <span>Sesi Mengajar & Presensi</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Mulai sesi pembelajaran hari ini, catat presensi siswa, dan buat catatan jurnal mengajar dengan cepat.
            </p>
          </div>
          <div className="pt-4">
            <Link
              href="/hari-ini"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shadow-pill-glow transition-all"
            >
              <span>Buka Menu Hari Ini</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50/80 via-white to-teal-50/40 rounded-3xl p-6 shadow-squircle-card hover:shadow-squircle-card-hover border border-indigo-100 flex flex-col justify-between transition-all">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 font-bold text-base text-indigo-950">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span>AI Content Studio</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                Co-Pilot
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Buat draf materi, rencana aktivitas, instruksi tugas, dan rubrik pembelajaran Kurikulum Merdeka otomatis.
            </p>
          </div>
          <div className="pt-4">
            <Link
              href="/ai-studio"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all"
            >
              <span>Buka AI Studio</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 5. QUICK CLASS NAVIGATOR */}
      <div className="bg-white rounded-3xl p-6 shadow-squircle-card border border-slate-100/90 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Daftar Kelas Diampu</h2>
            <p className="text-xs text-slate-500">
              Akses cepat ke detail kelas, lembar penilaian, presensi, dan pengelolaan siswa.
            </p>
          </div>
          <Link
            href="/kelas"
            className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 bg-teal-50 px-3 py-1.5 rounded-full border border-teal-100"
          >
            <span>Semua Kelas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div>
          {teachingContexts.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-3">
              <p className="text-xs">Belum ada kelas atau mata pelajaran yang diatur.</p>
              <Link
                href="/pengaturan/setup"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Atur Kelas di Pengaturan</span>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-1">
              {teachingContexts.map((tc, index) => {
                const badgeGradients = [
                  "from-teal-600 to-emerald-400",
                  "from-pink-600 to-rose-400",
                  "from-blue-600 to-cyan-400",
                  "from-purple-600 to-fuchsia-400",
                  "from-amber-500 to-orange-400",
                  "from-indigo-600 to-violet-400",
                ];
                const gradient = badgeGradients[index % badgeGradients.length];

                return (
                  <Link
                    key={tc.id}
                    href={`/kelas/${tc.id}`}
                    className="p-5 rounded-2xl border border-slate-100 bg-[#F8FAFA] hover:bg-white hover:border-teal-200 hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${gradient} text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform`}
                      >
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 group-hover:text-teal-700 transition-colors truncate">
                          {tc.subject.name}
                        </div>
                        <div className="text-xs font-semibold text-slate-500 mt-0.5">{tc.class.name}</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                      <span>{tc.academicPeriod.semester} {tc.academicPeriod.year}</span>
                      <span className="text-teal-700 font-bold flex items-center group-hover:translate-x-0.5 transition-transform">
                        Masuk Kelas &rarr;
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
