"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { startTeachingSession } from "@/modules/teaching/teaching.actions";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";
import RosterManager, { RosterItem } from "./RosterManager";
import { ScheduleConfigDialog } from "@/components/schedule/ScheduleConfigDialog";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Play,
  FileSpreadsheet,
  Users,
  Search,
  ChevronRight,
  Sparkles,
  Edit3,
  ExternalLink,
  GraduationCap
} from "lucide-react";

export type SessionWithAttendance = {
  id: string;
  status: string;
  date: Date | string;
  actualTopic: string | null;
  plannedTopic: string | null;
  activitySummary: string | null;
  attendanceRecordedAt: Date | string | null;
  attendanceRecords: Array<{
    status: "PRESENT" | "SICK" | "PERMISSION" | "ABSENT" | "LATE";
  }>;
};

export type SessionWithMeetingNumber = SessionWithAttendance & {
  meetingNumber: number;
};

interface RuangMengajarClientProps {
  teachingContextId: string;
  classId: string;
  academicPeriodId: string;
  context: {
    className: string;
    subjectName: string;
    academicPeriodYear: string;
    academicPeriodSemester: string;
  };
  sessions: SessionWithAttendance[];
  roster: RosterItem[];
  metrics: {
    completedCount: number;
    totalSessions: number;
    avgAttendancePct: string;
    journalFilledCount: number;
  };
}

export default function RuangMengajarClient({
  teachingContextId,
  classId,
  academicPeriodId,
  context,
  sessions,
  roster,
  metrics,
}: RuangMengajarClientProps) {
  const router = useRouter();
  const [startingSession, setStartingSession] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllSessions, setShowAllSessions] = useState(false);

  // In-progress session
  const inProgressSession = sessions.find((s) => s.status === "IN_PROGRESS");

  // Absolute meeting numbering (based on original chronological order)
  const sessionsWithNumber: SessionWithMeetingNumber[] = useMemo(() => {
    return sessions.map((s, idx) => ({
      ...s,
      meetingNumber: sessions.length - idx,
    }));
  }, [sessions]);

  const handleStartNewSession = async () => {
    try {
      setStartingSession(true);
      const session = await startTeachingSession(teachingContextId);
      toast.success("Sesi mengajar baru berhasil dimulai!");
      router.push(`/kelas/${teachingContextId}/pertemuan/${session.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal memulai sesi mengajar");
      setStartingSession(false);
    }
  };

  // Filtered sessions
  const filteredSessions: SessionWithMeetingNumber[] = useMemo(() => {
    if (!searchQuery.trim()) return sessionsWithNumber;
    const q = searchQuery.toLowerCase();
    return sessionsWithNumber.filter((session: SessionWithMeetingNumber) => {
      const topic = (session.actualTopic || session.plannedTopic || "").toLowerCase();
      const dateStr = format(new Date(session.date), "dd MMMM yyyy", { locale: localeId }).toLowerCase();
      return topic.includes(q) || dateStr.includes(q);
    });
  }, [sessionsWithNumber, searchQuery]);

  const displayedSessions = showAllSessions ? filteredSessions : filteredSessions.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. HERO BANNER: SESI AKTIF ATAU AJAKAN MENGAJAR HARI INI
      ───────────────────────────────────────────────────────────── */}
      {inProgressSession ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 via-emerald-50 to-teal-50 border border-emerald-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Play className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white uppercase tracking-wider">
                  Sesi Sedang Berlangsung
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  {format(new Date(inProgressSession.date), "EEEE, dd MMM yyyy", { locale: localeId })}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">
                {inProgressSession.actualTopic || inProgressSession.plannedTopic || "Sesi Mengajar Tanpa Judul"}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Presensi dan catatan materi siap dilengkapi untuk kelas {context.className}.
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push(`/kelas/${teachingContextId}/pertemuan/${inProgressSession.id}`)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 shrink-0 shadow-sm"
          >
            Lanjutkan Sesi Mengajar
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      ) : (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-300 uppercase tracking-wider border border-emerald-500/40">
                  Ruang Mengajar Terpadu
                </span>
              </div>
              <h2 className="text-base font-bold text-white mt-1">
                Mulai Pembelajaran Hari Ini — {context.className}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Buka ruang live untuk mencatat presensi cepat & jurnal materi kelas ini.
              </p>
            </div>
          </div>
          <Button
            onClick={handleStartNewSession}
            disabled={startingSession}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-4 py-2 shrink-0 shadow-sm transition-all"
          >
            <Play className="w-3.5 h-3.5 mr-1.5 fill-slate-950" />
            {startingSession ? "Memulai Sesi..." : "Mulai Sesi Mengajar Baru"}
          </Button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. KARTU RINGKASAN CAPAIAN MENGAJAR (METRICS)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Sesi Terlaksana
            </CardTitle>
            <Calendar className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.completedCount}{" "}
              <span className="text-xs text-muted-foreground font-normal">
                dari {metrics.totalSessions} pertemuan
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {metrics.totalSessions > 0
                ? `${((metrics.completedCount / metrics.totalSessions) * 100).toFixed(0)}% sesi telah tuntas diselesaikan`
                : "Belum ada sesi tercatat"}
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Rata-Rata Kehadiran
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.avgAttendancePct}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Tingkat kehadiran siswa di seluruh pertemuan
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Jurnal Mengajar
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.journalFilledCount} / {metrics.totalSessions}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Pertemuan dengan topik materi tercatat lengkap
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TABEL RIWAYAT MENGAJAR & JURNAL TERPADU (UNIFIED TIMELINE)
      ───────────────────────────────────────────────────────────── */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-3 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Linimasa Riwayat Mengajar & Jurnal Terpadu
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Riwayat materi yang diajarkan, ringkasan jurnal, dan rekap kehadiran per pertemuan.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <ScheduleConfigDialog
                teachingContextId={teachingContextId}
                contextTitle={`${context.subjectName} — ${context.className}`}
              />
              <Link
                href={`/kelas/${teachingContextId}/laporan?type=JOURNAL`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-colors"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Unduh Rekap Jurnal</span>
              </Link>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative mt-2">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari materi atau tanggal pertemuan..."
              className="pl-8 h-9 text-xs"
            />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {displayedSessions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Belum ada sesi mengajar tercatat</p>
                <p className="text-xs max-w-sm mx-auto">
                  Mulai sesi mengajar pertama Anda untuk mencatat kehadiran dan materi yang diajarkan hari ini.
                </p>
              </div>
              <Button onClick={handleStartNewSession} disabled={startingSession} size="sm" className="text-xs">
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Mulai Sesi Mengajar Sekarang
              </Button>
            </div>
          ) : (
            <div className="divide-y border rounded-xl bg-card overflow-hidden">
              {displayedSessions.map((session, idx) => {
                const totalPresent = session.attendanceRecords.filter(
                  (r) => r.status === "PRESENT" || r.status === "LATE"
                ).length;
                const totalSick = session.attendanceRecords.filter((r) => r.status === "SICK").length;
                const totalPerm = session.attendanceRecords.filter((r) => r.status === "PERMISSION").length;
                const totalAbs = session.attendanceRecords.filter((r) => r.status === "ABSENT").length;
                const totalStudents = session.attendanceRecords.length;
                const isSessionCompleted = session.status === "COMPLETED";

                return (
                  <div
                    key={session.id}
                    className={cn(
                      "p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-muted/30",
                      session.status === "IN_PROGRESS" && "bg-amber-50/20 border-l-4 border-l-amber-500"
                    )}
                  >
                    {/* Left: Date & Meeting No */}
                    <div className="space-y-1 md:w-1/4 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground">
                          Pertemuan #{session.meetingNumber}
                        </span>
                        <Badge
                          variant={isSessionCompleted ? "outline" : "default"}
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            isSessionCompleted
                              ? "bg-slate-50 text-slate-700 border-slate-200"
                              : "bg-amber-500 text-white font-semibold"
                          )}
                        >
                          {isSessionCompleted ? "Selesai" : "Sedang Berlangsung"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3 text-primary" />
                        {format(new Date(session.date), "EEEE, dd MMM yyyy", { locale: localeId })}
                      </p>
                    </div>

                    {/* Middle: Topic & Activity Summary */}
                    <div className="space-y-1 md:w-2/4 min-w-0">
                      <h4 className="text-sm font-semibold text-foreground truncate">
                        {session.actualTopic || session.plannedTopic || "Materi belum ditentukan"}
                      </h4>
                      {session.activitySummary ? (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {session.activitySummary}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Belum ada catatan aktivitas.</p>
                      )}
                    </div>

                    {/* Right: Attendance Recap & Action */}
                    <div className="flex items-center justify-between md:justify-end gap-3 md:w-1/4 shrink-0 border-t md:border-t-0 pt-2 md:pt-0">
                      <div className="text-left md:text-right text-xs">
                        <div className="font-semibold text-foreground">
                          {totalStudents > 0 ? (
                            <span>
                              {totalPresent}/{totalStudents} Hadir
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Presensi kosong</span>
                          )}
                        </div>
                        {totalStudents > 0 && (
                          <div className="text-[10px] text-muted-foreground flex items-center md:justify-end gap-1 mt-0.5">
                            {totalSick > 0 && <span className="text-amber-600 font-medium">{totalSick} S</span>}
                            {totalPerm > 0 && <span className="text-blue-600 font-medium">{totalPerm} I</span>}
                            {totalAbs > 0 && <span className="text-rose-600 font-medium">{totalAbs} A</span>}
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={() => router.push(`/kelas/${teachingContextId}/pertemuan/${session.id}`)}
                        variant="outline"
                        size="sm"
                        className="text-xs font-semibold shrink-0"
                      >
                        <Edit3 className="w-3 h-3 mr-1" />
                        {isSessionCompleted ? "Detail" : "Buka Sesi"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Show more toggle */}
          {filteredSessions.length > 5 && (
            <div className="pt-3 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllSessions(!showAllSessions)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {showAllSessions
                  ? "Tampilkan Lebih Sedikit"
                  : `Lihat Seluruh ${filteredSessions.length} Pertemuan (${filteredSessions.length - 5} lainnya)`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─────────────────────────────────────────────────────────────
          4. ROSTER SISWA ANCHOR (#roster)
      ───────────────────────────────────────────────────────────── */}
      <div id="roster" className="pt-4 border-t">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="w-4 h-4 text-primary" />
          <h3 className="text-base font-bold text-foreground">
            Daftar Siswa Kelas {context.className} ({roster.length} Siswa)
          </h3>
        </div>
        <RosterManager
          teachingContextId={teachingContextId}
          classId={classId}
          academicPeriodId={academicPeriodId}
          initialRoster={roster}
        />
      </div>
    </div>
  );
}
