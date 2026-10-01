"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  MapPin,
  AlertCircle,
  Loader2,
  CheckCircle2
} from "lucide-react";
import {
  getTeachingSchedulesAction,
  createScheduleSlotAction,
  deleteScheduleSlotAction,
} from "@/modules/schedule/schedule.actions";
import { getDayNameIndonesia } from "@/lib/schedule-date-utils";

export interface ScheduleSlotData {
  id: string;
  teachingContextId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
}

interface ScheduleConfigDialogProps {
  teachingContextId: string;
  contextTitle: string;
  triggerButton?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onScheduleUpdated?: () => void;
}

export function ScheduleConfigDialog({
  teachingContextId,
  contextTitle,
  triggerButton,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onScheduleUpdated,
}: ScheduleConfigDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOnOpenChange || setInternalOpen;

  const [schedules, setSchedules] = useState<ScheduleSlotData[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [startTime, setStartTime] = useState("07:30");
  const [endTime, setEndTime] = useState("09:00");
  const [room, setRoom] = useState("");

  const fetchSchedules = useCallback(async () => {
    if (!teachingContextId) return;
    try {
      setLoading(true);
      const data = await getTeachingSchedulesAction(teachingContextId);
      setSchedules(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat jadwal");
    } finally {
      setLoading(false);
    }
  }, [teachingContextId]);

  useEffect(() => {
    if (isOpen) {
      fetchSchedules();
    }
  }, [isOpen, fetchSchedules]);

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime || !endTime) {
      toast.error("Jam mulai dan jam selesai wajib diisi");
      return;
    }

    try {
      setSubmitting(true);
      await createScheduleSlotAction({
        teachingContextId,
        dayOfWeek: Number(dayOfWeek),
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        room: room.trim() || undefined,
      });

      toast.success(
        `Jadwal ${getDayNameIndonesia(Number(dayOfWeek))} (${startTime} - ${endTime}) berhasil disimpan!`
      );
      
      // Reset form defaults
      setRoom("");
      await fetchSchedules();
      if (onScheduleUpdated) onScheduleUpdated();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal menambahkan slot jadwal";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSlot = async (scheduleId: string) => {
    try {
      setDeletingId(scheduleId);
      await deleteScheduleSlotAction(scheduleId);
      toast.success("Slot jadwal berhasil dihapus");
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      if (onScheduleUpdated) onScheduleUpdated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus jadwal");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {triggerButton ? (
        <DialogTrigger render={triggerButton as React.ReactElement} />
      ) : (
        <DialogTrigger
          render={
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>Atur Jadwal</span>
            </Button>
          }
        />
      )}

      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            <span>Atur Jadwal Mengajar Mingguan</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Konteks: <span className="font-semibold text-foreground">{contextTitle}</span>.
            Atur hari dan jam tatap muka rutin di kelas ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* ─────────────────────────────────────────────────────────────
              1. DAFTAR SLOT JADWAL SAAT INI
          ───────────────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Jadwal Mingguan Terdaftar ({schedules.length} Slot)
              </Label>
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </div>

            {loading && schedules.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground border rounded-lg bg-muted/20">
                Memuat data jadwal...
              </div>
            ) : schedules.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-lg bg-muted/10 space-y-1">
                <AlertCircle className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                <p className="font-medium text-foreground">Belum ada jadwal mingguan</p>
                <p className="text-[11px]">Tambahkan hari dan jam mengajar melalui formulir di bawah ini.</p>
              </div>
            ) : (
              <div className="divide-y border rounded-xl bg-card overflow-hidden">
                {schedules.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Badge variant="outline" className="font-bold bg-primary/5 text-primary border-primary/20 shrink-0">
                        {getDayNameIndonesia(s.dayOfWeek)}
                      </Badge>
                      <div className="flex items-center gap-1.5 font-mono text-xs font-medium text-foreground">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>{s.startTime} - {s.endTime}</span>
                      </div>
                      {s.room && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{s.room}</span>
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteSlot(s.id)}
                      disabled={deletingId === s.id}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Hapus slot jadwal ini"
                    >
                      {deletingId === s.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              2. FORM TAMBAH SLOT BARU
          ───────────────────────────────────────────────────────────── */}
          <form onSubmit={handleCreateSlot} className="space-y-3 pt-3 border-t">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              + Tambah Hari & Jam Mengajar Baru
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Hari */}
              <div className="space-y-1.5">
                <Label htmlFor="sched-day" className="text-xs font-medium">
                  Hari Mengajar <span className="text-destructive">*</span>
                </Label>
                <select
                  id="sched-day"
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value={1}>Senin</option>
                  <option value={2}>Selasa</option>
                  <option value={3}>Rabu</option>
                  <option value={4}>Kamis</option>
                  <option value={5}>Jumat</option>
                  <option value={6}>Sabtu</option>
                  <option value={7}>Minggu</option>
                </select>
              </div>

              {/* Ruangan */}
              <div className="space-y-1.5">
                <Label htmlFor="sched-room" className="text-xs font-medium text-muted-foreground">
                  Ruangan / Lab (Opsional)
                </Label>
                <Input
                  id="sched-room"
                  placeholder="Contoh: Ruang 8A, Lab Komputer"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Jam Mulai */}
              <div className="space-y-1.5">
                <Label htmlFor="sched-startTime" className="text-xs font-medium">
                  Jam Mulai <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sched-startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Jam Selesai */}
              <div className="space-y-1.5">
                <Label htmlFor="sched-endTime" className="text-xs font-medium">
                  Jam Selesai <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sched-endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full text-xs font-semibold bg-primary gap-1.5 mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memeriksa Benturan Jadwal & Menyimpan...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Simpan Slot Jadwal</span>
                </>
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
