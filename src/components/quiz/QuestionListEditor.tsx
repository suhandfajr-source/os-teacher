"use client";

/**
 * Shared MCQ question editor used by both quiz creation and quiz detail
 * (edit-after-publish) flows.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Trash2 } from "lucide-react";

export interface EditableQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
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
      {questions.map((q, qIdx) => (
        <div key={q.id} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="mt-1 shrink-0">
              Soal {qIdx + 1}
            </Badge>
            <Textarea
              value={q.text}
              disabled={disabled}
              onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
              className="min-h-16 text-sm"
              placeholder="Teks soal…"
            />
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={() => onChange(questions.filter((x) => x.id !== q.id))}
              className="text-muted-foreground hover:text-destructive shrink-0"
              title="Hapus soal"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {q.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-2">
                <button
                  type="button"
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Poin:</span>
            <Input
              type="number"
              min={1}
              max={100}
              value={q.points}
              disabled={disabled}
              onChange={(e) => updateQuestion(q.id, { points: Number(e.target.value) || 1 })}
              className="w-20 h-8 text-xs"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
