"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Clock, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  AlertTriangle, 
  ShieldAlert,
  HelpCircle,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  saveQuizAnswerFromSessionAction, 
  submitQuizAttemptFromSessionAction 
} from "@/modules/quiz/quiz.actions";
import type { StudentQuizQuestionView } from "@/modules/quiz/quiz.types";

interface SavedAnswerItem {
  questionId: string;
  selectedIndex: number | null;
  essayAnswer: string | null;
}

interface QuizRunnerClientProps {
  token: string;
  attemptId: string;
  quizTitle: string;
  durationMinutes?: number;
  startedAt: string;
  isRemedial: boolean;
  questions: StudentQuizQuestionView[];
  savedAnswers: SavedAnswerItem[];
}

export function QuizRunnerClient({
  token,
  attemptId,
  quizTitle,
  durationMinutes,
  startedAt,
  questions,
  savedAnswers: initialSavedAnswers,
}: QuizRunnerClientProps) {
  const router = useRouter();

  // Current active question index (0-indexed)
  const [currentIndex, setCurrentIndex] = useState(0);

  // Map of answers: { [questionId]: { selectedIndex, essayAnswer } }
  const [answers, setAnswers] = useState<
    Record<string, { selectedIndex: number | null; essayAnswer: string | null }>
  >(() => {
    const map: Record<string, { selectedIndex: number | null; essayAnswer: string | null }> = {};
    initialSavedAnswers.forEach((a) => {
      map[a.questionId] = {
        selectedIndex: a.selectedIndex,
        essayAnswer: a.essayAnswer,
      };
    });
    return map;
  });

  // Autosave status indicator
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");

  // Confirm submit dialog
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --- WALL-CLOCK TIMER (Temuan D3) ---
  const [timeLeftSec, setTimeLeftSec] = useState<number | null>(() => {
    if (!durationMinutes) return null;
    const startMs = new Date(startedAt).getTime();
    const endMs = startMs + durationMinutes * 60 * 1000;
    const diffSec = Math.floor((endMs - Date.now()) / 1000);
    return Math.max(0, diffSec);
  });

  // Calculate timer sync from wall-clock
  const syncTimer = useCallback(() => {
    if (!durationMinutes) return;
    const startMs = new Date(startedAt).getTime();
    const endMs = startMs + durationMinutes * 60 * 1000;
    const diffSec = Math.floor((endMs - Date.now()) / 1000);
    const clamped = Math.max(0, diffSec);
    setTimeLeftSec(clamped);

    if (clamped <= 0) {
      // Auto-submit when time expires (Temuan F7)
      handleAutoSubmitOnExpire();
    }
  }, [durationMinutes, startedAt]);

  useEffect(() => {
    if (!durationMinutes) return;

    // Interval tick every second
    const interval = setInterval(syncTimer, 1000);

    // Listener visibilitychange for instant sync when student wakes up phone
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncTimer();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [durationMinutes, syncTimer]);

  // --- AUTOSAVE DEBOUNCE (Temuan D4) ---
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAutosave = (questionId: string, selectedIndex: number | null, essayAnswer: string | null) => {
    setSaveStatus("saving");
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await saveQuizAnswerFromSessionAction(
          attemptId,
          questionId,
          selectedIndex,
          essayAnswer
        );
        if (res.success) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      } catch {
        setSaveStatus("error");
      }
    }, 600);
  };

  // Select Multiple Choice Option
  const handleSelectOption = (index: number) => {
    const q = questions[currentIndex];
    const prev = answers[q.id];
    if (prev?.selectedIndex === index) return;

    const updated = {
      selectedIndex: index,
      essayAnswer: prev?.essayAnswer ?? null,
    };

    setAnswers((prevMap) => ({
      ...prevMap,
      [q.id]: updated,
    }));

    triggerAutosave(q.id, index, updated.essayAnswer);
  };

  // Type Essay Answer
  const handleEssayChange = (text: string) => {
    const q = questions[currentIndex];
    const prev = answers[q.id];

    const updated = {
      selectedIndex: null,
      essayAnswer: text,
    };

    setAnswers((prevMap) => ({
      ...prevMap,
      [q.id]: updated,
    }));

    triggerAutosave(q.id, null, text);
  };

  // --- SUBMIT ATTEMPT ---
  const executeSubmit = async () => {
    setSubmitting(true);
    try {
      const answersArray = questions.map((q) => {
        const a = answers[q.id];
        return {
          questionId: q.id,
          selectedIndex: a?.selectedIndex ?? null,
          essayAnswer: a?.essayAnswer ?? null,
        };
      });

      const res = await submitQuizAttemptFromSessionAction(attemptId, answersArray);
      if (res.success) {
        toast.success("Kuis berhasil dikumpulkan!");
        router.push(`/siswa/portal/quiz/${token}/review`);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal mengumpulkan kuis.");
        setSubmitting(false);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan sistem saat submit.");
      setSubmitting(false);
    }
  };

  const handleAutoSubmitOnExpire = () => {
    toast.warning("Waktu pengerjaan kuis telah habis. Mengumpulkan jawaban otomatis...");
    executeSubmit();
  };

  const currentQ = questions[currentIndex];
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined;
  const answeredCount = questions.filter(
    (q) =>
      answers[q.id]?.selectedIndex !== null &&
      answers[q.id]?.selectedIndex !== undefined
  ).length;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3 pt-1">
      {/* 1. Header Bar Kuis: Judul, Timer & Autosave Status */}
      <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[10px] font-extrabold uppercase text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
            Ujian Berlangsung
          </span>
          <h2 className="text-xs font-bold text-slate-900 truncate mt-0.5">
            {quizTitle}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Timer Badge */}
          {timeLeftSec !== null && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-black border transition-colors ${
                timeLeftSec < 120
                  ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                  : timeLeftSec < 300
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-teal-50 text-[#0F766E] border-teal-200"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimer(timeLeftSec)}</span>
            </div>
          )}

          {/* Autosave Status */}
          <div className="text-[10px] text-slate-400">
            {saveStatus === "saving" ? (
              <span className="text-amber-600 font-medium">Menyimpan...</span>
            ) : saveStatus === "error" ? (
              <span className="text-rose-600 font-medium">Gagal simpan</span>
            ) : (
              <span className="text-teal-700 flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3 text-teal-600" /> Tersimpan
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Navigator Soal Horizontal (1 .. N) */}
      <div className="p-2.5 bg-white rounded-2xl border border-slate-200/80 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {questions.map((q, idx) => {
            const isAns = answers[q.id]?.selectedIndex !== null && answers[q.id]?.selectedIndex !== undefined;
            const isCurr = idx === currentIndex;

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-8 h-8 rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
                  isCurr
                    ? "bg-[#0F766E] text-white ring-2 ring-teal-600/30 font-black shadow-xs scale-105"
                    : isAns
                    ? "bg-teal-50 text-teal-800 border border-teal-200 font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Lembar Soal Aktif */}
      {currentQ && (
        <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          {/* Header Soal */}
          <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
            <span className="font-extrabold text-[#0F766E]">
              Soal {currentIndex + 1} dari {questions.length}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Poin: {currentQ.points ?? 1}
            </span>
          </div>

          {/* Teks Pertanyaan */}
          <div className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed">
            {currentQ.text}
          </div>

          {/* Pilihan Ganda */}
          {currentQ.type === "MULTIPLE_CHOICE" && currentQ.options && (
            <div className="space-y-2 pt-1">
              {(currentQ.options as string[]).map((optionText, optIdx) => {
                const isSelected = currentAnswer?.selectedIndex === optIdx;
                const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => handleSelectOption(optIdx)}
                    className={`w-full p-3 rounded-2xl border text-left transition-all flex items-start gap-3 active:scale-[0.99] ${
                      isSelected
                        ? "bg-teal-50/90 border-teal-600 ring-1 ring-teal-600 text-teal-950 shadow-xs"
                        : "bg-white border-slate-200/90 hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-colors ${
                        isSelected
                          ? "bg-[#0F766E] text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {letter}
                    </span>
                    <span className="text-xs leading-relaxed pt-0.5">
                      {optionText}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Soal Esai */}
          {currentQ.type === "ESSAY" && (
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-slate-600 block">
                Jawaban Esai Anda:
              </label>
              <textarea
                rows={4}
                value={currentAnswer?.essayAnswer || ""}
                onChange={(e) => handleEssayChange(e.target.value)}
                placeholder="Tuliskan jawaban esai kamu secara lengkap di sini..."
                className="w-full p-3 text-xs rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600 leading-relaxed"
              />
            </div>
          )}
        </div>
      )}

      {/* 4. Kontrol Navigasi Soal Bawah */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          className="h-11 rounded-2xl text-xs font-bold text-slate-700 px-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          <span>Sebelumnya</span>
        </Button>

        {currentIndex < questions.length - 1 ? (
          <Button
            type="button"
            onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            className="h-11 rounded-2xl bg-[#0F766E] hover:bg-[#0D655E] text-white text-xs font-bold px-4"
          >
            <span>Selanjutnya</span>
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 shadow-sm"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            <span>Kumpulkan Ujian</span>
          </Button>
        )}
      </div>

      {/* Tombol Kumpul Cepat (Selalu Terlihat di Bagian Bawah) */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowConfirmModal(true)}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
          <span>Selesai & Kumpulkan ({answeredCount}/{questions.length} Terjawab)</span>
        </button>
      </div>

      {/* 5. MODAL KONFIRMASI SUBMIT */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-2">
                <Send className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900">
                Kumpulkan Jawaban Ujian?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Kamu telah menjawab{" "}
                <b className="text-slate-800 font-bold">{answeredCount}</b> dari{" "}
                <b className="text-slate-800 font-bold">{questions.length}</b> butir soal.
              </p>
              {answeredCount < questions.length && (
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] text-left flex items-start gap-2 mt-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Masih ada {questions.length - answeredCount} soal yang belum dijawab. Jawaban yang kosong akan bernilai 0.
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 h-11 rounded-xl text-xs font-bold text-slate-700"
              >
                Cek Kembali
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={executeSubmit}
                className="flex-1 h-11 rounded-xl bg-[#0F766E] hover:bg-[#0D655E] text-white text-xs font-bold shadow-md shadow-teal-900/10"
              >
                {submitting ? "Mengirimkan..." : "Ya, Kumpulkan"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
