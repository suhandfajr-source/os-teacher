"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MessageSquareText, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reviewSubmissionAction } from "@/modules/assignments/assignment.actions";
import type { TeacherQueueItem } from "@/modules/assignments/submission.service";

export function ReviewSubmissionForm({
  teachingContextId,
  item,
}: {
  teachingContextId: string;
  item: TeacherQueueItem;
}) {
  const [feedback, setFeedback] = useState(item.feedback ?? "");
  const [score, setScore] = useState<string>(item.score != null ? String(item.score) : "");
  const [pending, setPending] = useState(false);
  const [reviewedOnce, setReviewedOnce] = useState(item.status === "REVIEWED");
  const [currentScore, setCurrentScore] = useState<number | null>(item.score);

  async function handleSubmit() {
    if (pending) return;
    setPending(true);
    try {
      const res = await reviewSubmissionAction({
        teachingContextId,
        submissionId: item.id,
        feedback,
        score: score.trim() === "" ? null : Number(score),
      });
      if (res.success) {
        setReviewedOnce(true);
        setCurrentScore(score.trim() === "" ? null : Number(score));
        toast.success(`Umpan balik untuk ${item.studentName} terkirim`);
      } else {
        toast.error(res.error ?? "Gagal menyimpan umpan balik");
      }
    } catch {
      // Network/unexpected throw — jangan biarkan rejection tanpa feedback
      toast.error("Gagal mengirim — periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      {reviewedOnce && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="w-4 h-4" />
          Sudah dinilai{currentScore != null ? ` — skor ${currentScore}` : ""}
          <span className="text-muted-foreground font-normal">
            (umpan balik masih bisa diperbarui)
          </span>
        </div>
      )}
      <Textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Tulis umpan balik (wajib)…"
        rows={2}
      />
      <div className="flex items-center gap-2">
        <input
          value={score}
          onChange={(e) => setScore(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Skor 0–100 (opsional)"
          inputMode="numeric"
          className="w-40 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button size="sm" onClick={handleSubmit} disabled={pending}>
          {pending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : reviewedOnce ? (
            <PenLine className="w-4 h-4" />
          ) : (
            <MessageSquareText className="w-4 h-4" />
          )}
          {reviewedOnce ? "Perbarui" : "Nilai"}
        </Button>
      </div>
    </div>
  );
}