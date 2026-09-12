"use client";

/**
 * Create Quiz page — paste an AI-generated (or any) MCQ document, convert it
 * with AI, review/edit questions, configure settings, then save.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { createQuizAction } from "@/modules/quiz/quiz.actions";
import { convertDocumentToQuizAction, ExtractedQuestion } from "@/modules/quiz/quiz-convert.action";
import { getTeacherTeachingContextsAction } from "@/modules/ai/ai.actions";

interface ContextOption {
  id: string;
  label: string;
}

interface EditableQuestion extends ExtractedQuestion {
  id: string;
}

export function NewQuizClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [contexts, setContexts] = useState<ContextOption[]>([]);
  const [contextId, setContextId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState<string>("");
  const [standardScore, setStandardScore] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);

  const [documentText, setDocumentText] = useState("");
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load teaching contexts; prefill from query params (AI Studio handoff)
  useEffect(() => {
    getTeacherTeachingContextsAction()
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setContexts(res);
          const fromQuery = searchParams.get("contextId");
          if (fromQuery && res.some((c) => c.id === fromQuery)) {
            setContextId(fromQuery);
          } else if (res.length === 1) {
            setContextId(res[0].id);
          }
        }
      })
      .catch(() => toast.error("Gagal memuat daftar kelas"));

    const draftId = searchParams.get("aiDraftId");
    if (draftId) {
      import("@/modules/ai/ai.actions").then(({ getAiDraftDetailAction }) =>
        getAiDraftDetailAction(draftId).then((res) => {
          const draft = "data" in res ? (res as { data?: { title: string; content: string } }).data : (res as unknown as { title: string; content: string });
          if (draft?.content) {
            setDocumentText(draft.content);
            if (draft.title) setTitle(draft.title);
          }
        })
      );
    }
  }, [searchParams]);

  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (Number(q.points) || 1), 0),
    [questions]
  );

  const handleConvert = async () => {
    if (documentText.trim().length < 50) {
      toast.error("Tempel dokumen soal terlebih dahulu (min. 50 karakter)");
      return;
    }
    setIsConverting(true);
    try {
      const res = await convertDocumentToQuizAction({
        documentText,
        expectedCount: 10,
      });
      if (res.success && res.data) {
        setQuestions(res.data.questions.map((q, i) => ({ ...q, id: `q${Date.now()}-${i}` })));
        toast.success(`${res.data.questions.length} soal berhasil dikonversi`);
      } else {
        toast.error(res.error ?? "Konversi gagal");
      }
    } catch {
      toast.error("Terjadi kesalahan saat konversi");
    } finally {
      setIsConverting(false);
    }
  };

  const updateQuestion = (id: string, patch: Partial<EditableQuestion>) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const handleSave = async (andPublish: boolean) => {
    if (!contextId) return toast.error("Pilih kelas & mata pelajaran terlebih dahulu");
    if (questions.length === 0) return toast.error("Konversi atau tambahkan soal terlebih dahulu");

    setIsSaving(true);
    try {
      const res = await createQuizAction({
        teachingContextId: contextId,
        title: title.trim() || "Quiz Tanpa Judul",
        description: description.trim() || undefined,
        durationMinutes: duration ? Number(duration) : undefined,
        standardScore: standardScore ? Number(standardScore) : undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        shuffleQuestions,
        shuffleOptions,
        questions: questions.map((q) => ({
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          points: q.points,
          explanation: q.explanation,
        })),
      });

      if (res.success && res.data) {
        if (andPublish) {
          const { setQuizStatusAction } = await import("@/modules/quiz/quiz.actions");
          await setQuizStatusAction(res.data.quizId, "PUBLISHED");
          toast.success("Quiz dibuat & langsung aktif!");
        } else {
          toast.success("Draft quiz tersimpan");
        }
        router.push(`/quiz/${res.data.quizId}`);
      } else {
        toast.error(res.error ?? "Gagal menyimpan quiz");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 pb-16">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/quiz")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Buat Quiz Online</h1>
          <p className="text-sm text-muted-foreground">
            Konversi soal dari AI Studio atau tulis manual — siswa mengerjakan lewat link.
          </p>
        </div>
      </div>

      {/* Step 1: Context */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Kelas & Mata Pelajaran</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {contexts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Belum ada kelas yang diampu. Tambahkan kelas terlebih dahulu.
              </p>
            )}
            {contexts.map((c) => (
              <button
                key={c.id}
                onClick={() => setContextId(c.id)}
                className={`text-left rounded-lg border p-3 text-sm transition-all ${
                  contextId === c.id
                    ? "border-primary bg-primary/5 font-medium"
                    : "hover:border-primary/40"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Convert */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            2. Soal
            {questions.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                {questions.length} soal · {totalPoints} poin
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="doc">Dokumen soal (dari AI Studio atau tempel manual)</Label>
            <Textarea
              id="doc"
              value={documentText}
              onChange={(e) => setDocumentText(e.target.value)}
              placeholder="Tempel dokumen soal pilihan ganda beserta kunci jawabannya di sini…"
              className="min-h-40 font-mono text-xs"
            />
          </div>
          <Button onClick={handleConvert} disabled={isConverting} className="gap-2">
            {isConverting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 text-amber-500" />
            )}
            Konversi dengan AI
          </Button>

          {/* Editable questions */}
          <div className="space-y-4">
            {questions.map((q, qIdx) => (
              <div key={q.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-1 shrink-0">
                    Soal {qIdx + 1}
                  </Badge>
                  <Textarea
                    value={q.text}
                    onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                    className="min-h-16 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuestion(q.id, { correctIndex: oIdx })}
                        className={`shrink-0 rounded-full p-0.5 transition-colors ${
                          q.correctIndex === oIdx ? "text-emerald-600" : "text-muted-foreground/40"
                        }`}
                        title="Tandai sebagai jawaban benar"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </button>
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const options = [...q.options];
                          options[oIdx] = e.target.value;
                          updateQuestion(q.id, { options });
                        }}
                        className={`text-sm h-9 ${
                          q.correctIndex === oIdx ? "border-emerald-500/60" : ""
                        }`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Poin:</span>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={q.points}
                    onChange={(e) => updateQuestion(q.id, { points: Number(e.target.value) || 1 })}
                    className="w-20 h-8 text-xs"
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                setQuestions((qs) => [
                  ...qs,
                  {
                    id: `manual-${Date.now()}`,
                    text: "",
                    options: ["", "", "", ""],
                    correctIndex: 0,
                    points: 1,
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" /> Tambah Soal Manual
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Pengaturan Quiz</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Judul Quiz</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Kuis Ulangan Harian Peredaran Darah"
            />
          </div>
          <div>
            <Label htmlFor="desc">Deskripsi (opsional)</Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Petunjuk singkat untuk siswa"
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="duration">Timer (menit)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="mis. 30"
              />
            </div>
            <div>
              <Label htmlFor="standard">Standar Nilai (KKM)</Label>
              <Input
                id="standard"
                type="number"
                min={0}
                max={100}
                value={standardScore}
                onChange={(e) => setStandardScore(e.target.value)}
                placeholder="mis. 75"
              />
            </div>
            <div>
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Acak urutan soal</p>
              <p className="text-xs text-muted-foreground">
                Urutan berbeda untuk tiap siswa (anti mencontek tetangga)
              </p>
            </div>
            <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} className="h-5 w-5 accent-emerald-600" />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Acak urutan opsi jawaban</p>
              <p className="text-xs text-muted-foreground">
                Posisi jawaban benar berbeda untuk tiap siswa
              </p>
            </div>
            <input type="checkbox" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} className="h-5 w-5 accent-emerald-600" />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving}>
          Simpan sebagai Draft
        </Button>
        <Button onClick={() => handleSave(true)} disabled={isSaving || !contextId} className="gap-2">
          <Share2 className="h-4 w-4" />
          Simpan & Aktifkan
        </Button>
      </div>
    </div>
  );
}
