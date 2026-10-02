"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { revokeStudentAccessAction } from "@/modules/approvals/approvals.actions";
import { toast } from "sonner";
import { ShieldBan, AlertTriangle } from "lucide-react";

interface RevokeStudentAccessDialogProps {
  studentId: string;
  studentName: string;
  nis: string | null;
}

/**
 * #4 (code review 2026-09-27, disetujui user 2026-10-02): guru mencabut akses
 * portal siswa. Data akademik tetap utuh; jalur pulih = siswa daftar ulang
 * dengan PIN lama (G-1) lalu guru menyetujui kembali.
 */
export function RevokeStudentAccessDialog({
  studentId,
  studentName,
  nis,
}: RevokeStudentAccessDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();

  const confirmRequired = "CABUT";
  const canSubmit = confirmText.trim().toUpperCase() === confirmRequired;

  const handleClose = () => {
    setIsOpen(false);
    setConfirmText("");
  };

  const handleRevoke = () => {
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        const res = await revokeStudentAccessAction(studentId);
        if (res.success) {
          toast.success(`Akses portal ${studentName} telah dicabut. Sesi aktif siswa juga dihanguskan.`);
          handleClose();
          router.refresh();
        } else {
          toast.error(res.message || "Gagal mencabut akses siswa.");
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Terjadi kesalahan saat mencabut akses.");
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="gap-1.5 text-xs text-rose-700 hover:text-rose-800 border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 dark:text-rose-300 dark:border-rose-800/80 dark:bg-rose-950/30"
      >
        <ShieldBan className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
        Cabut Akses
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : handleClose())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldBan className="h-5 w-5 text-rose-600" />
              Cabut Akses Portal Siswa
            </DialogTitle>
            <DialogDescription>
              Menutup akses portal untuk <strong>{studentName}</strong> ({nis ? `NIS: ${nis}` : "Tanpa NIS"}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="flex gap-2.5 p-3.5 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs text-amber-800 dark:text-amber-300">
                <p>Siswa tidak dapat login hingga akses dipulihkan. Sesi perangkat yang aktif ikut dihanguskan.</p>
                <p>
                  Nilai, tugas, dan presensi siswa <strong>tetap tersimpan</strong> dan dapat dilihat di profil ini.
                  Jalur pulih: siswa mendaftar ulang dengan PIN lama, lalu Anda menyetujui kembali.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Ketik <span className="font-bold text-rose-600">{confirmRequired}</span> untuk konfirmasi:
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={confirmRequired}
                className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={handleClose} disabled={isPending}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={!canSubmit || isPending}
              className="gap-1.5"
            >
              <ShieldBan className="h-4 w-4" />
              {isPending ? "Mencabut..." : "Cabut Akses"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
