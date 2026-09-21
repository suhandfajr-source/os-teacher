"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  CheckSquare, 
  Clock, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle, 
  Award, 
  ArrowRight,
  Sparkles
} from "lucide-react";
import { getStudentQuizListAction } from "@/modules/quiz/quiz.actions";
import { Button } from "@/components/ui/button";

export default function StudentQuizListPage() {
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [data, setData] = useState<{
    activeQuizzes: any[];
    completedQuizzes: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentQuizListAction();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || "Gagal memuat daftar kuis.");
      }
    } catch {
      setError("Terjadi kesalahan sistem saat memuat kuis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 pt-2">
        <div className="h-12 bg-white/70 rounded-2xl animate-pulse"></div>
        <div className="h-36 bg-white/70 rounded-3xl animate-pulse"></div>
        <div className="h-36 bg-white/70 rounded-3xl animate-pulse"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-white rounded-3xl border border-slate-200 text-center space-y-3 mt-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="font-bold text-slate-800 text-sm">Gagal Memuat Kuis</h3>
        <p className="text-xs text-slate-500">{error || "Data tidak dapat diakses."}</p>
        <Button onClick={loadQuizzes} variant="outline" size="sm" className="rounded-xl">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Coba Lagi
        </Button>
      </div>
    );
  }

  const { activeQuizzes, completedQuizzes } = data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-[#0F766E]" />
            <span>Pusat Kuis & Ujian</span>
          </h1>
          <p className="text-[11px] text-slate-500">
            Kerjakan kuis rombel dan tinjau hasil belajarmu
          </p>
        </div>
        <button
          onClick={loadQuizzes}
          title="Muat ulang kuis"
          className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Filter (Kuis Tersedia vs Riwayat Selesai) */}
      <div className="grid grid-cols-2 p-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs text-xs font-bold text-slate-600">
        <button
          type="button"
          onClick={() => setActiveTab("active")}
          className={`py-2 rounded-xl transition-all ${
            activeTab === "active"
              ? "bg-[#0F766E] text-white font-extrabold shadow-xs"
              : "hover:text-slate-900"
          }`}
        >
          Tersedia ({activeQuizzes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("completed")}
          className={`py-2 rounded-xl transition-all ${
            activeTab === "completed"
              ? "bg-[#0F766E] text-white font-extrabold shadow-xs"
              : "hover:text-slate-900"
          }`}
        >
          Selesai ({completedQuizzes.length})
        </button>
      </div>

      {/* TAB 1: KUIS AKTIF / TERSEDIA */}
      {activeTab === "active" && (
        <div className="space-y-2.5">
          {activeQuizzes.length === 0 ? (
            <div className="p-8 bg-white rounded-3xl border border-slate-200/80 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-slate-800">Semua Kuis Tuntas!</h4>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Tidak ada kuis baru yang perlu kamu kerjakan saat ini. Periksa tab Selesai untuk melihat pembahasan.
              </p>
            </div>
          ) : (
            activeQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] font-extrabold uppercase text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                      {quiz.subjectName}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 leading-tight">
                      {quiz.title}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Guru: {quiz.teacherName}
                    </p>
                  </div>

                  {quiz.attemptStatus === "IN_PROGRESS" && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                      Sedang Berjalan
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <div className="flex items-center gap-3">
                    {quiz.durationMinutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{quiz.durationMinutes} Menit</span>
                      </span>
                    )}
                    {quiz.deadline && (
                      <span className="flex items-center gap-1 text-slate-500">
                        <span>Batas: {new Date(quiz.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/siswa/portal/quiz/${quiz.shareToken}`}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0F766E] hover:bg-[#0D655E] text-white font-bold text-xs shadow-sm transition-all active:scale-95 flex items-center gap-1"
                  >
                    <span>{quiz.attemptStatus === "IN_PROGRESS" ? "Lanjutkan" : "Kerjakan"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: RIWAYAT KUIS SELESAI */}
      {activeTab === "completed" && (
        <div className="space-y-2.5">
          {completedQuizzes.length === 0 ? (
            <div className="p-8 bg-white rounded-3xl border border-slate-200/80 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-slate-800">Belum Ada Riwayat Kuis</h4>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Kuis yang telah kamu kerjakan akan muncul di sini beserta skor dan pembahasannya.
              </p>
            </div>
          ) : (
            completedQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      {quiz.subjectName}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {quiz.submittedAt && new Date(quiz.submittedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 truncate">
                    {quiz.title}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-teal-600" />
                    <span className="text-xs font-black text-[#0F766E]">
                      Nilai: {quiz.score ?? 0}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/siswa/portal/quiz/${quiz.shareToken}/review`}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors shrink-0 flex items-center gap-1"
                >
                  <span>Pembahasan</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
}
