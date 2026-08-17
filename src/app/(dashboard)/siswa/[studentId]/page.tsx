import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function SiswaDetailPage({ params }: { params: { studentId: string } }) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session) redirect("/login");

  const { studentId } = await params;

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id }
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
                teacherProfileId: profile.id
              }
            }
          }
        }
      }
    },
    include: {
      classMemberships: {
        include: {
          class: true,
          academicPeriod: true
        }
      }
    }
  });

  if (!student) {
    // If not found or not authorized, redirect to list
    redirect("/siswa");
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <Link href="/siswa" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Daftar Siswa
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Profil Siswa</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Pribadi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Nama Lengkap</div>
            <div className="text-lg">{student.fullName}</div>
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
            <ul className="space-y-4">
              {student.classMemberships.map(cm => (
                <li key={cm.id} className="border p-4 rounded-md bg-slate-50">
                  <div className="font-semibold text-lg">{cm.class.name}</div>
                  <div className="text-muted-foreground text-sm">
                    {cm.academicPeriod.year} - {cm.academicPeriod.semester}
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
  );
}
