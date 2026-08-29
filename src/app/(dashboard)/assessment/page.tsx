import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAssessmentDashboardData } from "@/modules/assessment/assessment.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Plus, FileText, ArrowRight, CheckCircle2, Clock } from "lucide-react";

export default async function AssessmentDashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  let assessments: Awaited<ReturnType<typeof getAssessmentDashboardData>> = [];
  try {
    assessments = await getAssessmentDashboardData();
  } catch {
    // If not authenticated to active school
    redirect("/kelas");
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daftar Penilaian</h1>
          <p className="text-muted-foreground mt-1">
            Semua penilaian, ulangan harian, tugas, dan ujian di kelas yang Anda ampu.
          </p>
        </div>

        <Link
          href="/assessment/new"
          className={cn(buttonVariants({ size: "lg" }), "font-semibold shadow-sm")}
        >
          <Plus className="w-4 h-4 mr-2" />
          + Buat Penilaian Baru
        </Link>
      </div>

      {/* Assessment List */}
      {assessments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-4">
            <FileText className="w-16 h-16 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-bold">Belum Ada Penilaian Dibuat</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Buat penilaian baru untuk mulai mencatat skor siswa, menganalisis ketuntasan KKTP, dan mendokumentasikan remedial.
            </p>
            <Link
              href="/assessment/new"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              <Plus className="w-4 h-4 mr-2" />
              Buat Penilaian Sekarang
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {assessments.map((a) => (
            <Card key={a.id} className="hover:shadow-md transition-shadow border">
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-medium">
                      {a.className} &bull; {a.subjectName}
                    </Badge>
                    <Badge variant="outline">{a.typeName}</Badge>

                    {a.status === "COMPLETED" && (
                      <Badge className="bg-green-600 hover:bg-green-700">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Selesai
                      </Badge>
                    )}
                    {a.status === "IN_PROGRESS" && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                        <Clock className="w-3 h-3 mr-1" /> Berlangsung
                      </Badge>
                    )}
                    {a.status === "DRAFT" && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Draft
                      </Badge>
                    )}
                  </div>

                  <h3 className="text-lg font-bold">
                    <Link href={`/assessment/${a.id}`} className="hover:underline text-primary">
                      {a.title}
                    </Link>
                  </h3>

                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    <span>Tanggal: {format(new Date(a.date), "dd MMMM yyyy", { locale: localeId })}</span>
                    <span>Skor Maksimum: {Number(a.maxScore)}</span>
                    {a.minimumPassingScore !== null && (
                      <span>KKTP: {Number(a.minimumPassingScore)}</span>
                    )}
                  </div>
                </div>

                {/* Statistics Bar */}
                <div className="flex flex-wrap md:flex-nowrap items-center gap-4 text-xs border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-5">
                  <div className="text-center min-w-[70px]">
                    <div className="text-muted-foreground">Peserta Dinilai</div>
                    <div className="font-semibold text-sm">
                      {a.stats.gradedCount} / {a.stats.totalParticipants}
                    </div>
                  </div>

                  <div className="text-center min-w-[70px]">
                    <div className="text-muted-foreground">Rata-rata</div>
                    <div className="font-semibold text-sm">
                      {a.stats.averageScore ? Number(a.stats.averageScore).toFixed(1) : "—"}
                    </div>
                  </div>

                  {a.minimumPassingScore !== null && (
                    <div className="text-center min-w-[80px]">
                      <div className="text-muted-foreground">Ketuntasan</div>
                      <div className="font-semibold text-sm text-green-600">
                        {a.stats.masteryPercentage ? `${Number(a.stats.masteryPercentage).toFixed(0)}%` : "—"}
                      </div>
                    </div>
                  )}

                  <Link
                    href={`/assessment/${a.id}`}
                    className={cn(buttonVariants({ variant: "default", size: "sm" }), "font-medium")}
                  >
                    Buka Lembar Nilai
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
