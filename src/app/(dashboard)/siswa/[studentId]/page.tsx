import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Award, FileText } from "lucide-react";
import { getStudentAssessmentHistory } from "@/modules/assessment/assessment.actions";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export default async function SiswaDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const { studentId } = await params;

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile || !profile.activeSchoolId) redirect("/onboarding");

  // Validate that the student is reachable by the teacher's TeachingContexts
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      schoolId: profile.activeSchoolId,
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
    include: {
      classMemberships: {
        include: {
          class: true,
          academicPeriod: true,
        },
      },
    },
  });

  if (!student) {
    redirect("/siswa");
  }

  let assessmentHistory: Awaited<ReturnType<typeof getStudentAssessmentHistory>>["results"] = [];
  try {
    const historyData = await getStudentAssessmentHistory(studentId);
    assessmentHistory = historyData.results;
  } catch {
    assessmentHistory = [];
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <div>
        <Link href="/siswa" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Daftar Siswa
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Profil Siswa</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Data Pribadi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Nama Lengkap</div>
              <div className="text-lg font-semibold">{student.fullName}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">NIS</div>
              <div className="text-lg">{student.nis || "-"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Status</div>
              <div className="text-lg">{student.status === "ACTIVE" ? "Aktif" : "Diarsipkan"}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat Kelas</CardTitle>
          </CardHeader>
          <CardContent>
            {student.classMemberships.length > 0 ? (
              <ul className="space-y-3">
                {student.classMemberships.map((cm) => (
                  <li key={cm.id} className="border p-3.5 rounded-md bg-slate-50">
                    <div className="font-semibold">{cm.class.name}</div>
                    <div className="text-muted-foreground text-xs">
                      Tahun Ajaran: {cm.academicPeriod.year} &bull; Semester {cm.academicPeriod.semester}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Siswa belum tergabung dalam kelas apapun.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scoped Assessment History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Riwayat Penilaian & Nilai (Kelas Anda)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assessmentHistory.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Belum ada data nilai penilaian untuk siswa ini pada kelas yang Anda ajar.
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="py-3 px-3 text-left font-semibold">Tanggal</th>
                    <th className="py-3 px-3 text-left font-semibold">Kelas & Mapel</th>
                    <th className="py-3 px-3 text-left font-semibold">Penilaian</th>
                    <th className="py-3 px-3 text-center font-semibold">Jenis</th>
                    <th className="py-3 px-3 text-center font-semibold">Status</th>
                    <th className="py-3 px-3 text-center font-semibold">Nilai Akhir</th>
                    <th className="py-3 px-3 text-center font-semibold">Remedial</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assessmentHistory.map((res) => (
                    <tr key={res.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">
                        {format(new Date(res.assessment.assessmentDate), "dd/MM/yyyy", { locale: localeId })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-xs">
                          {res.assessment.teachingContext.class.name} &bull; {res.assessment.teachingContext.subject.name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <Link
                          href={`/assessment/${res.assessment.id}`}
                          className="font-medium hover:underline text-primary"
                        >
                          {res.assessment.title}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="outline" className="text-xs">
                          {res.assessment.assessmentType.name}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            res.status === "GRADED"
                              ? "bg-green-50 text-green-700 border-green-200 text-xs"
                              : "text-xs"
                          }
                        >
                          {res.status === "GRADED" && "Dinilai"}
                          {res.status === "ABSENT" && "Tidak Hadir"}
                          {res.status === "EXCUSED" && "Dikecualikan"}
                          {res.status === "PENDING" && "Pending"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {res.finalScore !== null ? Number(res.finalScore).toFixed(1) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {res.remedialAttempts.length > 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            {res.remedialAttempts.length}x Percobaan
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
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
