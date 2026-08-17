import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import Link from "next/link";

export default async function SiswaPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session) redirect("/login");

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id }
  });

  if (!profile || !profile.activeSchoolId) redirect("/onboarding");

  // Get students only reachable through teacher's TeachingContexts
  const students = await prisma.student.findMany({
    where: {
      schoolId: profile.activeSchoolId,
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
    },
    orderBy: { fullName: "asc" }
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Daftar Siswa</h1>
        <p className="text-muted-foreground mt-2">
          Siswa-siswa yang terdaftar di kelas Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {students.map(s => (
          <Link href={`/siswa/${s.id}`} key={s.id}>
            <Card className="hover:border-primary transition-colors h-full">
              <CardHeader>
                <CardTitle>{s.fullName}</CardTitle>
              </CardHeader>
              <CardContent>
                {s.nis && <p className="text-sm text-muted-foreground">NIS: {s.nis}</p>}
              </CardContent>
            </Card>
          </Link>
        ))}
        {students.length === 0 && (
          <p className="text-muted-foreground text-sm col-span-full">Belum ada siswa yang terdaftar di kelas Anda.</p>
        )}
      </div>
    </div>
  );
}
