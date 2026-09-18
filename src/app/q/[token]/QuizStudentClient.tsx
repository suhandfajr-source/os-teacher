"use client";

/**
 * Public student quiz flow (no login):
 * select name from roster → work through shuffled questions with timer →
 * submit → instant score.
 *
 * Light theme using the app's design tokens for guaranteed contrast.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  FileQuestion,
  Clock,
  Loader2,
  Search,
  CircleCheck,
  XCircle,
  ArrowRight,
  GraduationCap,
  School,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPublicQuizAction,
  startQuizAttemptAction,
  submitQuizAttemptAction,
  getPublicAttemptResultAction,
} from "@/modules/quiz/quiz.actions";
import { PublicQuizView, StudentQuizQuestionView, AttemptResultView } from "@/modules/quiz/quiz.types";

type Stage = "IDENTIFY" | "PIN" | "LOADING_QUIZ" | "WORKING" | "RESULT";

export function QuizStudentClient({ token }: { token: string }) {
  const [stage, setStage] = useState<Stage>("IDENTIFY");
  const [quiz, setQuiz] = useState<PublicQuizView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [studentId, setStudentId] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState("");

  const [questions, setQuestions] = useState<StudentQuizQuestionView[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [result, setResult] = useState<AttemptResultView | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Load public quiz info
  useEffect(() => {
    getPublicQuizAction(token).then((res) => {
      if (res.success && res.data) {
        setQuiz(res.data);
      } else {
        setError(res.error ?? "Quiz tidak ditemukan");
      }
    });
  }, [token]);

  // Live countdown for upcoming scheduled exams (Story 2.1)
  const [upcomingSeconds, setUpcomingSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (!quiz?.isUpcoming || !quiz.validFrom) return;
    const startMs = new Date(quiz.validFrom).getTime();
    const tick = () => {
      const diff = Math.max(0, Math.round((startMs - Date.now()) / 1000));
      setUpcomingSeconds(diff);
      if (diff <= 0) {
        // Exam window has arrived! Refresh public view
        getPublicQuizAction(token).then((res) => {
          if (res.success && res.data) setQuiz(res.data);
        });
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [quiz?.isUpcoming, quiz?.validFrom, token]);

  // Offline resilience / LocalStorage Autosave (Story 2.2)
  const storageKey = studentId ? `ai_teacher_quiz_answers_${token}_${studentId}` : null;

  // Autosave answers on change to localStorage (MCQ + Essay)
  useEffect(() => {
    if (stage === "WORKING" && storageKey) {
      const hasMcq = Object.keys(answers).length > 0;
      const hasEssays = Object.keys(essayAnswers).length > 0;
      if (hasMcq || hasEssays) {
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({ mcq: answers, essays: essayAnswers })
          );
        } catch {}
      }
    }
  }, [answers, essayAnswers, stage, storageKey]);

  const filteredRoster = (quiz?.roster ?? []).filter((r) =>
    r.fullName.toLowerCase().includes(nameFilter.toLowerCase())
  );

  const handleStart = async (sid: string, name: string) => {
    setStudentId(sid);
    setStudentName(name);
    setPinInput("");
    setPinError(null);
    setStage("PIN");
  };

  const handlePinSubmit = async () => {
    setStage("LOADING_QUIZ");
    const res = await startQuizAttemptAction(token, studentId, pinInput);
    if (res.success && res.data) {
      setQuestions(res.data.questions);
      setStartedAt(new Date(res.data.startedAt).getTime());
      if (storageKey) {
        try {
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === "object") {
              if (parsed.mcq && typeof parsed.mcq === "object") {
                setAnswers(parsed.mcq);
              } else if (!parsed.essays) {
                setAnswers(parsed);
              }
              if (parsed.essays && typeof parsed.essays === "object") {
                setEssayAnswers(parsed.essays);
              }
              toast.info("Jawaban tersimpan di perangkat dipulihkan otomatis");
            }
          }
        } catch {}
      }
      setStage("WORKING");
    } else if (res.alreadySubmitted) {
      // Let the student review their own result (score + correct/wrong marks,
      // without the answer key).
      const resRes = await getPublicAttemptResultAction(token, studentId);
      if (resRes.success && resRes.data) {
        setResult({
          score: resRes.data.score,
          totalPoints: 100,
          passed: resRes.data.passed,
          isRemedial: resRes.data.isRemedial,
          needsGrading: resRes.data.needsGrading,
          submittedAt: resRes.data.submittedAt,
          perQuestion: resRes.data.perQuestion.map((pq) => ({
            questionText: pq.questionText,
            selectedIndex: null,
            isCorrect: pq.isCorrect,
            pointsEarned: pq.pointsEarned,
            pointsMax: pq.pointsMax,
          })),
        });
        setStage("RESULT");
      } else {
        setError(res.error ?? "Kamu sudah mengerjakan quiz ini");
        setStage("IDENTIFY");
      }
    } else if (res.wrongPin) {
      setPinError(res.error ?? "PIN salah");
      setStage("PIN");
    } else {
      setError(res.error ?? "Gagal memulai quiz");
      setStage("IDENTIFY");
    }
  };

  const handleSubmit = useCallback(
    async (auto = false) => {
      if (hasSubmitted) return;
      const totalAnswered =
        Object.keys(answers).length +
        Object.values(essayAnswers).filter((t) => t.trim().length > 0).length;
      if (!auto && totalAnswered < questions.length) {
        const unanswered = questions.length - totalAnswered;
        if (!confirm(`Masih ada ${unanswered} soal belum dijawab. Kumpulkan sekarang?`)) return;
      }
      setHasSubmitted(true);
      setIsSubmitting(true);
      try {
        const payloadMap = new Map<string, { questionId: string; selectedIndex?: number; essayAnswer?: string }>();
        for (const [qid, sIdx] of Object.entries(answers)) {
          payloadMap.set(qid, { questionId: qid, selectedIndex: sIdx });
        }
        for (const [qid, text] of Object.entries(essayAnswers)) {
          const item = payloadMap.get(qid) ?? { questionId: qid };
          item.essayAnswer = text;
          payloadMap.set(qid, item);
        }

        const res = await submitQuizAttemptAction({
          token,
          studentId,
          answers: Array.from(payloadMap.values()),
        });
        if (res.success && res.data) {
          if (storageKey) {
            try { localStorage.removeItem(storageKey); } catch {}
          }
          setResult(res.data);
          setStage("RESULT");
        } else {
          toast.error(res.error ?? "Gagal mengumpulkan");
          setHasSubmitted(false);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [token, studentId, answers, essayAnswers, questions.length, hasSubmitted, storageKey]
  );

  // Timer — declared after handleSubmit so the callback is in scope.
  useEffect(() => {
    if (stage !== "WORKING" || !startedAt || !quiz?.durationMinutes) return;
    const endsAt = startedAt + quiz.durationMinutes * 60_000;
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left <= 0) {
        void handleSubmit(true);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [stage, startedAt, quiz?.durationMinutes, handleSubmit]);

  // ---------- Error state ----------
  if (error) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-10 space-y-3">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-lg font-semibold">Tidak Bisa Membuka Quiz</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- Loading public info ----------
  if (!quiz) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ---------- Not published ----------
  if (quiz.status !== "PUBLISHED") {
    return (
      <Shell title={quiz.title}>
        <div className="text-center space-y-2 py-8">
          <Clock className="h-10 w-10 text-muted-foreground/50 mx-auto" />
          <p className="text-muted-foreground">
            {quiz.status === "DRAFT" ? "Quiz belum dibuka." : "Quiz sudah ditutup oleh guru."}
          </p>
        </div>
      </Shell>
    );
  }

  // ---------- Scheduled Window: Upcoming Exam Countdown (Story 2.1) ----------
  if (quiz.isUpcoming && quiz.validFrom) {
    const hours = upcomingSeconds !== null ? Math.floor(upcomingSeconds / 3600) : 0;
    const mins = upcomingSeconds !== null ? Math.floor((upcomingSeconds % 3600) / 60) : 0;
    const secs = upcomingSeconds !== null ? upcomingSeconds % 60 : 0;
    const startDateFormatted = new Date(quiz.validFrom).toLocaleString("id-ID", {
      dateStyle: "full",
      timeStyle: "short",
    });

    return (
      <Shell title={quiz.title} description={quiz.description}>
        <div className="text-center space-y-6 py-8">
          <div className="mx-auto rounded-full bg-amber-100 p-4 w-fit">
            <Calendar className="h-10 w-10 text-amber-600" />
          </div>
          <div>
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 bg-amber-50 mb-2">
              Ujian Terjadwal
            </Badge>
            <h2 className="text-xl font-bold">Ujian Belum Dimulai</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Kuis ini dijadwalkan mulai pada:
            </p>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {startDateFormatted} WIB
            </p>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4 max-w-xs mx-auto">
            <p className="text-xs text-muted-foreground mb-1">Dimulai dalam:</p>
            <p className="text-3xl font-extrabold tabular-nums tracking-wider text-primary">
              {String(hours).padStart(2, "0")}:{String(mins).padStart(2, "0")}:
              {String(secs).padStart(2, "0")}
            </p>
          </div>

          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Halaman ini akan otomatis membuka daftar peserta begitu jam ujian tiba. Harap tetap berada di halaman ini.
          </p>
        </div>
      </Shell>
    );
  }

  // ---------- Result ----------
  if (stage === "RESULT" && result) {
    return (
      <Shell title={quiz.title}>
        <div className="text-center space-y-4 py-4">
          <div
            className={cn(
              "mx-auto rounded-full p-5 w-fit",
              result.passed ? "bg-emerald-100" : "bg-amber-100"
            )}
          >
            <GraduationCap
              className={cn("h-12 w-12", result.passed ? "text-emerald-600" : "text-amber-600")}
            />
          </div>
          <div>
            {result.needsGrading ? (
              <div className="space-y-1 mb-2">
                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                  Menunggu Koreksi Guru
                </Badge>
                <p className="text-muted-foreground text-xs">
                  Nilai akhir akan diperbarui setelah gurumu selesai memeriksa soal esai.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nilai Kamu</p>
            )}
            <p
              className={cn(
                "text-6xl font-extrabold",
                result.passed ? "text-emerald-600" : "text-amber-600"
              )}
            >
              {result.score}
            </p>
            {quiz.standardScore != null && (
              <p className="text-muted-foreground text-xs mt-1">
                {result.passed
                  ? `Selamat! Kamu mencapai standar ${quiz.standardScore}`
                  : `Di bawah standar ${quiz.standardScore} — gurumu mungkin memberikan remedial`}
              </p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto text-sm">
            <div className="rounded-lg bg-muted py-3">
              <p className="font-bold text-lg text-emerald-600">
                {result.perQuestion.filter((q) => q.isCorrect).length}
              </p>
              <p className="text-xs text-muted-foreground">Benar</p>
            </div>
            <div className="rounded-lg bg-muted py-3">
              <p className="font-bold text-lg text-rose-600">
                {result.perQuestion.filter((q) => q.isCorrect === false).length}
              </p>
              <p className="text-xs text-muted-foreground">Salah</p>
            </div>
            <div className="rounded-lg bg-muted py-3">
              <p className="font-bold text-lg">{result.perQuestion.length}</p>
              <p className="text-xs text-muted-foreground">Total Soal</p>
            </div>
          </div>
          <p className="text-muted-foreground text-xs max-w-md mx-auto">
            Kunci jawaban dan pembahasan akan dibahas guru di kelas. Coba hitung ulang soal yang
            kamu anggap sulit!
          </p>
          {result.submittedAt && (
            <p className="text-muted-foreground text-[11px]">
              Dikumpulkan {new Date(result.submittedAt).toLocaleString("id-ID")}
              {result.isRemedial ? " · Remedial" : ""}
            </p>
          )}
        </div>
      </Shell>
    );
  }

  // ---------- Identify ----------
  if (stage === "IDENTIFY") {
    return (
      <Shell title={quiz.title} description={quiz.description}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary" className="gap-1">
              <FileQuestion className="h-3 w-3" /> Quiz Pilihan Ganda
            </Badge>
            {quiz.durationMinutes && (
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" /> {quiz.durationMinutes} menit
              </Badge>
            )}
            <Badge variant="secondary">Dikerjakan 1x</Badge>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Pilih namamu untuk mulai:</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Cari nama…"
                className="pl-9"
              />
            </div>
            <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border divide-y">
              {filteredRoster.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-6">Nama tidak ditemukan</p>
              ) : (
                filteredRoster.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleStart(r.id, r.fullName)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors flex items-center justify-between"
                  >
                    {r.fullName}
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                  </button>
                ))
              )}
            </div>
          </div>
          <p className="text-muted-foreground text-xs text-center">
            Pastikan memilih nama yang benar — kesalahan memilih nama akan tercatat sebagai nilai
            temanmu.
          </p>
        </div>
      </Shell>
    );
  }

  // ---------- PIN (Story 2.3: Room PIN vs Individual PIN) ----------
  if (stage === "PIN") {
    const isClassroomMode = quiz.accessMode === "CLASSROOM_PIN";
    const expectedLength = isClassroomMode ? 6 : 4;

    return (
      <Shell title={quiz.title} description={quiz.description}>
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">
              Mengerjakan sebagai <span className="font-semibold text-foreground">{studentName}</span>
            </p>
            <p className="text-2xl font-bold tracking-tight">
              {isClassroomMode ? "Masukkan Kode Kelas" : "Masukkan PIN Siswa"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isClassroomMode
                ? "Kode 6 digit tertera di papan tulis atau layar proyektor kelas."
                : "PIN 4 digit diberikan gurumu bersama link quiz ini."}
            </p>
          </div>
          <div>
            <Input
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.replace(/\D/g, "").slice(0, expectedLength));
                setPinError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && pinInput.length === expectedLength) void handlePinSubmit();
              }}
              inputMode="numeric"
              autoFocus
              placeholder={isClassroomMode ? "••••••" : "••••"}
              className={cn(
                "text-center text-3xl font-bold tracking-[0.4em] h-14",
                pinError && "border-destructive"
              )}
            />
            {pinError && <p className="text-xs text-destructive mt-2 text-center">{pinError}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setStage("IDENTIFY")}>
              Kembali
            </Button>
            <Button
              className="flex-1"
              disabled={pinInput.length !== expectedLength}
              onClick={() => void handlePinSubmit()}
            >
              Mulai Quiz
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  // ---------- Loading ----------
  if (stage === "LOADING_QUIZ") {
    return (
      <Shell title={quiz.title}>
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Menyiapkan soal…</p>
        </div>
      </Shell>
    );
  }

  // ---------- Working ----------
  const current = questions[currentIdx];
  const answeredCount =
    Object.keys(answers).length +
    Object.values(essayAnswers).filter((t) => t.trim().length > 0).length;
  const mm = remainingSeconds !== null ? Math.floor(remainingSeconds / 60) : null;
  const ss = remainingSeconds !== null ? remainingSeconds % 60 : null;

  return (
    <Shell
      title={quiz.title}
      headerRight={
        quiz.durationMinutes && remainingSeconds !== null ? (
          <Badge
            variant="outline"
            className={cn(
              "text-sm tabular-nums gap-1",
              remainingSeconds < 60 && "border-destructive/50 text-destructive animate-pulse"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            {mm}:{String(ss).padStart(2, "0")}
          </Badge>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Progress */}
        <div>
          <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
            <span>
              Soal {currentIdx + 1} dari {questions.length} · {answeredCount} terjawab
            </span>
            <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
              <CircleCheck className="h-3 w-3" /> Tersimpan di HP
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs">
              {current?.type === "ESSAY"
                ? "Soal Esai / Uraian"
                : current?.type === "SHORT_ANSWER"
                ? "Soal Isian Singkat"
                : "Pilihan Ganda"}
            </Badge>
            <span className="text-xs text-muted-foreground">{current?.points} poin</span>
          </div>
          <p className="text-lg font-medium leading-relaxed">{current?.text}</p>

          {current?.type === "ESSAY" || current?.type === "SHORT_ANSWER" || !current?.options?.length ? (
            <div className="mt-4 space-y-2">
              <label className="text-xs text-muted-foreground block font-medium">
                Tuliskan jawaban lengkapmu di bawah ini:
              </label>
              <Textarea
                rows={6}
                value={essayAnswers[current.id] ?? ""}
                onChange={(e) =>
                  setEssayAnswers((prev) => ({ ...prev, [current.id]: e.target.value }))
                }
                placeholder="Ketik uraian jawaban di sini..."
                className="text-sm leading-relaxed bg-background"
              />
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {current?.options.map((opt, oIdx) => (
                <button
                  key={oIdx}
                  onClick={() => setAnswers((a) => ({ ...a, [current.id]: oIdx }))}
                  className={cn(
                    "w-full text-left rounded-xl border px-4 py-3 text-sm transition-all",
                    answers[current.id] === oIdx
                      ? "border-emerald-500 bg-emerald-50 font-medium"
                      : "hover:border-primary/40"
                  )}
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs mr-3">
                    {String.fromCharCode(65 + oIdx)}
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          >
            Sebelumnya
          </Button>
          {currentIdx < questions.length - 1 ? (
            <Button onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}>
              Berikutnya
            </Button>
          ) : (
            <Button
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4" />}
              Kumpulkan Jawaban
            </Button>
          )}
        </div>
      </div>
    </Shell>
  );
}

// Shared light shell
function Shell({
  title,
  description,
  headerRight,
  children,
}: {
  title: string;
  description?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/40">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <School className="h-3.5 w-3.5" /> KLASSA Quiz Hub
            </div>
            <h1 className="text-xl font-bold">{title}</h1>
            {description && <p className="text-muted-foreground text-sm mt-1">{description}</p>}
          </div>
          {headerRight}
        </div>
        <Card>
          <CardContent className="p-5">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
