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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetStudentPinAction } from "@/modules/approvals/approvals.actions";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, Copy, Check } from "lucide-react";

interface ResetStudentPinDialogProps {
  studentId: string;
  studentName: string;
  nis: string | null;
}

export function ResetStudentPinDialog({
  studentId,
  studentName,
  nis,
}: ResetStudentPinDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [savedPin, setSavedPin] = useState("");
  const [hasCopied, setHasCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleOpen = () => {
    setNewPin("");
    setIsSuccessState(false);
    setSavedPin("");
    setHasCopied(false);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setNewPin("");
    setIsSuccessState(false);
    setSavedPin("");
  };

  const handleCopy = async () => {
    if (!savedPin) return;
    try {
      await navigator.clipboard.writeText(savedPin);
      setHasCopied(true);
      toast.success("PIN disalin ke clipboard.");
      setTimeout(() => setHasCopied(false), 2500);
    } catch {
      toast.error("Gagal menyalin PIN.");
    }
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^\d{4}$/.test(newPin.trim())) {
      toast.error("PIN baru wajib terdiri dari 4 digit angka.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await resetStudentPinAction(studentId, newPin.trim());
        if (res.success) {
          toast.success("PIN siswa berhasil direset.");
          setSavedPin(newPin.trim());
          setIsSuccessState(true);
          router.refresh();
        } else {
          toast.error(res.message || "Gagal mereset PIN siswa.");
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Terjadi kesalahan saat mereset PIN.");
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleOpen}
        className="gap-1.5 text-xs text-amber-700 hover:text-amber-800 border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 dark:text-amber-300 dark:border-amber-800/80 dark:bg-amber-950/30"
      >
        <KeyRound className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        Reset PIN
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => (open ? handleOpen() : handleClose())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              Reset PIN Portal Siswa
            </DialogTitle>
            <DialogDescription>
              Ubah atau pulihkan 4 digit PIN untuk <strong>{studentName}</strong> ({nis ? `NIS: ${nis}` : "Tanpa NIS"}).
            </DialogDescription>
          </DialogHeader>

          {isSuccessState ? (
            <div className="space-y-4 py-3">
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 text-center space-y-2">
                <div className="inline-flex p-2 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 mb-1">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  PIN Berhasil Diperbarui!
                </h4>
                <p className="text-xs text-emerald-700/90 dark:text-emerald-400">
                  Sampaikan 4 digit PIN baru di bawah ini secara langsung kepada siswa:
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <span className="font-mono text-3xl font-extrabold tracking-widest px-4 py-1.5 bg-background rounded-lg border shadow-xs text-foreground">
                    {savedPin}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopy}
                    className="gap-1.5 h-10 px-3"
                  >
                    {hasCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    {hasCopied ? "Tersalin" : "Salin"}
                  </Button>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground bg-muted/50 p-2.5 rounded-lg space-y-1">
                <p>• Sesi aktif siswa di perangkat lain telah otomatis dihentikan demi keamanan.</p>
                <p>• Siswa dapat langsung login menggunakan NIS dan PIN baru di Portal Siswa.</p>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" onClick={handleClose} className="w-full">
                  Selesai
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="new-pin" className="text-sm font-semibold">
                  PIN Baru (4 Digit Angka) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-pin"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setNewPin(val);
                  }}
                  placeholder="Contoh: 1234"
                  className="font-mono tracking-widest text-center text-lg h-11"
                  required
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Hanya angka 0-9. PIN baru tidak boleh sama dengan PIN yang digunakan sebelumnya.
                </p>
              </div>

              <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-dashed space-y-1">
                <p className="font-semibold text-foreground">Catatan Keamanan:</p>
                <p>1. Status kunci percobaan gagal login (jika ada) akan otomatis di-reset ke 0.</p>
                <p>2. Sesi siswa yang sedang aktif di perangkat manapun akan otomatis di-logout.</p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isPending}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || newPin.length !== 4}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isPending ? "Menyimpan..." : "Simpan & Terapkan PIN"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
