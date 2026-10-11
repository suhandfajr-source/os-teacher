"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CbtLiveCockpitView,
  CbtSessionStatusView,
  CbtSessionStudentProgressView,
} from "@/modules/cbt-live/cbt-live.types";
import {
  getCbtSessionCockpitAction,
  updateCbtSessionStatusAction,
  unblockStudentAttemptAction,
  forceSubmitStudentAttemptAction,
} from "@/modules/cbt-live/cbt-live.actions";
import {
  Play,
  Pause,
  StopCircle,
  Users,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowLeft,
  RefreshCw,
  Clock,
  Sparkles,
} from "lucide-react";

interface Props {
  initialData: CbtLiveCockpitView;
}

export function CbtLiveCockpitClient({ initialData }: Props) {
  const [data, setData] = useState<CbtLiveCockpitView>(initialData);
  const [loadingAction, setLoadingAction] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<CbtSessionStudentProgressView | null>(null);

  // Polling data real-time setiap 3.5 detik jika sesi belum berakhir
  const refreshCockpit = useCallback(async () => {
    const res = await getCbtSessionCockpitAction(data.sessionId);
    if (res.success && res.data) {
      setData(res.data);
    }
  }, [data.sessionId]);

  useEffect(() => {
    if (data.status === "ENDED") return;
    const interval = setInterval(refreshCockpit, 3500);
    return () => clearInterval(interval);
  }, [data.status, refreshCockpit]);

  const handleStatusChange = async (newStatus: "ACTIVE" | "PAUSED" | "ENDED") => {
    if (newStatus === "ENDED") {
      const confirmEnd = window.confirm(
        "Yakin ingin mengakhiri sesi ujian serentak? Seluruh jawaban siswa yang sedang aktif akan otomatis dikumpulkan dan dinilai."
      );
      if (!confirmEnd) return;
    }

    setLoadingAction(true);
    try {
      const res = await updateCbtSessionStatusAction(data.sessionId, newStatus);
      if (res.success && res.status) {
        toast.success(
          newStatus === "ACTIVE"
            ? "Ujian dimulai!"
            : newStatus === "PAUSED"
            ? "Ujian ditangguhkan sementara."
            : "Ujian selesai."
        );
        refreshCockpit();
      } else {
        toast.error(res.error || "Gagal mengubah status ujian.");
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const handleUnblock = async (student: CbtSessionStudentProgressView) => {
    setLoadingAction(true);
    try {
      const res = await unblockStudentAttemptAction(data.sessionId, student.attemptId);
      if (res.success) {
        toast.success(`Kunci ujian ${student.studentName} berhasil dibuka.`);
        setSelectedStudent(null);
        refreshCockpit();
      } else {
        toast.error(res.error || "Gagal membuka kunci.");
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const handleForceSubmit = async (student: CbtSessionStudentProgressView) => {
    const confirm = window.confirm(
      `Paksa selesai pengerjaan ${student.studentName}? Nilai akan langsung dihitung dari jawaban yang tersimpan.`
    );
    if (!confirm) return;

    setLoadingAction(true);
    try {
      const res = await forceSubmitStudentAttemptAction(data.sessionId, student.attemptId);
      if (res.success) {
        toast.success(`Ujian ${student.studentName} berhasil diselesaikan paksa.`);
        setSelectedStudent(null);
        refreshCockpit();
      } else {
        toast.error(res.error || "Gagal mengumpulkan ujian.");
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const getStatusBadge = (status: CbtSessionStatusView) => {
    switch (status) {
      case "WAITING":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Lobi / Menunggu</span>;
      case "ACTIVE":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Berlangsung</span>;
      case "PAUSED":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Dijeda</span>;
      case "ENDED":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Selesai</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* ─────────────────────────────────────────────────────────────
          1. COCKPIT TOPBAR
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/quiz/${data.quizId}`}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
              title="Kembali ke detail kuis"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{data.quizTitle}</h1>
                {getStatusBadge(data.status)}
              </div>
              <p className="text-xs text-slate-500">
                {data.className} • {data.subjectName} • {data.durationMinutes ? `${data.durationMinutes} Menit` : "Tanpa Batas Waktu"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* TOKEN PIN DISPLAY */}
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200/80 px-4 py-2 rounded-xl">
              <span className="text-xs font-medium text-purple-700 uppercase tracking-wider">PIN SESI:</span>
              <span className="font-mono text-xl font-bold text-purple-900 tracking-widest">{data.token}</span>
            </div>

            {/* CONTROLS */}
            {data.status === "WAITING" && (
              <button
                onClick={() => handleStatusChange("ACTIVE")}
                disabled={loadingAction}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" /> Mulai Ujian Serentak
              </button>
            )}

            {data.status === "ACTIVE" && (
              <>
                <button
                  onClick={() => handleStatusChange("PAUSED")}
                  disabled={loadingAction}
                  className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  <Pause className="w-4 h-4 fill-white" /> Jeda Ujian
                </button>
                <button
                  onClick={() => handleStatusChange("ENDED")}
                  disabled={loadingAction}
                  className="flex items-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  <StopCircle className="w-4 h-4" /> Akhiri Serentak
                </button>
              </>
            )}

            {data.status === "PAUSED" && (
              <>
                <button
                  onClick={() => handleStatusChange("ACTIVE")}
                  disabled={loadingAction}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-white" /> Lanjutkan Ujian
                </button>
                <button
                  onClick={() => handleStatusChange("ENDED")}
                  disabled={loadingAction}
                  className="flex items-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  <StopCircle className="w-4 h-4" /> Akhiri Serentak
                </button>
              </>
            )}

            <button
              onClick={refreshCockpit}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
              title="Perbarui data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. METRIC CARDS OVERVIEW
      ───────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hadir di Sesi</span>
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{data.joinedCount}</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sedang Mengerjakan</span>
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{data.activeCount}</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Selesai Submit</span>
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-blue-600">{data.submittedCount}</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Terkunci Integritas</span>
              <Lock className="w-4 h-4 text-rose-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-rose-600">{data.lockedCount}</p>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            3. LIVE STUDENT COCKPIT GRID
        ───────────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Monitor Peserta Live</h2>
              <p className="text-xs text-slate-500">Klik kartu siswa untuk melihat detail & melakukan intervensi.</p>
            </div>
            <span className="text-xs text-slate-400">Pembaruan tiap 3.5 detik</span>
          </div>

          {data.students.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">Belum ada siswa yang masuk</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Minta siswa membuka portal siswa menu CBT dan memasukkan PIN sesi <span className="font-mono font-bold text-purple-700">{data.token}</span>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {data.students.map((student) => {
                const isLocked = student.lockedBySystem;
                const isFinished = student.status === "SUBMITTED" || student.status === "NEEDS_GRADING";

                return (
                  <button
                    key={student.attemptId}
                    onClick={() => setSelectedStudent(student)}
                    className={`text-left p-3.5 rounded-xl border transition-all relative ${
                      isLocked
                        ? "bg-rose-50/50 border-rose-200 hover:border-rose-400"
                        : isFinished
                        ? "bg-slate-50 border-slate-200 hover:border-slate-300"
                        : "bg-white border-slate-200/90 hover:border-purple-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-900 truncate">{student.studentName}</p>
                        <p className="text-[11px] text-slate-500 font-mono">NIS: {student.studentNis || "-"}</p>
                      </div>

                      {isLocked ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Kunci
                        </span>
                      ) : isFinished ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                          Selesai
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Aktif
                        </span>
                      )}
                    </div>

                    {/* PROGRESS BAR */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span>Soal: #{student.currentQuestion + 1}</span>
                        <span>{student.answeredCount}/{student.totalQuestions} Terisi</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isLocked ? "bg-rose-500" : isFinished ? "bg-blue-500" : "bg-purple-600"
                          }`}
                          style={{
                            width: `${(student.answeredCount / Math.max(1, student.totalQuestions)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* VIOLATION BADGE */}
                    {student.violationCount > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span className="flex items-center gap-1 text-rose-600 font-semibold">
                          <AlertTriangle className="w-3 h-3" />
                          {student.violationCount}x Pelanggaran
                        </span>
                        {student.score !== null && (
                          <span className="font-bold text-slate-700">Nilai: {student.score}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          4. STUDENT INTERVENTION MODAL
      ───────────────────────────────────────────────────────────── */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedStudent.studentName}</h3>
                <p className="text-xs text-slate-500">NIS: {selectedStudent.studentNis || "-"}</p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 py-3 border-y border-slate-100 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Status Pengerjaan:</span>
                <span className="font-semibold text-slate-800">{selectedStudent.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nomor Soal Aktif:</span>
                <span className="font-semibold text-slate-800">#{selectedStudent.currentQuestion + 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jawaban Tersimpan:</span>
                <span className="font-semibold text-slate-800">{selectedStudent.answeredCount} dari {selectedStudent.totalQuestions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pelanggaran Integritas:</span>
                <span className={`font-bold ${selectedStudent.violationCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {selectedStudent.violationCount}x Strike
                </span>
              </div>
              {selectedStudent.score !== null && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Skor Diperoleh:</span>
                  <span className="font-bold text-purple-700">{selectedStudent.score}</span>
                </div>
              )}
            </div>

            {/* ACTION BUTTONS */}
            <div className="mt-5 space-y-2">
              {selectedStudent.lockedBySystem && (
                <button
                  onClick={() => handleUnblock(selectedStudent)}
                  disabled={loadingAction}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
                >
                  Buka Kunci Ujian (Reset Strike ke 0)
                </button>
              )}

              {selectedStudent.status === "IN_PROGRESS" && (
                <button
                  onClick={() => handleForceSubmit(selectedStudent)}
                  disabled={loadingAction}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
                >
                  Paksa Kumpulkan Jawaban Sekarang
                </button>
              )}

              <button
                onClick={() => setSelectedStudent(null)}
                className="w-full py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-medium transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
