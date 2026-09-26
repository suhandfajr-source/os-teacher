"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Award, CheckCircle2, Loader2 } from "lucide-react";
import { convertAssignmentToAssessmentAction } from "@/modules/assignments/assignment.actions";
import { useRouter } from "next/navigation";

interface SaveAsAssessmentDialogProps {
  teachingContextId: string;
  assignmentId: string;
  defaultTitle: string;
  gradedCount: number;
  assessmentTypes: Array<{ id: string; name: string; category: string }>;
  trigger?: React.ReactNode;
}

export function SaveAsAssessmentDialog({
  teachingContextId,
  assignmentId,
  defaultTitle,
  gradedCount,
  assessmentTypes,
  trigger,
}: SaveAsAssessmentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [assessmentTypeId, setAssessmentTypeId] = useState(assessmentTypes[0]?.id || "");
  const [passingScore, setPassingScore] = useState<number>(75);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentTypeId) {
      toast.error("Pilih kategori penilaian terlebih dahulu.");
      return;
    }

    try {
      setLoading(true);
      const res = await convertAssignmentToAssessmentAction({
        teachingContextId,
        assignmentId,
        title: title.trim(),
        assessmentTypeId,
        passingScore: Number(passingScore) || 75,
      });

      toast.success(
        `Berhasil menyimpan ke Buku Nilai! (${res.syncedCount} skor siswa telah disinkronkan)`
      );
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan penilaian");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-bold text-teal-700 bg-teal-50/80 border-teal-200 hover:bg-teal-100 shadow-2xs rounded-xl"
            >
              <Award className="w-3.5 h-3.5 text-teal-600" />
              <span>Simpan Sebagai Penilaian</span>
            </Button>
          )
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-teal-700 font-bold text-sm">
            <Award className="w-4 h-4" />
            <span>Simpan ke Buku Nilai Kelas</span>
          </div>
          <DialogTitle className="text-base font-bold text-slate-900">
            Jadikan Penilaian Resmi Rapor
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Nilai dari {gradedCount} siswa yang telah Anda periksa akan otomatis disinkronkan ke
            Buku Nilai dan dihitung pada bobot penilaian kelas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
          {/* Judul Penilaian */}
          <div className="space-y-1.5">
            <Label htmlFor="asm-title" className="text-xs font-semibold text-slate-700">
              Nama Penilaian di Buku Nilai <span className="text-destructive">*</span>
            </Label>
            <Input
              id="asm-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Tugas 1: Ekosistem"
              required
              className="h-9 text-xs rounded-xl"
            />
          </div>

          {/* Kategori Penilaian / Bobot */}
          <div className="space-y-1.5">
            <Label htmlFor="asm-type" className="text-xs font-semibold text-slate-700">
              Kategori Penilaian <span className="text-destructive">*</span>
            </Label>
            {assessmentTypes.length > 0 ? (
              <select
                id="asm-type"
                value={assessmentTypeId}
                onChange={(e) => setAssessmentTypeId(e.target.value)}
                required
                className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {assessmentTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.category})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                Belum ada kategori penilaian di kelas ini. Buka menu Pengaturan Bobot terlebih dahulu.
              </p>
            )}
          </div>

          {/* KKTP / KKM */}
          <div className="space-y-1.5">
            <Label htmlFor="asm-passing" className="text-xs font-semibold text-slate-700">
              KKTP / Batas Tuntas Minimal
            </Label>
            <Input
              id="asm-passing"
              type="number"
              min={0}
              max={100}
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value))}
              className="h-9 text-xs rounded-xl"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="text-xs font-semibold rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || assessmentTypes.length === 0}
              className="text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-pill-glow gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyinkronkan Nilai...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Simpan ke Buku Nilai</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
