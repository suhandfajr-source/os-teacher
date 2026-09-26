"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { editTeachingSession, completeTeachingSession } from "@/modules/teaching/teaching.actions";
import { saveAttendance } from "@/modules/attendance/attendance.actions";
import { saveSessionAssignmentAction } from "@/modules/assignments/assignment.actions";
import { SaveAsAssessmentDialog } from "@/components/assignments/SaveAsAssessmentDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { AttendanceStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Users,
  CheckCircle2,
  Clock,
  Save,
  Sparkles,
  ArrowLeft,
  Check,
  Search,
  Lock,
  FileText,
  AlertCircle,
  MessageSquare,
  ClipboardList,
  Calendar as CalendarIcon,
  Award
} from "lucide-react";

type AttendanceData = { status: AttendanceStatus; note: string };
type SessionData = {
  id: string;
  status: string;
  date: Date | string;
  actualTopic?: string | null;
  plannedTopic?: string | null;
  activitySummary?: string | null;
  attendanceRecordedAt?: Date | string | null;
};
type ContextData = {
  id: string;
  classId: string;
  subject: { name: string };
  class: { name: string };
};
type RosterData = {
  studentId: string;
  student: { fullName: string; nis?: string | null };
};
type RecordData = {
  studentId: string;
  status: AttendanceStatus;
  note?: string | null;
};
type AssignmentData = {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: Date | string | null;
  _count?: { submissions: number };
} | null;

export default function SessionClient({
  session,
  context,
  roster,
  attendanceRecords,
  existingAssignment,
  assessmentTypes = [],
}: {
  session: SessionData;
  context: ContextData;
  roster: RosterData[];
  attendanceRecords: RecordData[];
  existingAssignment?: AssignmentData;
  assessmentTypes?: Array<{ id: string; name: string; category: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNoteStudentId, setActiveNoteStudentId] = useState<string | null>(null);

  const [actualTopic, setActualTopic] = useState(session.actualTopic || "");
  const [plannedTopic, setPlannedTopic] = useState(session.plannedTopic || "");
  const [activitySummary, setActivitySummary] = useState(session.activitySummary || "");
  const [recordedAt, setRecordedAt] = useState<Date | string | null>(session.attendanceRecordedAt || null);

  // Assignment state
  const [giveAssignment, setGiveAssignment] = useState(!!existingAssignment);
  const [assignmentTitle, setAssignmentTitle] = useState(existingAssignment?.title || "");
  const [assignmentDesc, setAssignmentDesc] = useState(existingAssignment?.description || "");
  const [assignmentDueDate, setAssignmentDueDate] = useState<string>(
    existingAssignment?.dueDate
      ? format(new Date(existingAssignment.dueDate), "yyyy-MM-dd'T'HH:mm")
      : ""
  );

  // Attendance state
  const [attendance, setAttendance] = useState<Record<string, AttendanceData>>(() => {
    const initialState: Record<string, AttendanceData> = {};
    if (session.attendanceRecordedAt && attendanceRecords) {
      attendanceRecords.forEach((record) => {
        initialState[record.studentId] = {
          status: record.status,
          note: record.note || "",
        };
      });
    } else {
      roster.forEach((cs) => {
        initialState[cs.studentId] = { status: "PRESENT", note: "" }; // default to present
      });
    }
    return initialState;
  });

  const isCompleted = session.status === "COMPLETED";
  const displayRoster = recordedAt
    ? roster.filter((cs) => attendance[cs.studentId]) // only snapshotted students
    : roster; // show all roster students

  // Attendance stats counters
  const attendanceStats = useMemo(() => {
    let present = 0;
    let sick = 0;
    let permission = 0;
    let absent = 0;
    let late = 0;

    displayRoster.forEach((cs) => {
      const st = attendance[cs.studentId]?.status || "PRESENT";
      if (st === "PRESENT") present++;
      else if (st === "SICK") sick++;
      else if (st === "PERMISSION") permission++;
      else if (st === "ABSENT") absent++;
      else if (st === "LATE") late++;
    });

    return { present, sick, permission, absent, late, total: displayRoster.length };
  }, [displayRoster, attendance]);

  // Filtered roster for search
  const filteredRoster = useMemo(() => {
    if (!searchQuery.trim()) return displayRoster;
    const q = searchQuery.toLowerCase();
    return displayRoster.filter(
      (cs) =>
        cs.student.fullName.toLowerCase().includes(q) ||
        (cs.student.nis && cs.student.nis.toLowerCase().includes(q))
    );
  }, [displayRoster, searchQuery]);

  // Bulk action: Mark all present
  const handleMarkAllPresent = () => {
    setAttendance((prev) => {
      const next = { ...prev };
      displayRoster.forEach((cs) => {
        next[cs.studentId] = {
          status: "PRESENT",
          note: prev[cs.studentId]?.note || "",
        };
      });
      return next;
    });
    toast.success("Semua siswa ditandai Hadir");
  };

  // Change single student status
  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: {
        status,
        note: prev[studentId]?.note || "",
      },
    }));
    // Auto-open note box for sick/permission/absent if empty
    if (status !== "PRESENT" && !attendance[studentId]?.note) {
      setActiveNoteStudentId(studentId);
    }
  };

  // Change single student note
  const handleNoteChange = (studentId: string, note: string) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: {
        status: prev[studentId]?.status || "PRESENT",
        note,
      },
    }));
  };

  const handleSaveDetails = async () => {
    try {
      setLoading(true);
      await editTeachingSession(session.id, { actualTopic, plannedTopic, activitySummary });
      if (giveAssignment && assignmentTitle.trim()) {
        await saveSessionAssignmentAction({
          teachingContextId: context.id,
          teachingSessionId: session.id,
          title: assignmentTitle.trim(),
          description: assignmentDesc.trim() || undefined,
          dueDate: assignmentDueDate ? new Date(assignmentDueDate) : undefined,
        });
      }
      toast.success("Detail jurnal & tugas berhasil disimpan");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan jurnal");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAttendance = async () => {
    try {
      setLoading(true);
      const records = Object.entries(attendance).map(([studentId, data]) => ({
        studentId,
        status: data.status,
        note: data.note,
      }));
      await saveAttendance(session.id, records);
      setRecordedAt(new Date());
      toast.success("Presensi kehadiran berhasil disimpan");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan kehadiran");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSession = async () => {
    if (!actualTopic.trim()) {
      toast.error("Topik aktual (Materi yang Diajarkan) wajib diisi sebelum menyelesaikan sesi!");
      return;
    }

    try {
      setLoading(true);
      // Auto-save attendance if not yet recorded
      if (!recordedAt) {
        const records = Object.entries(attendance).map(([studentId, data]) => ({
          studentId,
          status: data.status,
          note: data.note,
        }));
        await saveAttendance(session.id, records);
        setRecordedAt(new Date());
      }

      // Save assignment if enabled
      if (giveAssignment && assignmentTitle.trim()) {
        await saveSessionAssignmentAction({
          teachingContextId: context.id,
          teachingSessionId: session.id,
          title: assignmentTitle.trim(),
          description: assignmentDesc.trim() || undefined,
          dueDate: assignmentDueDate ? new Date(assignmentDueDate) : undefined,
        });
      }

      // Save latest details first
      await editTeachingSession(session.id, { actualTopic, plannedTopic, activitySummary });
      await completeTeachingSession(session.id);
      toast.success("Sesi mengajar berhasil diselesaikan!");
      router.push(`/kelas/${context.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menyelesaikan sesi");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAiSummary = () => {
    if (!actualTopic.trim()) {
      toast.error("Ketikkan topik materi terlebih dahulu untuk membuat ringkasan.");
      return;
    }
    const templateSummary = `Pembelajaran materi "${actualTopic}" berlangsung secara interaktif. Siswa memahami konsep dasar dan mempraktikkan latihan soal dengan aktif.`;
    setActivitySummary(templateSummary);
    toast.success("Draf catatan aktivitas berhasil dibuat!");
  };

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* ─────────────────────────────────────────────────────────────
          1. STICKY TOP ACTION BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b pb-3 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href={`/kelas/${context.id}`}
                className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Kembali ke Kelas
              </Link>
              <span className="text-slate-300">•</span>
              <Badge
                variant={isCompleted ? "secondary" : "default"}
                className={cn(
                  "text-[10px] font-semibold px-2 py-0.5",
                  isCompleted ? "bg-slate-100 text-slate-700" : "bg-emerald-600 text-white"
                )}
              >
                {isCompleted ? "Sesi Selesai (Terkunci)" : "Sesi Sedang Berlangsung"}
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>{context.subject.name}</span>
              <span className="text-muted-foreground font-normal text-lg">— {context.class.name}</span>
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {format(new Date(session.date), "EEEE, dd MMMM yyyy", { locale: localeId })}
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSaveDetails}
              disabled={loading}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Simpan Draf
            </Button>

            {!isCompleted && (
              <Button
                onClick={handleCompleteSession}
                disabled={loading}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Selesaikan & Kunci Sesi
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. KARTU ATAS: JURNAL & MATERI HARI INI
      ───────────────────────────────────────────────────────────── */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">1. Jurnal & Materi Pembelajaran</CardTitle>
                <CardDescription className="text-xs">
                  Catat topik materi yang diajarkan dan ringkasan aktivitas siswa hari ini.
                </CardDescription>
              </div>
            </div>
            {actualTopic.trim() && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] hidden sm:flex items-center gap-1">
                <Check className="h-3 w-3" /> Topik Terisi
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="actualTopic" className="text-xs font-semibold">
                Topik Aktual yang Diajarkan <span className="text-rose-500">* (Wajib)</span>
              </Label>
              <Input
                id="actualTopic"
                value={actualTopic}
                onChange={(e) => setActualTopic(e.target.value)}
                placeholder="Contoh: Teorema Pythagoras - Menghitung Sisi Miring"
                className="text-sm font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plannedTopic" className="text-xs font-medium text-muted-foreground">
                Rencana Topik (Opsional / Rujukan)
              </Label>
              <Input
                id="plannedTopic"
                value={plannedTopic}
                onChange={(e) => setPlannedTopic(e.target.value)}
                placeholder="Contoh: Bab 3 - Geometri Segitiga"
                className="text-sm text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="activitySummary" className="text-xs font-medium text-muted-foreground">
                Ringkasan Aktivitas / Refleksi Mengajar (Opsional)
              </Label>
              <button
                type="button"
                onClick={handleGenerateAiSummary}
                className="text-[11px] font-semibold text-purple-700 hover:text-purple-800 flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded transition-colors"
              >
                <Sparkles className="h-3 w-3 text-purple-600" />
                Buat Draf via AI
              </button>
            </div>
            <Textarea
              id="activitySummary"
              value={activitySummary}
              onChange={(e) => setActivitySummary(e.target.value)}
              rows={3}
              placeholder="Contoh: Siswa aktif berdiskusi dalam 4 kelompok, 2 kelompok maju presentasi menyelesaikan LKPD 1."
              className="text-sm"
            />
          </div>
        </CardContent>

        <CardFooter className="flex justify-end border-t pt-3 pb-3 bg-muted/20">
          <Button onClick={handleSaveDetails} disabled={loading} variant="secondary" size="sm" className="text-xs">
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Simpan Jurnal Mengajar
          </Button>
        </CardFooter>
      </Card>

      {/* ─────────────────────────────────────────────────────────────
          2. KARTU TENGAH: TUGAS & TINDAK LANJUT PERTEMUAN (OPSIONAL)
      ───────────────────────────────────────────────────────────── */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                <ClipboardList className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">2. Tugas & Catatan Tambahan Pertemuan (Opsional)</CardTitle>
                <CardDescription className="text-xs">
                  Berikan tugas/PR untuk siswa setelah sesi ini, yang otomatis tampil di akun siswa & reminder guru.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={giveAssignment}
                  onChange={(e) => setGiveAssignment(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Aktifkan Tugas</span>
              </label>
            </div>
          </div>
        </CardHeader>

        {giveAssignment && (
          <CardContent className="space-y-4 pt-1">
            <div className="p-3 bg-teal-50/60 border border-teal-200/80 rounded-xl space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="assignmentTitle" className="text-xs font-semibold text-slate-800">
                    Judul Tugas / PR <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="assignmentTitle"
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                    placeholder="Contoh: Latihan Soal Pythagoras Hal. 45"
                    className="text-sm bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="assignmentDueDate" className="text-xs font-semibold text-slate-800">
                    Batas Waktu Pengumpulan (Deadline)
                  </Label>
                  <Input
                    id="assignmentDueDate"
                    type="datetime-local"
                    value={assignmentDueDate}
                    onChange={(e) => setAssignmentDueDate(e.target.value)}
                    className="text-sm bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assignmentDesc" className="text-xs font-medium text-slate-700">
                  Petunjuk Pengerjaan / Catatan Siswa (Opsional)
                </Label>
                <Textarea
                  id="assignmentDesc"
                  value={assignmentDesc}
                  onChange={(e) => setAssignmentDesc(e.target.value)}
                  rows={2}
                  placeholder="Contoh: Kerjakan nomor 1-5 di buku tugas. Foto lembar jawaban dan upload ke portal siswa."
                  className="text-sm bg-white"
                />
              </div>

              {/* Status & Actions for existing assignment */}
              {existingAssignment && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-teal-200/60 text-xs">
                  <span className="text-teal-900 font-medium">
                    📌 Tugas telah terdaftar ({existingAssignment._count?.submissions || 0} siswa mengumpulkan)
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/kelas/${context.id}/tugas/${existingAssignment.id}`}
                      className="inline-flex items-center text-xs font-semibold text-teal-700 bg-white border border-teal-300 hover:bg-teal-50 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      Periksa Pengumpulan Siswa
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ─────────────────────────────────────────────────────────────
          3. KARTU BAWAH: PRESENSI CEPAT SISWA (QUICK ATTENDANCE)
      ───────────────────────────────────────────────────────────── */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-3 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  3. Presensi Siswa ({attendanceStats.total} Siswa)
                </CardTitle>
                <CardDescription className="text-xs">
                  {recordedAt ? (
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Presensi tersimpan & terkunci pada{" "}
                      {format(new Date(recordedAt), "HH:mm, dd MMM yyyy", { locale: localeId })}
                    </span>
                  ) : (
                    "Ketuk status kehadiran tiap siswa. Menyimpan presensi akan mengunci daftar hadir sesi ini."
                  )}
                </CardDescription>
              </div>
            </div>

            {/* Quick Action: Mark All Present */}
            {!isCompleted && (
              <Button
                type="button"
                onClick={handleMarkAllPresent}
                variant="outline"
                size="sm"
                className="text-xs font-semibold text-emerald-700 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/80 shrink-0 self-start sm:self-auto"
              >
                <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                Tandai Semua Hadir
              </Button>
            )}
          </div>

          {/* Status Counter Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 border-t mt-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/80 border border-emerald-100 text-emerald-900 text-xs">
              <span className="font-medium">🟢 Hadir:</span>
              <span className="font-bold text-sm">{attendanceStats.present}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/80 border border-amber-100 text-amber-900 text-xs">
              <span className="font-medium">🟡 Sakit:</span>
              <span className="font-bold text-sm">{attendanceStats.sick}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/80 border border-blue-100 text-blue-900 text-xs">
              <span className="font-medium">🔵 Izin:</span>
              <span className="font-bold text-sm">{attendanceStats.permission}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50/80 border border-rose-100 text-rose-900 text-xs">
              <span className="font-medium">🔴 Alpa:</span>
              <span className="font-bold text-sm">{attendanceStats.absent}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50/80 border border-purple-100 text-purple-900 text-xs col-span-2 sm:col-span-1">
              <span className="font-medium">🟣 Terlambat:</span>
              <span className="font-bold text-sm">{attendanceStats.late}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {/* Quick Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau NIS siswa..."
              className="pl-8 h-9 text-xs"
            />
          </div>

          {/* Roster List */}
          {filteredRoster.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs">
              Tidak ada siswa yang cocok dengan pencarian &quot;{searchQuery}&quot;.
            </div>
          ) : (
            <div className="divide-y border rounded-lg bg-card overflow-hidden">
              {filteredRoster.map((cs, idx) => {
                const sId = cs.studentId;
                const currentStatus = attendance[sId]?.status || "PRESENT";
                const currentNote = attendance[sId]?.note || "";
                const isNoteOpen = activeNoteStudentId === sId || currentNote.trim().length > 0;

                return (
                  <div
                    key={sId}
                    className={cn(
                      "p-3 flex flex-col gap-2 transition-colors",
                      idx % 2 === 0 ? "bg-background" : "bg-muted/10",
                      currentStatus !== "PRESENT" && "bg-amber-50/20"
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Student Info */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 text-xs text-muted-foreground font-mono">{idx + 1}.</span>
                        <div className="truncate">
                          <p className="font-semibold text-xs sm:text-sm text-foreground truncate">
                            {cs.student.fullName}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            NIS: {cs.student.nis || "—"}
                          </p>
                        </div>
                      </div>

                      {/* Status Pill Toggles + Note Button */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <div className="inline-flex rounded-lg bg-muted/60 p-0.5 border text-xs">
                          {/* H - Hadir */}
                          <button
                            type="button"
                            onClick={() => handleStatusChange(sId, "PRESENT")}
                            className={cn(
                              "px-2.5 py-1 rounded-md font-semibold text-xs transition-all",
                              currentStatus === "PRESENT"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                            )}
                            title="Hadir"
                          >
                            H
                          </button>

                          {/* S - Sakit */}
                          <button
                            type="button"
                            onClick={() => handleStatusChange(sId, "SICK")}
                            className={cn(
                              "px-2.5 py-1 rounded-md font-semibold text-xs transition-all",
                              currentStatus === "SICK"
                                ? "bg-amber-500 text-white shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                            )}
                            title="Sakit"
                          >
                            S
                          </button>

                          {/* I - Izin */}
                          <button
                            type="button"
                            onClick={() => handleStatusChange(sId, "PERMISSION")}
                            className={cn(
                              "px-2.5 py-1 rounded-md font-semibold text-xs transition-all",
                              currentStatus === "PERMISSION"
                                ? "bg-blue-600 text-white shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                            )}
                            title="Izin"
                          >
                            I
                          </button>

                          {/* A - Alpa */}
                          <button
                            type="button"
                            onClick={() => handleStatusChange(sId, "ABSENT")}
                            className={cn(
                              "px-2.5 py-1 rounded-md font-semibold text-xs transition-all",
                              currentStatus === "ABSENT"
                                ? "bg-rose-600 text-white shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                            )}
                            title="Alpa (Tanpa Keterangan)"
                          >
                            A
                          </button>

                          {/* T - Terlambat */}
                          <button
                            type="button"
                            onClick={() => handleStatusChange(sId, "LATE")}
                            className={cn(
                              "px-2.5 py-1 rounded-md font-semibold text-xs transition-all",
                              currentStatus === "LATE"
                                ? "bg-purple-600 text-white shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                            )}
                            title="Terlambat"
                          >
                            T
                          </button>
                        </div>

                        {/* Note Toggle Button */}
                        <button
                          type="button"
                          onClick={() => setActiveNoteStudentId(isNoteOpen ? null : sId)}
                          className={cn(
                            "p-1.5 rounded-md border text-xs transition-colors",
                            currentNote.trim().length > 0
                              ? "bg-amber-50 border-amber-300 text-amber-700 font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                          title="Tambah Catatan"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Note Input (Appears when active or has note) */}
                    {isNoteOpen && (
                      <div className="pt-1.5 pl-7 pr-1">
                        <Input
                          value={currentNote}
                          onChange={(e) => handleNoteChange(sId, e.target.value)}
                          placeholder="Catatan siswa (misal: Sakit demam, Izin acara keluarga, Terlambat 15 menit)..."
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-3 pb-3 bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Total {attendanceStats.total} siswa terdaftar di sesi ini.
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={handleSaveAttendance}
              disabled={loading}
              className="w-full sm:w-auto bg-primary text-xs font-semibold"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Simpan Presensi Siswa
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
