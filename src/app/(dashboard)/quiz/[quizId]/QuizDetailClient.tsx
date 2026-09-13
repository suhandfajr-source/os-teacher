"use client";

/**
 * Quiz detail for teachers: share link, monitoring roster attempts,
 * remedial actions, and gradebook publishing.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Copy,
  Share2,
  Users,
  CircleCheck,
  Circle,
  RotateCcw,
  BookCheck,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  QuestionListEditor,
  EditableQuestion,
} from "@/components/quiz/QuestionListEditor";
import { Pencil, CheckCircle2, X, Plus, FileQuestion, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getStudentAttemptDetailAction } from "@/modules/quiz/quiz.actions";
import {
  getQuizDetailAction,
  setQuizStatusAction,
  openRemedialAttemptAction,
  publishScoresToAssessmentAction,
  deleteQuizAction,
  updateQuizQuestionsAction,
  resetAllAttemptsAction,
} from "@/modules/quiz/quiz.actions";

interface QuizDetail {
  quiz: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    shareToken: string;
    durationMinutes?: number | null;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    standardScore?: number | null;
    deadline?: string | null;
  };
  contextLabel: string;
  questions: Array<{
    id: string;
    order: number;
    text: string;
    options: string[];
    correctIndex: number | null;
    points: number;
  }>;
  roster: Array<{
    studentId: string;
    fullName: string;
    attemptStatus: string;
    score: number | null;
    isRemedial: boolean;
    startedAt?: string;
    submittedAt?: string;
  }>;
  assessments: Array<{ id: string; title: string; date: string }>;
}

interface QuizDetailClientProps {
  quizId: string;
}

export function QuizDetailClient({ quizId }: QuizDetailClientProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<QuizDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  const [answerSheet, setAnswerSheet] = useState<{
    open: boolean;
    loading: boolean;
    data: {
      studentName: string;
      score: number;
      submittedAt: string;
      isRemedial: boolean;
      perQuestion: Array<{
        questionText: string;
        options: string[];
        selectedIndex: number | null;
        correctIndex: number | null;
        pointsEarned: number;
        pointsMax: number;
      }>;
    } | null;
  }>({ open: false, loading: false, data: null });
  const [isEditingQuestions, setIsEditingQuestions] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [editQuestions, setEditQuestions] = useState<EditableQuestion[]>([]);
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);

  const load = useCallback(async () => {
    const res = await getQuizDetailAction(quizId);
    if (res.success) {
      setDetail(res.data as QuizDetail);
    } else {
      setError(res.error ?? "Gagal memuat quiz");
    }
  }, [quizId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- window only exists client-side
    setOrigin(window.location.origin);
    void load();
  }, [load]);

  const shareUrl = useMemo(
    () => (detail && origin ? `${origin}/q/${detail.quiz.shareToken}` : ""),
    [detail, origin]
  );

  const handleViewAnswers = async (studentId: string) => {
    setAnswerSheet({ open: true, loading: true, data: null });
    const res = await getStudentAttemptDetailAction(quizId, studentId);
    if (res.success && res.data) {
      setAnswerSheet({ open: true, loading: false, data: res.data });
    } else {
      setAnswerSheet({ open: false, loading: false, data: null });
      toast.error(res.error ?? "Gagal memuat jawaban");
    }
  };

  const run = async (fn: () => Promise<{ success: boolean; error?: string }>, successMsg: string) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res.success) {
        toast.success(successMsg);
        await load();
      } else {
        toast.error(res.error ?? "Aksi gagal");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link quiz disalin! Bagikan ke siswa via WhatsApp/group kelas.");
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-3">
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => router.push("/quiz")}>
          Kembali ke Daftar Quiz
        </Button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="max-w-4xl mx-auto py-16 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { quiz, contextLabel, questions, roster, assessments } = detail;
  const submitted = roster.filter((r) => r.attemptStatus === "SUBMITTED");
  const belowStandard = submitted.filter(
    (r) => quiz.standardScore != null && (r.score ?? 0) < quiz.standardScore
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 pb-16">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/quiz")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{quiz.title}</h1>
            <Badge
              variant={
                quiz.status === "PUBLISHED"
                  ? "default"
                  : quiz.status === "CLOSED"
                  ? "secondary"
                  : "outline"
              }
            >
              {quiz.status === "PUBLISHED" ? "Aktif" : quiz.status === "CLOSED" ? "Ditutup" : "Draft"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {contextLabel} · {questions.length} soal
            {quiz.durationMinutes ? ` · ${quiz.durationMinutes} menit` : ""}
            {quiz.standardScore != null ? ` · KKM ${quiz.standardScore}` : ""}
          </p>
        </div>
      </div>

      {/* Share */}
      <Card className={quiz.status === "PUBLISHED" ? "border-emerald-500/40" : ""}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Bagikan ke Siswa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quiz.status === "PUBLISHED" ? (
            <>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs">
                  {shareUrl || "memuat…"}
                </code>
                <Button size="sm" variant="outline" onClick={handleCopyLink} className="gap-1 shrink-0">
                  <Copy className="h-3.5 w-3.5" /> Salin
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Siswa membuka link → memilih namanya → mengerjakan. Tidak perlu login.
              </p>
            </>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {quiz.status === "DRAFT"
                  ? "Aktifkan quiz agar siswa bisa mengerjakan lewat link."
                  : "Quiz ditutup. Aktifkan kembali bila perlu."}
              </p>
              <div className="flex gap-2">
                {quiz.status === "DRAFT" && (
                  <Button
                    size="sm"
                    className="gap-1"
                    disabled={busy}
                    onClick={() => run(() => setQuizStatusAction(quiz.id, "PUBLISHED"), "Quiz aktif!")}
                  >
                    <Share2 className="h-4 w-4" /> Aktifkan
                  </Button>
                )}
                {quiz.status === "CLOSED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(() => setQuizStatusAction(quiz.id, "PUBLISHED"), "Quiz dibuka kembali")
                    }
                  >
                    Buka Kembali
                  </Button>
                )}
              </div>
            </div>
          )}
          {quiz.status === "PUBLISHED" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={busy}
              onClick={() => {
                if (confirm("Tutup quiz ini? Siswa tidak akan bisa mengerjakan lagi.")) {
                  run(() => setQuizStatusAction(quiz.id, "CLOSED"), "Quiz ditutup");
                }
              }}
            >
              <XCircle className="h-4 w-4 mr-1" /> Tutup Quiz
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Questions: view & edit */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileQuestion className="h-4 w-4" /> Soal ({questions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditingQuestions ? (
            <>
              {submitted.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <strong>{submitted.length} siswa sudah mengerjakan.</strong> Setelah menyimpan,
                  kamu akan ditanya apakah mereka boleh mengulang dengan soal terbaru. Nilai lama
                  yang sudah terkumpul tidak berubah kecuali kamu izinkan ulang.
                </div>
              )}
              <QuestionListEditor questions={editQuestions} onChange={setEditQuestions} />
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={isSavingQuestions}
                onClick={() =>
                  setEditQuestions((qs) => [
                    ...qs,
                    {
                      id: `edit-${Date.now()}`,
                      text: "",
                      options: ["", "", "", ""],
                      correctIndex: 0,
                      points: 1,
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4" /> Tambah Soal
              </Button>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  disabled={isSavingQuestions}
                  onClick={() => {
                    setIsEditingQuestions(false);
                    setEditQuestions([]);
                    setShowQuestions(false);
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> Batal
                </Button>
                <Button
                  disabled={isSavingQuestions || editQuestions.length === 0}
                  onClick={async () => {
                    if (
                      editQuestions.some(
                        (q) => !q.text.trim() || q.options.some((o) => !o.trim())
                      )
                    ) {
                      toast.error("Masih ada teks soal atau opsi yang kosong");
                      return;
                    }
                    setIsSavingQuestions(true);
                    try {
                      const res = await updateQuizQuestionsAction(
                        quiz.id,
                        editQuestions.map((q) => ({
                          text: q.text.trim(),
                          options: q.options,
                          correctIndex: q.correctIndex,
                          points: q.points,
                          explanation: q.explanation,
                        }))
                      );
                      if (!res.success) {
                        toast.error(res.error ?? "Gagal menyimpan soal");
                        return;
                      }
                      if (quiz.status === "PUBLISHED" && submitted.length > 0) {
                        const allowRetake = confirm(
                          "Soal tersimpan.\n\nIzinkan " +
                            submitted.length +
                            " siswa yang sudah mengerjakan untuk mengulang dengan soal terbaru?\n\n(Oke = ya, nilai & jawaban lama mereka dikosongkan agar diukur ulang)"
                        );
                        if (allowRetake) {
                          const resetRes = await resetAllAttemptsAction(quiz.id);
                          if (resetRes.success && resetRes.data) {
                            toast.success(
                              "Soal tersimpan - " +
                                resetRes.data.reset +
                                " siswa diberi kesempatan mengulang"
                            );
                          }
                        } else {
                          toast.success("Soal tersimpan - berlaku untuk pengerjaan berikutnya");
                        }
                      } else {
                        toast.success("Soal tersimpan");
                      }
                      setIsEditingQuestions(false);
                      setEditQuestions([]);
                      setShowQuestions(false);
                      await load();
                    } finally {
                      setIsSavingQuestions(false);
                    }
                  }}
                  className="gap-1"
                >
                  <CheckCircle2 className="h-4 w-4" /> Simpan Soal
                </Button>
              </div>
            </>
          ) : (
            <>
              {!showQuestions && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Soal disembunyikan agar tidak terlihat sekilas saat membagikan layar.
                  </p>
                  <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={() => setShowQuestions(true)}>
                    <Eye className="h-3.5 w-3.5" /> Lihat Soal
                  </Button>
                </div>
              )}
              <div className={cn("divide-y", !showQuestions && "hidden")}>
                {questions.map((q) => (
                  <div key={q.id} className="py-3">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0">
                        {q.order}
                      </Badge>
                      <p className="text-sm font-medium flex-1">{q.text}</p>
                      <Badge variant="secondary" className="shrink-0">
                        {q.points} poin
                      </Badge>
                    </div>
                    <div className="mt-2 grid sm:grid-cols-2 gap-1.5 pl-8">
                      {q.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={
                            "text-xs rounded-md px-2 py-1.5 flex items-center gap-1.5 " +
                            (q.correctIndex === oIdx
                              ? "bg-emerald-50 text-emerald-800 font-medium"
                              : "text-muted-foreground")
                          }
                        >
                          <span className="font-semibold">
                            {String.fromCharCode(65 + oIdx)}.
                          </span>
                          {opt}
                          {q.correctIndex === oIdx && (
                            <CheckCircle2 className="h-3.5 w-3.5 ml-auto shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {questions.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Belum ada soal.</p>
                )}
              </div>
              {showQuestions && questions.length > 0 && (
                <p className="text-xs text-muted-foreground -mt-2">
                  Menampilkan {questions.length} soal beserta kunci jawabannya. Sembunyikan kembali bila perlu.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  onClick={() => setShowQuestions(false)}
                >
                  Sembunyikan
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    setEditQuestions(
                      questions.map((q) => ({
                        id: q.id,
                        text: q.text,
                        options: q.options,
                        correctIndex: q.correctIndex ?? 0,
                        points: q.points,
                      }))
                    );
                    setIsEditingQuestions(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit Soal
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Roster monitoring */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Siswa ({roster.length})
            {quiz.standardScore != null && belowStandard.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {belowStandard.length} di bawah KKM
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {roster.map((r) => {
              const needsRemedial =
                r.attemptStatus === "SUBMITTED" &&
                quiz.standardScore != null &&
                (r.score ?? 0) < quiz.standardScore;
              return (
                <div key={r.studentId} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {r.attemptStatus === "SUBMITTED" ? (
                      <CircleCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                    ) : r.attemptStatus === "IN_PROGRESS" ? (
                      <Circle className="h-5 w-5 text-amber-500 fill-amber-500/30 shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.attemptStatus === "NOT_STARTED"
                          ? "Belum mengerjakan"
                          : r.attemptStatus === "IN_PROGRESS"
                          ? "Sedang mengerjakan…"
                          : `Selesai ${r.submittedAt ? new Date(r.submittedAt).toLocaleString("id-ID") : ""}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.score != null && (
                      <Badge
                        variant={
                          needsRemedial ? "destructive" : "secondary"
                        }
                      >
                        {r.score}
                      </Badge>
                    )}
                    {r.attemptStatus === "SUBMITTED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 h-8"
                        onClick={() => handleViewAnswers(r.studentId)}
                        title="Lihat lembar jawaban siswa"
                      >
                        <Eye className="h-3.5 w-3.5" /> Jawaban
                      </Button>
                    )}
                    {needsRemedial && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-8"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => openRemedialAttemptAction(quiz.id, r.studentId),
                            `Kesempatan remedial dibuka untuk ${r.fullName}`
                          )
                        }
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Remedial
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {roster.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Belum ada siswa terdaftar di kelas ini.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gradebook publishing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookCheck className="h-4 w-4" /> Terbitkan Nilai ke Penilaian
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Masukkan skor quiz ({submitted.length} nilai terkumpul) ke daftar penilaian yang sudah
            ada di kelas ini. Skor dinormalisasi ke skala penilaian.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Label htmlFor="assessment" className="sr-only">
                Pilih penilaian
              </Label>
              <select
                id="assessment"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                defaultValue=""
                onChange={async (e) => {
                  const assessmentId = e.target.value;
                  if (!assessmentId) return;
                  await run(
                    () => publishScoresToAssessmentAction(quiz.id, assessmentId),
                    "Nilai berhasil diterbitkan ke penilaian"
                  );
                  e.target.value = "";
                }}
              >
                <option value="">— Pilih penilaian tujuan —</option>
                {assessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({new Date(a.date).toLocaleDateString("id-ID")})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {assessments.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Belum ada penilaian di kelas ini. Buat dulu di menu Assessment.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={busy}
          onClick={async () => {
            if (!confirm("Hapus quiz ini beserta semua jawaban siswa?")) return;
            const res = await deleteQuizAction(quiz.id);
            if (res.success) {
              toast.success("Quiz dihapus");
              router.push("/quiz");
            } else {
              toast.error(res.error ?? "Gagal menghapus");
            }
          }}
        >
          Hapus Quiz
        </Button>
      </div>
      {/* Answer sheet dialog */}
      <Dialog open={answerSheet.open} onOpenChange={(open) => setAnswerSheet((s) => ({ ...s, open }))}>
        <DialogContent className="max-w-2xl flex flex-col" style={{ maxHeight: "85vh" }}>
          <DialogHeader>
            <DialogTitle>
              Lembar Jawaban — {answerSheet.data?.studentName ?? "…"}
            </DialogTitle>
          </DialogHeader>
          {answerSheet.loading || !answerSheet.data ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0 -mx-1 px-1" style={{ overflowY: "auto", minHeight: 0 }}>
              <div className="flex items-center gap-3 text-sm">
                <Badge variant={answerSheet.data.score >= (quiz.standardScore ?? 0) ? "secondary" : "destructive"}>
                  Nilai {answerSheet.data.score}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  Selesai {new Date(answerSheet.data.submittedAt).toLocaleString("id-ID")}
                  {answerSheet.data.isRemedial ? " · Remedial" : ""}
                </span>
              </div>
              <div className="space-y-3">
                {answerSheet.data.perQuestion.map((pq, idx) => (
                  <div key={idx} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0">
                        {idx + 1}
                      </Badge>
                      <p className="text-sm font-medium flex-1">{pq.questionText}</p>
                      <Badge
                        variant="secondary"
                        className={
                          pq.correctIndex !== null &&
                          pq.selectedIndex !== null &&
                          pq.selectedIndex === pq.correctIndex
                            ? "bg-emerald-100 text-emerald-800 shrink-0"
                            : "bg-rose-100 text-rose-800 shrink-0"
                        }
                      >
                        {pq.pointsEarned}/{pq.pointsMax}
                      </Badge>
                    </div>
                    <div className="pl-8 space-y-1">
                      {pq.options.map((opt, oIdx) => {
                        const isSelected = pq.selectedIndex === oIdx;
                        const isCorrect = pq.correctIndex === oIdx;
                        return (
                          <div
                            key={oIdx}
                            className={cn(
                              "text-xs rounded-md px-2 py-1.5 flex items-center gap-2",
                              isCorrect && "bg-emerald-50 text-emerald-800",
                              isSelected && !isCorrect && "bg-rose-50 text-rose-800",
                              !isSelected && !isCorrect && "text-muted-foreground"
                            )}
                          >
                            <span className="font-semibold">{String.fromCharCode(65 + oIdx)}.</span>
                            <span className="flex-1">{opt}</span>
                            {isCorrect && <span className="text-[10px] font-bold">KUNCI</span>}
                            {isSelected && <span className="text-[10px] font-bold">JAWABAN SISWA</span>}
                          </div>
                        );
                      })}
                      {pq.selectedIndex === null && (
                        <p className="text-xs text-muted-foreground italic">Tidak dijawab</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
