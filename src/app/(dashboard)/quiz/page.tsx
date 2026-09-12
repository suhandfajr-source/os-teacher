import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { listQuizzesAction } from "@/modules/quiz/quiz.actions";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, FileQuestion, ArrowRight, CheckCircle2, Clock, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function QuizDashboardPage() {
  const { auth } = await import("@/lib/auth");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const result = await listQuizzesAction();
  if (!result.success) redirect("/kelas");
  const quizzes = result.data ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quiz Online</h1>
          <p className="text-muted-foreground mt-1">
            Quiz pilihan ganda untuk siswa — dibagikan lewat link tanpa login, terkoreksi otomatis.
          </p>
        </div>
        <Link href="/quiz/new" className={cn(buttonVariants(), "gap-2")}>
          <Plus className="h-4 w-4" /> Buat Quiz
        </Link>
      </div>

      {/* List */}
      {quizzes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="rounded-full bg-muted p-4">
              <FileQuestion className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Belum ada quiz</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Buat quiz dari soal yang dihasilkan AI Studio, atau tulis soalmu sendiri. Bagikan link
              ke siswa dan nilai terkoreksi otomatis.
            </p>
            <Link href="/quiz/new" className={cn(buttonVariants({ variant: "outline" }), "mt-2 gap-2")}>
              <Plus className="h-4 w-4" /> Buat Quiz Pertama
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {quizzes.map((quiz) => (
            <Link key={quiz.id} href={`/quiz/${quiz.id}`} className="group">
              <Card className="transition-all group-hover:border-primary/40 group-hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{quiz.title}</h3>
                      <Badge
                        variant={
                          quiz.status === "PUBLISHED"
                            ? "default"
                            : quiz.status === "CLOSED"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {quiz.status === "PUBLISHED"
                          ? "Aktif"
                          : quiz.status === "CLOSED"
                          ? "Ditutup"
                          : "Draft"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{quiz.contextLabel}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileQuestion className="h-3.5 w-3.5" /> {quiz.questionCount} soal
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {quiz.attemptCount} mulai ·{" "}
                        {quiz.submittedCount} selesai
                      </span>
                      {quiz.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> Deadline{" "}
                          {new Date(quiz.deadline).toLocaleDateString("id-ID")}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
        <p>
          Siswa mengerjakan lewat <strong>link tanpa login</strong> — bagikan link dari halaman
          detail quiz. Soal teracak per siswa dan hanya bisa dikerjakan sekali (kecuali kamu buka
          remedial).
        </p>
      </div>
    </div>
  );
}
