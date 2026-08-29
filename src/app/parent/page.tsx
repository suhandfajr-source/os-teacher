import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/auth";
import { getParentAuthorizedContexts } from "@/modules/parent/parent.service";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, GraduationCap, ArrowRight, HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function ParentHomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/parent/login");
  }

  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
  });

  const contexts = parentProfile ? await getParentAuthorizedContexts(parentProfile.id) : [];

  return (
    <div className="space-y-8 py-4">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Selamat Datang, {session.user.name}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pantau aktivitas belajar, kehadiran, dan penilaian resmi putra/putri Anda secara langsung.
          </p>
        </div>
      </div>

      {/* Empty State */}
      {contexts.length === 0 ? (
        <Card className="shadow-xs border-dashed border-2 border-slate-300 text-center py-12">
          <CardContent className="space-y-4 max-w-md mx-auto">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
              <HeartHandshake className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-lg font-bold text-slate-800">
                Belum Ada Akses Pembelajaran Aktif
              </CardTitle>
              <CardDescription className="text-sm">
                Akun Anda belum terhubung dengan kelas pembelajaran aktif. Silakan hubungi guru mata pelajaran siswa untuk mendapatkan tautan undangan.
              </CardDescription>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-emerald-600" />
              Mata Pelajaran & Siswa Terhubung
            </h2>
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
              {contexts.length} Kelas Aktif
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {contexts.map((ctx) => (
              <Card key={`${ctx.studentId}-${ctx.teachingContextId}`} className="shadow-sm hover:shadow-md transition-shadow border-slate-200 flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-slate-900">{ctx.studentName}</span>
                        {ctx.relationshipLabel && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {ctx.relationshipLabel}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Kelas {ctx.className}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-emerald-300 bg-emerald-50 text-emerald-700">
                      Aktif
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pb-4">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      <BookOpen className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{ctx.subjectName}</span>
                    </div>
                    <div className="text-xs text-slate-600 flex justify-between">
                      <span>Guru: {ctx.teacherName}</span>
                      <span className="text-slate-400">{ctx.academicYear} (Sem {ctx.academicSemester})</span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-0 border-t border-slate-100 mt-auto pt-3">
                  <Link
                    href={`/parent/anak/${ctx.studentId}/konteks/${ctx.teachingContextId}`}
                    className={cn(
                      buttonVariants({ variant: "default" }),
                      "w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center justify-center gap-1.5"
                    )}
                  >
                    Lihat Pembelajaran
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
