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
  Maximize2,
  Lock,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  saveQuizAnswerFromSessionAction, 
  submitQuizAttemptFromSessionAction,
  recordQuizViolationFromSessionAction
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
  lockdownMode: "OFF" | "MONITOR" | "STRICT";
  violationCount: number;
  questions: StudentQuizQuestionView[];
  savedAnswers: SavedAnswerItem[];
}

export function QuizRunnerClient({
  token,
  attemptId,
  quizTitle,
  durationMinutes,
  startedAt,
  isRemedial,
  lockdownMode,
  violationCount: initialViolationCount,
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

  // Peringatan saat tab / jendela hendak ditutup atau navigasi tidak sengaja (Finding 5)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Ujian sedang berlangsung. Yakin ingin meninggalkan halaman ini?";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ============================================================
  // TAHAP 1 CBT INTEGRITY LOCKDOWN
  // ============================================================
  const lockdownActive = lockdownMode !== "OFF";
  const isStrict = lockdownMode === "STRICT";
  const MAX_STRIKES = 3;

  const [violationCount, setViolationCount] = useState(initialViolationCount);
  const [lockedBySystem, setLockedBySystem] = useState(false);
  // Gerbang fullscreen: lazy-init deteksi dukungan API (tanpa setState dalam effect)
  const [fsGateSupported] = useState(
    () =>
      typeof document !== "undefined" &&
      typeof document.documentElement.requestFullscreen === "function"
  );
  const [gateDismissed, setGateDismissed] = useState(false);
  const awaitingFullscreen = lockdownActive && fsGateSupported && !gateDismissed;
  const [fsPrompt, setFsPrompt] = useState(false); // ajakan kembali setelah keluar fullscreen
  const [tabConflict, setTabConflict] = useState(false);
  const [banner, setBanner] = useState<{ kind: string; awaySec: number } | null>(null);

  const awayStartRef = useRef<number | null>(null);
  const awayKindRef = useRef<"TAB_EXIT" | "FULLSCREEN_EXIT" | "WINDOW_BLUR">("TAB_EXIT");
  const lastReportAtRef = useRef(0);
  const pendingViolationsRef = useRef<Array<{ kind: "TAB_EXIT" | "FULLSCREEN_EXIT" | "WINDOW_BLUR"; awayMs: number }>>([]);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef<string>("");

  const reportViolation = useCallback(
    async (kind: "TAB_EXIT" | "FULLSCREEN_EXIT" | "WINDOW_BLUR", awayMs: number) => {
      lastReportAtRef.current = Date.now();
      setBanner({ kind, awaySec: Math.max(1, Math.round(awayMs / 1000)) });
      try {
        const res = await recordQuizViolationFromSessionAction(attemptId, kind, awayMs);
        if (res.success) {
          setViolationCount(res.violationCount ?? 0);
          if (res.locked) {
            setLockedBySystem(true);
            toast.error("Ujian diakhiri otomatis oleh sistem — 3x pelanggaran integritas.");
          }
          return;
        }
        if (res.error && res.error.includes("diakhiri sistem")) {
          setLockedBySystem(true);
          return;
        }
        pendingViolationsRef.current.push({ kind, awayMs });
      } catch {
        // Offline / network glitch: antrekan, kirim ulang saat fokus kembali
        pendingViolationsRef.current.push({ kind, awayMs });
      }
    },
    [attemptId]
  );

  const beginEpisode = useCallback((kind: "TAB_EXIT" | "FULLSCREEN_EXIT" | "WINDOW_BLUR") => {
    if (awayStartRef.current === null) {
      awayStartRef.current = Date.now();
      awayKindRef.current = kind;
    }
  }, []);

  const endEpisode = useCallback(() => {
    const start = awayStartRef.current;
    if (start === null) return;
    awayStartRef.current = null;
    const awayMs = Date.now() - start;
    // Dedupe badai event (visibility+blur+fullscreen berdekatan) — cukup satu laporan
    if (Date.now() - lastReportAtRef.current < 1500 && awayMs < 2000) return;
    void reportViolation(awayKindRef.current, awayMs);
  }, [reportViolation]);

  // Gerbang fullscreen & lampiran listener away-episode (hanya saat mode aktif)
  useEffect(() => {
    if (!lockdownActive) return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") beginEpisode("TAB_EXIT");
      else endEpisode();
    };
    const onBlur = () => beginEpisode("WINDOW_BLUR");
    const onFocus = () => endEpisode();
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      if (!fs) {
        beginEpisode("FULLSCREEN_EXIT");
        setFsPrompt(true);
      } else {
        setFsPrompt(false);
        endEpisode();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, [lockdownActive, beginEpisode, endEpisode]);

  // Kunci satu tab per kuis (BroadcastChannel berbasis shareToken)
  useEffect(() => {
    if (!lockdownActive) return;
    if (typeof BroadcastChannel === "undefined") return;
    tabIdRef.current = Math.random().toString(36).slice(2) + Date.now().toString(36);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`cbt-lock-${token}`);
    } catch {
      return;
    }
    bcRef.current = bc;
    bc.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as { type?: string; tabId?: string } | null;
      if (!msg || msg.tabId === tabIdRef.current) return;
      if (msg.type === "hello") {
        bc?.postMessage({ type: "ack", tabId: tabIdRef.current });
      } else if (msg.type === "ack") {
        setTabConflict(true);
      }
    };
    bc.postMessage({ type: "hello", tabId: tabIdRef.current });
    return () => {
      bc?.close();
      bcRef.current = null;
    };
  }, [lockdownActive, token]);

  // Blokir clipboard / menu konteks / seleksi / shortcut umum saat mode aktif
  useEffect(() => {
    if (!lockdownActive || lockedBySystem) return;
    const block = (e: Event) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (
        e.key === "F12" ||
        (mod && e.shiftKey && ["i", "j", "c"].includes(k)) ||
        (mod && ["t", "n", "w", "p", "c", "v", "x"].includes(k))
      ) {
        e.preventDefault();
      }
    };
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);
    document.addEventListener("contextmenu", block);
    document.addEventListener("selectstart", block);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("selectstart", block);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [lockdownActive, lockedBySystem]);

  // Kirim ulang pelanggaran yang tertunda saat kembali fokus / online
  useEffect(() => {
    if (!lockdownActive) return;
    const flush = () => {
      const queue = pendingViolationsRef.current;
      if (!queue.length || lockedBySystem) return;
      pendingViolationsRef.current = [];
      queue.forEach((v) => void reportViolation(v.kind, v.awayMs));
    };
    window.addEventListener("focus", flush);
    window.addEventListener("online", flush);
    return () => {
      window.removeEventListener("focus", flush);
      window.removeEventListener("online", flush);
    };
  }, [lockdownActive, lockedBySystem, reportViolation]);

  // Banner pelanggaran menghilang otomatis setelah 6 detik
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(t);
  }, [banner]);

  const enterSecureMode = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setGateDismissed(true);
    } catch {
      toast.error("Browser menolak mode layar penuh. Klik ulang tombol di bawah.");
    }
  };

  const reenterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      toast.error("Gagal kembali ke layar penuh. Coba lagi.");
    }
  };

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
    if (lockedBySystem) {
      toast.error("Ujian telah diakhiri sistem. Jawaban Anda sudah terkunci.");
      return;
    }
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

  // Calculate timer sync from wall-clock — dideklarasikan SETELAH handleAutoSubmitOnExpire
  // agar tidak ada akses variabel sebelum dideklarasikan (lint react-hooks).
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
    <div className="space-y-4 pt-1">
      {/* 1. Header Bar Kuis: Judul, Timer & Autosave Status */}
      <div className="p-4 sm:p-5 bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] font-extrabold uppercase text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
            Ujian Berlangsung
          </span>
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-0.5">
            {quizTitle}
          </h2>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Tahap 1: Badge Integritas */}
          {lockdownActive && !lockedBySystem && (
            <div
              className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold border uppercase tracking-wide ${
                isStrict
                  ? violationCount > 0
                    ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-slate-50 text-slate-500 border-slate-200"
              }`}
              title="Mode ujian aman aktif"
            >
              <ShieldAlert className="w-3 h-3" />
              {isStrict ? `Integritas ${violationCount}/${MAX_STRIKES}` : "Terpantau"}
            </div>
          )}

          {/* Timer Badge */}
          {timeLeftSec !== null && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-mono font-black border transition-colors shadow-xs ${
                timeLeftSec < 120
                  ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                  : timeLeftSec < 300
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-teal-50 text-[#0F766E] border-teal-200"
              }`}
            >
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{formatTimer(timeLeftSec)}</span>
            </div>
          )}

          {/* Autosave Status */}
          <div className="text-[10px] sm:text-[11px] text-slate-400">
            {saveStatus === "saving" ? (
              <span className="text-amber-600 font-medium">Menyimpan...</span>
            ) : saveStatus === "error" ? (
              <span className="text-rose-600 font-medium">Gagal simpan</span>
            ) : (
              <span className="text-teal-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" /> Tersimpan
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Navigator Soal Horizontal (Hanya Muncul di Mobile < lg) */}
      <div className="lg:hidden p-2.5 bg-white rounded-2xl border border-slate-200/80 overflow-x-auto shadow-xs">
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

      {/* 3. DUAL-PANEL CBT LAYOUT (Desktop >= lg: Lembar Soal di Kiri, Kisi Navigator di Kanan) */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-6 items-start space-y-4 lg:space-y-0">
        
        {/* PANEL KIRI: Lembar Soal Aktif + Tombol Navigasi Bawah */}
        <div className="lg:col-span-8 space-y-4">
          {currentQ && (
            <div className="p-5 sm:p-6 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
              {/* Header Soal */}
              <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100">
                <span className="font-extrabold text-[#0F766E] text-xs sm:text-sm">
                  Soal {currentIndex + 1} dari {questions.length}
                </span>
                <span className="text-[11px] sm:text-xs text-slate-400 font-medium">
                  Poin: {currentQ.points ?? 1}
                </span>
              </div>

              {/* Teks Pertanyaan */}
              <div className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed">
                {currentQ.text}
              </div>

              {/* Pilihan Ganda */}
              {currentQ.type === "MULTIPLE_CHOICE" && currentQ.options && (
                <div className="space-y-2.5 pt-1">
                  {(currentQ.options as string[]).map((optionText, optIdx) => {
                    const isSelected = currentAnswer?.selectedIndex === optIdx;
                    const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleSelectOption(optIdx)}
                        className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 active:scale-[0.99] ${
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
                        <span className="text-xs sm:text-sm leading-relaxed pt-0.5">
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
                  <label className="text-[11px] sm:text-xs font-bold text-slate-600 block">
                    Jawaban Esai Anda:
                  </label>
                  <textarea
                    rows={5}
                    value={currentAnswer?.essayAnswer || ""}
                    onChange={(e) => handleEssayChange(e.target.value)}
                    placeholder="Tuliskan jawaban esai kamu secara lengkap di sini..."
                    className="w-full p-3.5 text-xs sm:text-sm rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600 leading-relaxed"
                  />
                </div>
              )}
            </div>
          )}

          {/* Kontrol Navigasi Soal Bawah */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="h-11 rounded-2xl text-xs sm:text-sm font-bold text-slate-700 px-4 sm:px-5"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span>Sebelumnya</span>
            </Button>

            {currentIndex < questions.length - 1 ? (
              <Button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="h-11 rounded-2xl bg-[#0F766E] hover:bg-[#0D655E] text-white text-xs sm:text-sm font-bold px-4 sm:px-5"
              >
                <span>Selanjutnya</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold px-4 sm:px-5 shadow-sm"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                <span>Kumpulkan Ujian</span>
              </Button>
            )}
          </div>
        </div>

        {/* PANEL KANAN (Desktop >= lg): KISI NOMOR SOAL & PANEL INFORMASI UJIAN */}
        <div className="hidden lg:block lg:col-span-4 sticky top-20 space-y-4">
          <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            {/* Header Panel Navigator */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Daftar Nomor Soal
                </h3>
                <p className="text-[11px] text-slate-400">
                  {answeredCount} dari {questions.length} terjawab
                </p>
              </div>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/60">
                {Math.round((answeredCount / (questions.length || 1)) * 100)}% Selesai
              </span>
            </div>

            {/* Grid 5 Kolom Nomor Soal */}
            <div className="grid grid-cols-5 gap-2 max-h-[340px] overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const isAns = answers[q.id]?.selectedIndex !== null && answers[q.id]?.selectedIndex !== undefined;
                const isCurr = idx === currentIndex;

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
                      isCurr
                        ? "bg-[#0F766E] text-white ring-2 ring-teal-600/30 font-black shadow-xs scale-105"
                        : isAns
                        ? "bg-teal-50 text-teal-800 border border-teal-200 font-bold hover:bg-teal-100"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Keterangan Status / Legend */}
            <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-1 text-[10px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-md bg-[#0F766E] shrink-0"></span>
                <span>Aktif</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-md bg-teal-50 border border-teal-200 shrink-0"></span>
                <span>Terjawab</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-md bg-slate-100 shrink-0"></span>
                <span>Belum</span>
              </div>
            </div>

            {/* Tombol Kumpulkan di Panel Samping */}
            <div className="pt-2">
              <Button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                <span>Kumpulkan Ujian</span>
              </Button>
            </div>
          </div>
        </div>

      </div>

      {/* Tombol Kumpul Cepat (Hanya Muncul di Mobile Bagian Bawah) */}
      <div className="pt-2 lg:hidden">
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

      {/* ══════════ TAHAP 1 CBT INTEGRITY — OVERLAYS ══════════ */}

      {/* Banner pelanggaran (transien, 6 detik) */}
      {lockdownActive && banner && !lockedBySystem && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] w-[92vw] max-w-md px-4 py-3 rounded-2xl bg-rose-600 text-white shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 duration-300">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <div className="text-xs leading-snug">
            {isStrict ? (
              <span className="font-bold">
                Pelanggaran {violationCount}/{MAX_STRIKES} — kamu terdeteksi keluar ujian ({banner.awaySec} dtk).
                Setelah {MAX_STRIKES}x, ujian diakhiri otomatis & jawaban dikunci.
              </span>
            ) : (
              <span className="font-bold">
                Keluar ujian terdeteksi ({banner.awaySec} dtk) — kejadian ini tercatat untuk guru.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Gerbang fullscreen sebelum mulai */}
      {lockdownActive && awaitingFullscreen && !tabConflict && (
        <div className="fixed inset-0 z-[80] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Maximize2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-slate-900">Mode Ujian Aman</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Kuis ini dilindungi integritas:{isStrict ? " layar penuh wajib; keluar tab / layar penuh " + MAX_STRIKES + "x = ujian diakhiri otomatis & jawaban dikunci." : " aktivitas keluar ujian dicatat untuk guru."}{" "}
                Salin-tempel dan menu klik kanan dimatikan.
              </p>
            </div>
            <Button
              onClick={enterSecureMode}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
            >
              <Maximize2 className="w-3.5 h-3.5 mr-1.5" /> Masuk Layar Penuh & Mulai
            </Button>
            <p className="text-[10px] text-slate-400">Timer telah berjalan sejak halaman dibuka.</p>
          </div>
        </div>
      )}

      {/* Konflik tab: ujian sudah berjalan di tab lain */}
      {tabConflict && (
        <div className="fixed inset-0 z-[90] bg-slate-950/95 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center space-y-3 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">Ujian Sudah Berjalan di Tab Lain</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Tutup tab ini dan lanjutkan ujian pada tab yang sudah terbuka. Membuka ujian di lebih dari satu tab tidak diizinkan.
            </p>
            <Button variant="outline" onClick={() => window.close()} className="w-full rounded-xl text-xs font-bold">
              Tutup Tab Ini
            </Button>
          </div>
        </div>
      )}

      {/* Ajakan kembali ke fullscreen setelah keluar (belum terkunci) */}
      {lockdownActive && fsPrompt && !lockedBySystem && !awaitingFullscreen && !tabConflict && (
        <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-white rounded-3xl p-5 text-center space-y-3 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Maximize2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Kembali ke Mode Ujian</h3>
            <p className="text-[11px] text-slate-500">Kamu keluar dari layar penuh. Pelanggaran telah tercatat — kembali sekarang untuk melanjutkan.</p>
            <Button onClick={reenterFullscreen} className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold">
              <Maximize2 className="w-3.5 h-3.5 mr-1.5" /> Kembali ke Layar Penuh
            </Button>
          </div>
        </div>
      )}

      {/* Layar terkunci sistem: ujian diakhiri otomatis, jawaban read-only */}
      {lockedBySystem && (
        <div className="fixed inset-0 z-[95] bg-slate-950/95 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">Ujian Diakhiri Otomatis</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                Sistem mendeteksi {MAX_STRIKES}x pelanggaran integritas (keluar tab / layar penuh).
                Jawabanmu hingga saat ini <span className="font-bold text-slate-700">sudah dikirim & dikunci</span> — tidak dapat diubah.
              </p>
            </div>
            <div className="flex items-center justify-center gap-4 py-2 px-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
              <div>
                <div className="text-lg font-black text-slate-900">{answeredCount}/{questions.length}</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Soal terjawab</div>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <div className="text-lg font-black text-rose-600">{violationCount}</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Pelanggaran</div>
              </div>
            </div>
            <Button
              onClick={() => router.push(`/siswa/portal/quiz/${token}/review`)}
              className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Lihat Hasil & Pembahasan
            </Button>
            <p className="text-[10px] text-slate-400">Hubungi guru bila kamu merasa ini keliru — guru dapat memberi kesempatan remedial.</p>
          </div>
        </div>
      )}
    </div>
  );
}
