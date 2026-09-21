import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { startQuizAttemptFromSessionAction } from "@/modules/quiz/quiz.actions";
import { QuizRunnerClient } from "@/components/student/QuizRunnerClient";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function StudentQuizTakePage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;

  const res = await startQuizAttemptFromSessionAction(shareToken);

  if (res.alreadySubmitted) {
    redirect(`/siswa/portal/quiz/${shareToken}/review`);
  }

  if (!res.success || !res.data) {
    return (
      <div className="p-6 bg-white rounded-3xl border border-slate-200 text-center space-y-4 my-6">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-900">Tidak Dapat Membuka Kuis</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {res.error || "Kuis tidak tersedia atau batas waktu telah lewat."}
          </p>
        </div>
        <Link href="/siswa/portal/quiz">
          <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Kembali ke Pusat Kuis
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <QuizRunnerClient
      token={shareToken}
      attemptId={res.data.attemptId}
      quizTitle={res.data.quizTitle}
      durationMinutes={res.data.durationMinutes}
      startedAt={res.data.startedAt}
      isRemedial={res.data.isRemedial}
      questions={res.data.questions}
      savedAnswers={res.data.savedAnswers}
    />
  );
}
