import React from "react";
import Link from "next/link";
import { getQuizReviewFromSessionAction } from "@/modules/quiz/quiz.actions";
import { 
  Award, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft, 
  BookOpen, 
  HelpCircle, 
  Calendar 
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function StudentQuizReviewPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;

  const res = await getQuizReviewFromSessionAction(shareToken);

  if (!res.success || !res.data) {
    return (
      <div className="p-6 bg-white rounded-3xl border border-slate-200 text-center space-y-4 my-6">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <HelpCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-900">Pembahasan Belum Tersedia</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {res.error || "Hasil dan pembahasan kuis ini belum dapat ditampilkan."}
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

  const { quizTitle, score, standardScore, passed, submittedAt, questions } = res.data;

  return (
    <div className="space-y-4">
      {/* Top Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/siswa/portal/quiz"
          className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Daftar Kuis</span>
        </Link>
      </div>

      {/* Score Summary Card */}
      <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-[#0F766E] text-[10px] font-extrabold uppercase border border-teal-200/60">
          <Award className="w-3.5 h-3.5 text-teal-600" />
          <span>Hasil Ujian</span>
        </div>

        <h1 className="text-sm font-black text-slate-900">
          {quizTitle}
        </h1>

        {/* Big Score Display */}
        <div className="py-2">
          <div className="text-4xl font-black tracking-tight text-[#0F766E]">
            {score}
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            Skor Akhir dari 100
          </span>
        </div>

        <div className="flex items-center justify-center gap-3 text-xs pt-1 border-t border-slate-100">
          <span
            className={`font-bold px-2.5 py-0.5 rounded-full ${
              passed
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            {passed ? "TUNTAS" : "BELUM TUNTAS"}
          </span>

          {standardScore && (
            <span className="text-slate-400 text-[11px]">
              KKM / Target: <b>{standardScore}</b>
            </span>
          )}

          {submittedAt && (
            <span className="text-slate-400 text-[11px] flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{new Date(submittedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
            </span>
          )}
        </div>
      </div>

      {/* Review Soal & Pembahasan */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider px-1">
          Pembahasan Soal ({questions.length} Butir)
        </h3>

        {questions.map((q) => (
          <div
            key={q.id}
            className={`p-4 bg-white rounded-3xl border shadow-xs space-y-3 ${
              q.isCorrect === true
                ? "border-emerald-200/90"
                : q.isCorrect === false
                ? "border-rose-200/90"
                : "border-slate-200"
            }`}
          >
            {/* Header Nomor & Status Jawaban */}
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900">
                  Soal {q.order}
                </span>
                {q.isCorrect === true ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Benar
                  </span>
                ) : q.isCorrect === false ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                    <XCircle className="w-3 h-3 text-rose-600" /> Salah
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">Esai</span>
                )}
              </div>
              <span className="text-[11px] font-mono text-slate-400 font-bold">
                +{q.pointsEarned} / {q.pointsMax} Poin
              </span>
            </div>

            {/* Teks Pertanyaan */}
            <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed">
              {q.text}
            </p>

            {/* Pilihan Ganda Review */}
            {q.type === "MULTIPLE_CHOICE" && q.options && (
              <div className="space-y-1.5 pt-1">
                {q.options.map((optionText, optIdx) => {
                  const isStudentPick = q.selectedIndex === optIdx;
                  const isCorrectAnswer = q.correctIndex === optIdx;
                  const letter = String.fromCharCode(65 + optIdx);

                  let badgeClass = "bg-white border-slate-200 text-slate-600";
                  if (isCorrectAnswer) {
                    badgeClass = "bg-emerald-50 border-emerald-300 font-bold text-emerald-900";
                  } else if (isStudentPick && !isCorrectAnswer) {
                    badgeClass = "bg-rose-50 border-rose-300 font-bold text-rose-900";
                  }

                  return (
                    <div
                      key={optIdx}
                      className={`p-2.5 rounded-2xl border text-xs flex items-start gap-2.5 ${badgeClass}`}
                    >
                      <span className="font-mono font-bold shrink-0">{letter}.</span>
                      <span className="leading-relaxed flex-1">{optionText}</span>
                      {isCorrectAnswer && (
                        <span className="text-[10px] font-bold text-emerald-700 shrink-0">
                          (Kunci)
                        </span>
                      )}
                      {isStudentPick && !isCorrectAnswer && (
                        <span className="text-[10px] font-bold text-rose-700 shrink-0">
                          (Pilihanmu)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Jawaban Esai */}
            {q.type === "ESSAY" && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                <span className="font-bold text-slate-600 text-[10px] uppercase">
                  Jawaban Esai Siswa:
                </span>
                <p className="text-slate-800 italic">
                  {q.essayAnswer || "Tidak ada jawaban esai."}
                </p>
              </div>
            )}

            {/* Kotak Pembahasan (Explanation) */}
            {q.explanation && (
              <div className="p-3 bg-teal-50/70 rounded-2xl border border-teal-200/80 text-xs text-teal-950 space-y-1">
                <div className="flex items-center gap-1 font-bold text-teal-800 text-[11px]">
                  <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                  <span>Pembahasan Guru:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-teal-900">
                  {q.explanation}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
