import { prisma } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { getRscAuthContext } from "@/lib/rsc-auth-context";

export default async function KelasPage() {
  let authContext = null;
  try {
    authContext = await getRscAuthContext();
  } catch {
    redirect("/login");
  }

  const { profile, activeSchoolId } = authContext;

  if (!activeSchoolId) redirect("/onboarding");

  // Get teaching contexts for the current teacher in the active school
  const contexts = await prisma.teachingContext.findMany({
    where: { 
      teacherProfileId: profile.id,
      schoolId: activeSchoolId
    },
    include: {
      subject: true,
      class: {
        include: {
          _count: {
            select: { classStudents: true }
          }
        }
      },
      academicPeriod: true
    },
    orderBy: [
      { academicPeriod: { year: 'desc' } },
      { class: { name: 'asc' } }
    ]
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Daftar Kelas Mengajar</h1>
        <p className="text-muted-foreground mt-2">
          Pilih kelas untuk mengelola siswa dan data pembelajaran.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contexts.map(ctx => (
          <Link href={`/kelas/${ctx.id}`} key={ctx.id}>
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle>{ctx.class.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="font-medium text-sm">Mata Pelajaran</div>
                  <div className="text-muted-foreground text-sm">{ctx.subject.name}</div>
                </div>
                <div>
                  <div className="font-medium text-sm">Periode</div>
                  <div className="text-muted-foreground text-sm">{ctx.academicPeriod.year} - {ctx.academicPeriod.semester}</div>
                </div>
                <div>
                  <div className="font-medium text-sm">Jumlah Siswa</div>
                  <div className="text-muted-foreground text-sm">{ctx.class._count.classStudents} Siswa</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {contexts.length === 0 && (
          <div className="col-span-full p-8 text-center border rounded-lg bg-slate-50">
            <p className="text-muted-foreground mb-4">Anda belum memiliki kelas mengajar.</p>
            <Link href="/pengaturan/setup" className="text-primary hover:underline font-medium">
              Buat Konteks Mengajar Baru
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
