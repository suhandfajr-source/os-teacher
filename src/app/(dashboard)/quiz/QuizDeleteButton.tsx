"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteQuizAction } from "@/modules/quiz/quiz.actions";

interface QuizDeleteButtonProps {
  quiz: {
    id: string;
    title: string;
    questionCount: number;
    attemptCount: number;
  };
}

export function QuizDeleteButton({ quiz }: QuizDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    const res = await deleteQuizAction(quiz.id);
    setBusy(false);
    if (res.success) {
      toast.success("Quiz dihapus");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error ?? "Gagal menghapus");
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Hapus quiz ${quiz.title}`}
        className="text-destructive shrink-0"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Hapus Quiz?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Quiz <span className="font-semibold">{quiz.title}</span> akan dihapus permanen
              berserta:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>{quiz.questionCount} soal</li>
              <li>{quiz.attemptCount} jawaban &amp; skor siswa</li>
              <li>Riwayat sesi CBT dan analitik per soal</li>
            </ul>
            <p className="font-medium text-destructive">
              Tindakan ini tidak bisa dibatalkan. Nilai yang sudah dipublish ke Assessment tetap
              aman.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ya, Hapus Permanen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
