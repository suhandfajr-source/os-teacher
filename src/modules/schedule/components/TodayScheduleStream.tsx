"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  TodayScheduleItem,
  ScheduleStreamStatus,
  getTodayScheduleStreamAction,
} from "@/modules/schedule/schedule.actions";
import { startTeachingSession } from "@/modules/teaching/teaching.actions";
import { getDayNameIndonesia, getCurrentTimeString } from "@/lib/schedule-date-utils";
import {
  Clock,
  Play,
  CheckCircle2,
  Calendar,
  Sparkles,
  MapPin,
  ChevronRight,
  BookOpen,
  Coffee,
  AlertCircle,
  Plus,
  Loader2,
  ArrowRight
} from "lucide-react";

interface TodayScheduleStreamProps {
  initialData: {
    todayDayOfWeek: number;
    currentTime: string;
    items: TodayScheduleItem[];
  };
  schoolName?: string;
}

export function TodayScheduleStream({ initialData, schoolName }: TodayScheduleStreamProps) {
  const router = useRouter();
  const [streamData, setStreamData] = useState(initialData);
  const [currentTime, setCurrentTime] = useState(initialData.currentTime);
  const [startingContextId, setStartingContextId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Real-time minute tick to update current time and status without full reload
  useEffect(() => {
    const timer = setInterval(() => {
      const nowStr = getCurrentTimeString(new Date());
      setCurrentTime(nowStr);

      // Recalculate statuses locally
      setStreamData((prev) => {
        const updatedItems = prev.items.map((slot) => {
          if (slot.session) {
            return {
              ...slot,
              status: (slot.session.status === "COMPLETED"
                ? "COMPLETED"
                : "IN_PROGRESS") as ScheduleStreamStatus,
            };
          }
          let status: ScheduleStreamStatus = "UPCOMING";
          if (nowStr >= slot.startTime && nowStr <= slot.endTime) {
            status = "TIME_TO_TEACH";
          } else if (nowStr > slot.endTime) {
            status = "MISSED";
          } else {
            status = "UPCOMING";
          }
          return { ...slot, status };
        });

        return { ...prev, currentTime: nowStr, items: updatedItems };
      });
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const handleStartSession = async (contextId: string) => {
    try {
      setStartingContextId(contextId);
      const session = await startTeachingSession(contextId);
      toast.success("Sesi mengajar berhasil dimulai!");
      router.push(`/kelas/${contextId}/pertemuan/${session.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal memulai sesi");
      setStartingContextId(null);
    }
  };

  const todayFormatted = format(new Date(), "EEEE, dd MMMM yyyy", { locale: localeId });
  const hasItems = streamData.items.length > 0;

  return (
    <div className="space-y-3.5">
      {/* ─────────────────────────────────────────────────────────────
          STREAM HEADER
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span>Jadwal Mengajar Hari Ini</span>
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {currentTime} WIB
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{todayFormatted}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/pengaturan/setup"
            className="text-xs text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 font-bold"
          >
            <span>Atur Jadwal Mingguan</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          STREAM ITEMS / TIMELINE
      ───────────────────────────────────────────────────────────── */}
      {!hasItems ? (
        /* HARI BEBAS / BELUM ADA JADWAL HARI INI */
        <Card className="border border-dashed border-slate-200/80 bg-white dark:bg-slate-900/60 shadow-xs">
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                <Coffee className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold uppercase">
                    Hari Bebas Mengajar
                  </Badge>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Tidak Ada Jadwal Tatap Muka Hari Ini
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg">
                  Anda tidak memiliki jadwal mengajar di kelas hari {getDayNameIndonesia(streamData.todayDayOfWeek)}. 
                  Gunakan waktu luang untuk menyiapkan materi pembelajaran atau mengevaluasi tugas siswa.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link
                href="/ai-studio"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "text-xs font-semibold text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100"
                )}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                Buka AI Studio
              </Link>
              <Link
                href="/kelas"
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "text-xs font-semibold"
                )}
              >
                <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                Buku Nilai & Kelas
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* DAFTAR SLOT JADWAL HARI INI */
        <div className="space-y-3">
          {streamData.items.map((slot) => {
            const isTimeToTeach = slot.status === "TIME_TO_TEACH";
            const isInProgress = slot.status === "IN_PROGRESS";
            const isCompleted = slot.status === "COMPLETED";
            const isMissed = slot.status === "MISSED";
            const isUpcoming = slot.status === "UPCOMING";

            return (
              <Card
                key={slot.scheduleId}
                className={cn(
                  "transition-all duration-200 shadow-xs border",
                  isTimeToTeach && "border-emerald-400 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-background ring-2 ring-emerald-500/20 shadow-md",
                  isInProgress && "border-amber-300 bg-amber-50/40",
                  isCompleted && "border-slate-200 bg-slate-50/40 opacity-90",
                  isMissed && "border-rose-200 bg-rose-50/20",
                  isUpcoming && "border-border bg-card"
                )}
              >
                <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Column: Time badge & Subject info */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* Visual Status Indicator Icon */}
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm",
                        isTimeToTeach && "bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 animate-pulse",
                        isInProgress && "bg-amber-500 text-white",
                        isCompleted && "bg-slate-200 text-slate-700",
                        isMissed && "bg-rose-100 text-rose-700 border border-rose-200",
                        isUpcoming && "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                      ) : (
                        <Clock className="w-5 h-5" />
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      {/* Status Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">
                          {slot.startTime} - {slot.endTime}
                        </span>

                        {isTimeToTeach && (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider animate-pulse">
                            🟢 Waktunya Mengajar!
                          </Badge>
                        )}
                        {isInProgress && (
                          <Badge className="bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider">
                            ⚡ Sesi Berlangsung
                          </Badge>
                        )}
                        {isCompleted && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-semibold">
                            ✅ Selesai
                          </Badge>
                        )}
                        {isMissed && (
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-semibold">
                            ⚠️ Jam Lewat
                          </Badge>
                        )}
                        {isUpcoming && (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px] font-medium">
                            ⏳ Akan Datang
                          </Badge>
                        )}
                      </div>

                      {/* Class & Subject Title */}
                      <h3 className="text-base font-bold text-foreground truncate flex items-center gap-2">
                        <span>{slot.subjectName}</span>
                        <span className="text-muted-foreground font-normal text-sm">— {slot.className}</span>
                      </h3>

                      {/* Room & Subtitle */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {slot.room ? (
                          <span className="flex items-center gap-1 font-medium text-slate-700">
                            <MapPin className="w-3 h-3 text-primary" />
                            {slot.room}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            Kelas {slot.className}
                          </span>
                        )}

                        {slot.session?.actualTopic && (
                          <span className="truncate italic max-w-xs text-foreground">
                            &bull; Materi: {slot.session.actualTopic}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Dynamic Action Buttons */}
                  <div className="flex items-center justify-end gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
                    {/* 1. If session is already created and in progress */}
                    {isInProgress && slot.session && (
                      <Button
                        onClick={() =>
                          router.push(
                            `/kelas/${slot.teachingContextId}/pertemuan/${slot.session!.id}`
                          )
                        }
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs"
                      >
                        <span>Lanjutkan Sesi</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                    )}

                    {/* 2. If session is completed */}
                    {isCompleted && slot.session && (
                      <Button
                        onClick={() =>
                          router.push(
                            `/kelas/${slot.teachingContextId}/pertemuan/${slot.session!.id}`
                          )
                        }
                        variant="outline"
                        size="sm"
                        className="text-xs font-semibold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                        <span>Lihat Jurnal</span>
                      </Button>
                    )}

                    {/* 3. If it's time to teach and no session created yet */}
                    {isTimeToTeach && (
                      <Button
                        onClick={() => handleStartSession(slot.teachingContextId)}
                        disabled={startingContextId === slot.teachingContextId}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 px-4 transition-all"
                      >
                        {startingContextId === slot.teachingContextId ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            <span>Membuka Ruang Sesi...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 mr-1.5 fill-white" />
                            <span>Mulai Sesi & Presensi</span>
                          </>
                        )}
                      </Button>
                    )}

                    {/* 4. If upcoming */}
                    {isUpcoming && (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleStartSession(slot.teachingContextId)}
                          disabled={startingContextId === slot.teachingContextId}
                          variant="default"
                          size="sm"
                          className="text-xs font-semibold"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          <span>Mulai Sesi</span>
                        </Button>
                        <Link
                          href={`/kelas/${slot.teachingContextId}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs")}
                        >
                          <span>Buka Kelas</span>
                        </Link>
                      </div>
                    )}

                    {/* 5. If missed */}
                    {isMissed && (
                      <Button
                        onClick={() => handleStartSession(slot.teachingContextId)}
                        disabled={startingContextId === slot.teachingContextId}
                        variant="outline"
                        size="sm"
                        className="text-xs font-semibold text-rose-700 border-rose-200 hover:bg-rose-50"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        <span>Sesi Susulan</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
