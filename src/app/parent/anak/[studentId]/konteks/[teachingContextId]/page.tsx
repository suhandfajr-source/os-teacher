import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getParentContextDetail } from "@/modules/parent/parent.service";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Calendar,
  Award,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { AttendanceStatus, AssessmentResultStatus } from "@prisma/client";

interface PageProps {
  params: Promise<{
    studentId: string;
    teachingContextId: string;
  }>;
}

export default async function ParentChildContextPage({ params }: PageProps) {
  const { studentId, teachingContextId } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect(`/parent/login?callbackUrl=/parent/anak/${studentId}/konteks/${teachingContextId}`);
  }

  let detail;
  try {
    detail = await getParentContextDetail(studentId, teachingContextId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Anda tidak memiliki izin untuk mengakses data pembelajaran ini.";
    return (
      <div className="max-w-lg mx-auto py-12">
        <Card className="border-destructive/30">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">Akses Ditolak</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Link href="/parent">
              <Button variant="outline">Kembali ke Beranda</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { attendance, activities, assessments } = detail;

  const getAttendanceBadge = (status: AttendanceStatus) => {
    switch (status) {
      case AttendanceStatus.PRESENT:
        return <Badge className="bg-green-600 hover:bg-green-700 text-white">Hadir</Badge>;
      case AttendanceStatus.LATE:
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Terlambat</Badge>;
      case AttendanceStatus.SICK:
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Sakit</Badge>;
      case AttendanceStatus.PERMISSION:
        return <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white">Izin</Badge>;
      case AttendanceStatus.ABSENT:
        return <Badge variant="destructive">Alpa</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8 py-2">
      {/* Back Link & Header */}
      <div className="space-y-4">
        <Link
          href="/parent"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke Beranda Orang Tua
        </Link>

        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{detail.studentName}</h1>
              {detail.relationshipLabel && (
                <Badge variant="secondary" className="text-xs">
                  {detail.relationshipLabel}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {detail.subjectName}
              </span>
              <span>&bull;</span>
              <span>Kelas {detail.className}</span>
              <span>&bull;</span>
              <span>{detail.academicYear} (Semester {detail.academicSemester})</span>
            </div>
          </div>

          <div className="text-left md:text-right border-t md:border-t-0 pt-3 md:pt-0">
            <span className="text-xs text-slate-500 block font-medium">Guru Pengajar</span>
            <span className="text-sm font-bold text-slate-800">{detail.teacherName}</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: RINGKASAN KEHADIRAN */}
      <Card className="shadow-xs border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
            <Calendar className="h-5 w-5 text-emerald-600" />
            Ringkasan Kehadiran
          </CardTitle>
          <CardDescription>
            Rekapitulasi status kehadiran siswa pada pertemuan kelas yang telah berlangsung.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Factual Count Chips (No invented percentages) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-green-50/80 border border-green-200 text-center">
              <span className="text-xs font-semibold text-green-700 block">Hadir</span>
              <span className="text-2xl font-extrabold text-green-800">{attendance.presentCount}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-center">
              <span className="text-xs font-semibold text-amber-700 block">Terlambat</span>
              <span className="text-2xl font-extrabold text-amber-800">{attendance.lateCount}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-center">
              <span className="text-xs font-semibold text-blue-700 block">Sakit</span>
              <span className="text-2xl font-extrabold text-blue-800">{attendance.sickCount}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-center">
              <span className="text-xs font-semibold text-indigo-700 block">Izin</span>
              <span className="text-2xl font-extrabold text-indigo-800">{attendance.permissionCount}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-red-50/80 border border-red-200 text-center">
              <span className="text-xs font-semibold text-red-700 block">Alpa</span>
              <span className="text-2xl font-extrabold text-red-800">{attendance.absentCount}</span>
            </div>
          </div>

          {/* Historical Attendance List */}
          {attendance.records.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Riwayat Pertemuan ({attendance.records.length})
              </h3>
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-slate-50 text-slate-600 border-b">
                    <tr>
                      <th className="py-2.5 px-4">Tanggal Pertemuan</th>
                      <th className="py-2.5 px-4 text-right">Status Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700">
                    {attendance.records.map((rec) => (
                      <tr key={rec.sessionId} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-medium">
                          {new Date(rec.date).toLocaleDateString("id-ID", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-2.5 px-4 text-right">{getAttendanceBadge(rec.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2: AKTIVITAS PEMBELAJARAN (PARTICIPANT PROOF ONLY) */}
      <Card className="shadow-xs border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
            <BookOpen className="h-5 w-5 text-emerald-600" />
            Aktivitas Pembelajaran Terlaksana
          </CardTitle>
          <CardDescription>
            Topik pembelajaran pada pertemuan yang telah selesai dan dihadiri/tercatat oleh siswa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              Belum ada riwayat aktivitas pembelajaran yang selesai untuk siswa ini.
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-slate-50 text-slate-600 border-b">
                  <tr>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Topik Pembelajaran</th>
                    <th className="py-3 px-4 text-right">Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {activities.map((act) => (
                    <tr key={act.sessionId} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 text-xs font-mono whitespace-nowrap">
                        {new Date(act.date).toLocaleDateString("id-ID")}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {act.actualTopic || <span className="italic text-slate-400">Topik tidak dicatat</span>}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {getAttendanceBadge(act.attendanceStatus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 3: NILAI PENILAIAN SELESAI */}
      <Card className="shadow-xs border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
            <Award className="h-5 w-5 text-emerald-600" />
            Hasil Penilaian Selesai
          </CardTitle>
          <CardDescription>
            Daftar penilaian resmi yang telah diselesaikan oleh guru mata pelajaran.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              Belum ada penilaian yang diselesaikan untuk kelas ini.
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-slate-50 text-slate-600 border-b">
                  <tr>
                    <th className="py-3 px-4">Judul Penilaian</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4 text-center">KKTP</th>
                    <th className="py-3 px-4 text-right">Nilai Siswa</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {assessments.map((ass) => (
                    <tr key={ass.assessmentId} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-semibold text-slate-900">{ass.title}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {ass.category}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(ass.date).toLocaleDateString("id-ID")}
                      </td>
                      <td className="py-3 px-4 text-center text-xs font-mono text-slate-600">
                        {ass.minimumPassingScore !== null ? ass.minimumPassingScore : "-"}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {ass.resultStatus === AssessmentResultStatus.GRADED && ass.finalScore !== null ? (
                          <span
                            className={`font-mono text-base font-extrabold ${
                              ass.minimumPassingScore !== null && ass.finalScore >= ass.minimumPassingScore
                                ? "text-green-700"
                                : ass.minimumPassingScore !== null
                                ? "text-amber-700"
                                : "text-slate-800"
                            }`}
                          >
                            {ass.finalScore}
                          </span>
                        ) : ass.resultStatus === AssessmentResultStatus.ABSENT ? (
                          <Badge variant="destructive">Tidak Hadir</Badge>
                        ) : ass.resultStatus === AssessmentResultStatus.EXCUSED ? (
                          <Badge variant="secondary">Izin/Dispensasi</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500">
                            Menunggu Penilaian
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
