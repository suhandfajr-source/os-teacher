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
import { updateStudent } from "@/modules/students/students.actions";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

interface EditStudentDialogProps {
  student: {
    id: string;
    fullName: string;
    nis: string | null;
  };
}

export function EditStudentDialog({ student }: EditStudentDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [fullName, setFullName] = useState(student.fullName);
  const [nis, setNis] = useState(student.nis || "");
  const [isPending, startTransition] = useTransition();

  const handleOpen = () => {
    setFullName(student.fullName);
    setNis(student.nis || "");
    setIsOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error("Nama lengkap siswa wajib diisi.");
      return;
    }

    startTransition(async () => {
      try {
        await updateStudent(student.id, {
          fullName: fullName.trim(),
          nis: nis.trim() || null,
        });

        toast.success("Data siswa berhasil diperbarui.");
        setIsOpen(false);
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal memperbarui data siswa");
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleOpen}
        className="gap-1.5 text-xs text-slate-700 hover:text-slate-900"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit Data
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Identitas Siswa</DialogTitle>
            <DialogDescription>
              Perbarui nama atau NIS siswa. NIS harus unik per sekolah dan akan digunakan siswa untuk login.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-fullName" className="text-sm font-semibold">
                Nama Lengkap Siswa <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nama lengkap sesuai rapor"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-nis" className="text-sm font-semibold">
                Nomor Induk Siswa (NIS)
              </Label>
              <Input
                id="edit-nis"
                value={nis}
                onChange={(e) => setNis(e.target.value)}
                placeholder="Contoh: 2024001A (Huruf/Angka)"
              />
              <p className="text-[11px] text-muted-foreground">
                Format NIS akan otomatis dikonversi ke huruf besar (Uppercase). Kosongkan jika belum memiliki NIS resmi.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
