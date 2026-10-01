"use client";

/**
 * Shared question editor supporting Multiple Choice (MCQ) and Essay / Short Answer.
 * Used by both quiz creation and quiz detail (edit-after-publish) flows.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Trash2, ListOrdered, FileText } from "lucide-react";

export interface EditableQuestion {
  id: string;
  type?: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "ESSAY";
  text: string;
  options: string[];
  correctIndex?: number | null;
  points: number;
  explanation?: string;
}

interface QuestionListEditorProps {
  questions: EditableQuestion[];
  onChange: (questions: EditableQuestion[]) => void;
  disabled?: boolean;
}

export function QuestionListEditor({ questions, onChange, disabled }: QuestionListEditorProps) {
  const updateQuestion = (id: string, patch: Partial<EditableQuestion>) => {
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  return (
    <div className="space-y-4">
      {questions.map((q, qIdx) => {
        const isEssay = q.type === "ESSAY" || q.type === "SHORT_ANSWER";

        return (
          <div key={q.id} className="rounded-lg border p-4 space-y-3 bg-card">
            {/* Question Header: Number + Type Selector + Delete */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 font-bold">
                  Soal {qIdx + 1}
                </Badge>
                {/* Type toggle */}
                <div className="inline-flex rounded-lg border p-0.5 bg-muted/40 text-xs">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      updateQuestion(q.id, {
                        type: "MULTIPLE_CHOICE",
                        options: q.options.length >= 2 ? q.options : ["", "", "", ""],
                        correctIndex: q.correctIndex ?? 0,
                      });
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                      !isEssay ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ListOrdered className="h-3 w-3" /> Pilihan Ganda
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      updateQuestion(q.id, {
                        type: "ESSAY",
                        options: [],
                        correctIndex: null,
                        points: q.points === 1 ? 5 : q.points,
                      });
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                      isEssay ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileText className="h-3 w-3" /> Esai / Uraian
                  </button>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                disabled={disabled}
                onClick={() => onChange(questions.filter((x) => x.id !== q.id))}
                className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8"
                title="Hapus soal"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Question Text */}
            <Textarea
              value={q.text}
              disabled={disabled}
              onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
              className="min-h-16 text-sm"
              placeholder={
                isEssay
                  ? "Tuliskan pertanyaan esai atau studi kasus di sini…"
                  : "Tuliskan pertanyaan pilihan ganda di sini…"
              }
            />

            {/* Multiple Choice Options */}
            {!isEssay && (
              <div className="grid sm:grid-cols-2 gap-2">
                {q.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={disabled}
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
                      disabled={disabled}
                      onChange={(e) => {
                        const options = [...q.options];
                        options[oIdx] = e.target.value;
                        updateQuestion(q.id, { options });
                      }}
                      className={`text-sm h-9 ${
                        q.correctIndex === oIdx ? "border-emerald-500/60" : ""
                      }`}
                      placeholder={`Opsi ${String.fromCharCode(65 + oIdx)}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Essay Rubric / Answer Key Guide */}
            {isEssay && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Pedoman / Kunci Jawaban Esai (Hanya untuk acuan guru saat memeriksa):
                </label>
                <Textarea
                  value={q.explanation ?? ""}
                  disabled={disabled}
                  onChange={(e) => updateQuestion(q.id, { explanation: e.target.value })}
                  className="text-xs min-h-16 bg-muted/20"
                  placeholder="Contoh poin jawaban: Siswa harus menjelaskan peran klorofil dan reaksi terang..."
                />
              </div>
            )}

            {/* Points Configuration */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
              <span className="text-[11px]">
                {isEssay
                  ? "Soal esai akan diperiksa secara manual oleh guru setelah kuis selesai."
                  : "Soal pilihan ganda dinilai otomatis oleh sistem."}
              </span>
              <div className="flex items-center gap-2">
                <span>Poin:</span>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={q.points}
                  disabled={disabled}
                  onChange={(e) => updateQuestion(q.id, { points: Number(e.target.value) || 1 })}
                  className="w-16 h-7 text-xs text-right font-medium"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
