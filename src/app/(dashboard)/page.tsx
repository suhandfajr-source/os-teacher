import React from 'react';
import Link from 'next/link';
import { prisma } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, Calendar, Sparkles, ArrowRight, Settings } from 'lucide-react';
import { getRscAuthContext } from "@/lib/rsc-auth-context";

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

  // Query teacher-owned teaching contexts in the active school
  const teachingContexts = await prisma.teachingContext.findMany({
    where: {
      teacherProfileId: profile.id,
      schoolId: activeSchoolId
    },
    include: {
      class: true,
      subject: true,
      academicPeriod: true
    }
  });

  const teachingContextIds = teachingContexts.map(tc => tc.id);

  // Query today's sessions and reachable students in parallel
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todaySessions, reachableStudentsCount] = await Promise.all([
    prisma.teachingSession.findMany({
      where: {
        teachingContextId: { in: teachingContextIds },
        date: { gte: today }
      }
    }),
    prisma.student.count({
      where: {
        schoolId: activeSchoolId,
        status: "ACTIVE",
        classMemberships: {
          some: {
            class: {
              teachingContexts: {
                some: {
                  teacherProfileId: profile.id
                }
              }
            }
          }
        }
      }
    })
  ]);

  const inProgressSessionsCount = todaySessions.filter(s => s.status === "IN_PROGRESS").length;
  const completedSessionsCount = todaySessions.filter(s => s.status === "COMPLETED").length;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-16">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Beranda</h1>
        <p className="text-muted-foreground mt-1">
          Selamat datang, <span className="font-semibold text-foreground">{session.user.name}</span>. 
          {activeSchool ? ` Anda mengajar di ${activeSchool.name}.` : ""}
        </p>
      </div>

      {/* Real Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Konteks Mengajar Diampu</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teachingContexts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Kombinasi kelas, mata pelajaran & periode aktif
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sesi Hari Ini</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {inProgressSessionsCount + completedSessionsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {inProgressSessionsCount > 0 
                ? `${inProgressSessionsCount} sedang berlangsung, ${completedSessionsCount} selesai`
                : `${completedSessionsCount} sesi telah diselesaikan hari ini`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Siswa Terdaftar</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reachableStudentsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Siswa aktif pada kelas yang Anda ampu
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action / Next Steps Hub */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Sesi Mengajar & Presensi
            </CardTitle>
            <CardDescription>
              Mulai sesi pembelajaran hari ini, catat presensi siswa, dan buat catatan jurnal mengajar.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link href="/hari-ini">
              <Button className="w-full sm:w-auto">
                Buka Menu Hari Ini
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI Content Studio
            </CardTitle>
            <CardDescription>
              Buat draf materi, rencana aktivitas, instruksi tugas, dan rubrik pembelajaran dengan bantuan AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link href="/ai-studio">
              <Button variant="outline" className="w-full sm:w-auto text-purple-700 border-purple-200 hover:bg-purple-50">
                Buka AI Studio
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Class Navigator or Empty State */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Kelas Diampu</CardTitle>
          <CardDescription>Akses cepat ke detail kelas, lembar penilaian, presensi, dan impor data.</CardDescription>
        </CardHeader>
        <CardContent>
          {teachingContexts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground space-y-3">
              <p>Belum ada kelas atau mata pelajaran yang diatur.</p>
              <Link href="/pengaturan/setup">
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Atur Kelas di Pengaturan
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teachingContexts.map((tc) => (
                <Link
                  key={tc.id}
                  href={`/kelas/${tc.id}`}
                  className="p-4 rounded-lg border bg-card hover:border-primary transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="font-semibold text-base">{tc.subject.name}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{tc.class.name}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-3 flex items-center justify-between">
                    <span>{tc.academicPeriod.semester} {tc.academicPeriod.year}</span>
                    <span className="text-primary font-medium flex items-center">
                      Buka &rarr;
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
