"use client";

import { useState } from "react";
import { Bug, Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitBugReportAction } from "@/modules/bug-reports/bug-report.actions";
import { BugReportCategory } from "@prisma/client";
import { cn } from "@/lib/utils";

export interface BugReportWidgetProps {
  variant?: "navbar" | "floating" | "drawer-item";
  trigger?: React.ReactNode;
  onTriggerClick?: () => void;
  className?: string;
}

export function BugReportWidget({
  variant = "navbar",
  trigger,
  onTriggerClick,
  className,
}: BugReportWidgetProps = {}) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<BugReportCategory>(
    BugReportCategory.FEATURE_ERROR
  );
  const [reporterEmail, setReporterEmail] = useState("");

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory(BugReportCategory.FEATURE_ERROR);
    setReporterEmail("");
    setSubmittedTicket(null);
    setErrorMessage(null);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTimeout(resetForm, 300);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorMessage("Judul dan rincian masalah wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const pageUrl = typeof window !== "undefined" ? window.location.href : "";
      const deviceInfo =
        typeof navigator !== "undefined" ? navigator.userAgent : "";

      const res = await submitBugReportAction({
        title,
        description,
        category,
        pageUrl,
        deviceInfo,
        reporterEmail: reporterEmail.trim() || undefined,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Gagal mengirim laporan.");
      } else {
        setSubmittedTicket(res.ticketNumber || "TICK-NEW");
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Terjadi kesalahan internal."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as any)
          ) : variant === "drawer-item" ? (
            <button
              type="button"
              onClick={onTriggerClick}
              className={cn(
                "flex w-full items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50/60 rounded-2xl transition-all text-left",
                className
              )}
            >
              <Bug className="h-4 w-4 shrink-0 text-rose-500" />
              <span>Lapor Masalah</span>
            </button>
          ) : variant === "floating" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onTriggerClick}
              className={cn(
                "fixed bottom-4 right-4 z-40 shadow-lg rounded-full px-3.5 py-2 gap-2 bg-background/90 backdrop-blur border-border/80 hover:bg-muted text-xs font-medium text-foreground transition-all hover:scale-105 active:scale-95",
                className
              )}
              aria-label="Laporkan Masalah atau Bug"
            >
              <Bug className="w-4 h-4 text-rose-500" />
              <span>Lapor Masalah</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onTriggerClick}
              className={cn(
                "rounded-full h-9 w-9 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors",
                className
              )}
              aria-label="Laporkan Masalah atau Bug"
              title="Laporkan Masalah atau Bug"
            >
              <Bug className="h-4 w-4 text-rose-500" />
              <span className="sr-only">Laporkan Masalah atau Bug</span>
            </Button>
          )
        }
      />

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Bug className="w-5 h-5 text-rose-500" />
            Lapor Masalah / Kendala Sistem
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Bantu kami memperbaiki Klassa. Tim teknis akan meninjau tiket ini.
          </DialogDescription>
        </DialogHeader>

        {submittedTicket ? (
          <div className="py-6 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-sm text-foreground">
              Laporan Berhasil Terkirim!
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Nomor tiket Anda:{" "}
              <span className="font-mono font-bold text-foreground">
                {submittedTicket}
              </span>
              . Tim kami akan segera menindaklanjuti. Terima kasih atas bantuannya!
            </p>
            <div className="pt-2">
              <Button size="sm" onClick={() => handleOpenChange(false)}>
                Tutup
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
            {errorMessage && (
              <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="bug-category" className="text-xs">
                Kategori Masalah
              </Label>
              <Select
                value={category}
                onValueChange={(val) => setCategory(val as BugReportCategory)}
              >
                <SelectTrigger id="bug-category" className="h-9 text-xs">
                  <SelectValue placeholder="Pilih Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BugReportCategory.FEATURE_ERROR}>
                    Error Fitur / Gagal Berfungsi
                  </SelectItem>
                  <SelectItem value={BugReportCategory.UI_UX}>
                    Tampilan / UI Rusak / Terpotong
                  </SelectItem>
                  <SelectItem value={BugReportCategory.AI_AGENT}>
                    Klassa Agent / AI Bermasalah
                  </SelectItem>
                  <SelectItem value={BugReportCategory.AUTHENTICATION}>
                    Login / Sesi / Akun
                  </SelectItem>
                  <SelectItem value={BugReportCategory.PERFORMANCE}>
                    Sistem Lambat / Loading Terus
                  </SelectItem>
                  <SelectItem value={BugReportCategory.OTHER}>Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bug-title" className="text-xs">
                Judul Masalah *
              </Label>
              <Input
                id="bug-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Tombol simpan tidak merespon di HP"
                className="h-9 text-xs"
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bug-desc" className="text-xs">
                Rincian & Langkah Kejadian *
              </Label>
              <Textarea
                id="bug-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Jelaskan apa yang Anda klik dan apa pesan error yang muncul..."
                className="text-xs min-h-[90px] resize-y"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bug-email" className="text-xs">
                Email Kontak (Opsional bila belum login)
              </Label>
              <Input
                id="bug-email"
                type="email"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="email@anda.com"
                className="h-9 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                className="text-xs h-8"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs h-8 gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim Laporan</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
