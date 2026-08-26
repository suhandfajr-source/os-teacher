"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import type { Prisma } from "@prisma/client";
import {
  createMonitoringNote,
  updateMonitoringNote,
  resolveMonitoringFollowUp,
  archiveMonitoringNote,
} from "@/modules/monitoring/monitoring.actions";
import {
  AttendanceFactualSummary,
  AssessmentFactualSummary,
  MonitoringTimelineEvent,
  MonitoringNoteItem,
} from "@/modules/monitoring/monitoring.types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Calendar,
  BookOpen,
  Award,
  FileText,
  Clock,
  Archive,
  Edit2,
  Plus,
  RotateCcw,
  Check,
} from "lucide-react";

interface DetailProps {
  initialData: {
    context: {
      id: string;
      class: { name: string };
      subject: { name: string };
      academicPeriod: { year: string; semester: string };
    };
    student: {
      id: string;
      fullName: string;
      nis: string | null;
      status: string;
    };
    isCurrentRosterStudent: boolean;
    attendanceSummary: AttendanceFactualSummary;
    assessmentSummary: AssessmentFactualSummary;
    runningPerformance: {
      availableWeight: number;
      runningPerformance: number | null;
      categories: Array<{
        assessmentTypeId: string;
        assessmentTypeName: string;
        category: string;
        weight: number;
        categoryAverage: number | null;
        completedAssessmentCount: number;
      }>;
    } | null;
    attendanceRecords: Array<{
      id: string;
      status: "PRESENT" | "SICK" | "PERMISSION" | "ABSENT" | "LATE";
      note: string | null;
      teachingSession: {
        id: string;
        date: Date | string;
        plannedTopic: string | null;
        actualTopic: string | null;
      };
    }>;
    assessmentResults: Array<{
      id: string;
      status: string;
      finalScore: Prisma.Decimal | number | null;
      assessment: {
        id: string;
        title: string;
        status: string;
        assessmentDate: Date | string;
        minimumPassingScore: Prisma.Decimal | number | null;
        assessmentType: {
          id: string;
          name: string;
        };
      };
      remedialAttempts: Array<{
        id: string;
        score: Prisma.Decimal | number;
        attemptDate: Date | string;
        note: string | null;
      }>;
    }>;
    notes: MonitoringNoteItem[];
    timeline: MonitoringTimelineEvent[];
  };
}

export function StudentMonitoringDetailClient({ initialData }: DetailProps) {
  const router = useRouter();
  const {
    context,
    student,
    isCurrentRosterStudent,
    attendanceSummary,
    assessmentSummary,
    runningPerformance,
    attendanceRecords,
    assessmentResults,
    notes,
    timeline,
  } = initialData;

  const [activeTab, setActiveTab] = useState<"NOTES" | "ASSESSMENT" | "ATTENDANCE" | "TIMELINE">("NOTES");

  // Note form state
  const [noteContent, setNoteContent] = useState("");
  const [requiresFollowUp, setRequiresFollowUp] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Edit Note state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editRequiresFollowUp, setEditRequiresFollowUp] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Note list filter
  const [noteFilter, setNoteFilter] = useState<"ALL" | "OPEN" | "RESOLVED" | "ARCHIVED">("ALL");

  const openFollowUpCount = notes.filter((n) => n.requiresFollowUp && n.resolvedAt === null && !n.isArchived).length;

  const filteredNotes = notes.filter((n) => {
    if (noteFilter === "ARCHIVED") return n.isArchived;
    if (n.isArchived) return false;
    if (noteFilter === "OPEN") return n.requiresFollowUp && n.resolvedAt === null;
    if (noteFilter === "RESOLVED") return n.requiresFollowUp && n.resolvedAt !== null;
    return true;
  });

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) {
      toast.error("Isi catatan tidak boleh kosong");
      return;
    }

    try {
      setIsSubmittingNote(true);
      await createMonitoringNote({
        teachingContextId: context.id,
        studentId: student.id,
        content: noteContent,
        requiresFollowUp,
      });

      toast.success("Catatan monitoring berhasil disimpan");
      setNoteContent("");
      setRequiresFollowUp(false);
      router.refresh();
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "Gagal menyimpan catatan");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editContent.trim()) {
      toast.error("Isi catatan tidak boleh kosong");
      return;
    }

    try {
      setIsSavingEdit(true);
      await updateMonitoringNote({
        noteId,
        content: editContent,
        requiresFollowUp: editRequiresFollowUp,
      });

      toast.success("Catatan berhasil diperbarui");
      setEditingNoteId(null);
      router.refresh();
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "Gagal memperbarui catatan");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleResolve = async (noteId: string, currentResolved: boolean) => {
    try {
      await resolveMonitoringFollowUp({
        noteId,
        resolved: !currentResolved,
      });

      toast.success(!currentResolved ? "Tindak lanjut ditandai selesai" : "Tindak lanjut dibuka kembali");
      router.refresh();
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "Gagal mengubah status tindak lanjut");
    }
  };

  const handleArchiveNote = async (noteId: string) => {
    if (!confirm("Apakah Anda yakin ingin mengarsipkan catatan ini?")) return;

    try {
      await archiveMonitoringNote({ noteId });
      toast.success("Catatan berhasil diarsipkan");
      router.refresh();
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "Gagal mengarsipkan catatan");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/kelas/${context.id}/monitoring`} className="hover:text-primary flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          <span>Monitoring {context.class.name}</span>
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{student.fullName}</span>
      </div>

      {/* Header Profile Card */}
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{student.fullName}</h1>
                {!isCurrentRosterStudent && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-xs">
                    Riwayat Siswa (Non-Aktif di Roster Saat Ini)
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                NIS: <span className="text-foreground font-medium">{student.nis || "—"}</span> &bull; Kelas:{" "}
                <span className="text-foreground font-medium">{context.class.name}</span> &bull; Mapel:{" "}
                <span className="text-foreground font-medium">{context.subject.name}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {openFollowUpCount > 0 && (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold px-3 py-1 text-xs">
                  {openFollowUpCount} Tindak Lanjut Terbuka
                </Badge>
              )}
              {assessmentSummary.belowKktpCount > 0 && (
                <Badge variant="destructive" className="px-3 py-1 text-xs font-bold">
                  {assessmentSummary.belowKktpCount} Nilai Di Bawah KKTP
                </Badge>
              )}
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-slate-100 text-xs">
            <div className="p-3 rounded-lg bg-slate-50">
              <div className="text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Presensi
              </div>
              <div className="text-base font-bold text-slate-800 mt-0.5">
                {attendanceSummary.totalRecordedSessions === 0
                  ? "Belum ada"
                  : `${attendanceSummary.presentCount} / ${attendanceSummary.totalRecordedSessions} Hadir`}
              </div>
              {attendanceSummary.absentCount + attendanceSummary.sickCount + attendanceSummary.permissionCount > 0 && (
                <div className="text-[11px] text-rose-600 font-medium mt-0.5">
                  {attendanceSummary.absentCount > 0 && `${attendanceSummary.absentCount} Alpa `}
                  {attendanceSummary.sickCount > 0 && `${attendanceSummary.sickCount} Sakit `}
                  {attendanceSummary.permissionCount > 0 && `${attendanceSummary.permissionCount} Izin`}
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-slate-50">
              <div className="text-muted-foreground flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                Penilaian
              </div>
              <div className="text-base font-bold text-slate-800 mt-0.5">
                {assessmentSummary.gradedResultCount} Nilai Tercatat
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {assessmentSummary.latestGradedScore !== null
                  ? `Terbaru: ${assessmentSummary.latestGradedScore.toFixed(1)}`
                  : "Belum ada nilai"}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50">
              <div className="text-muted-foreground flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-slate-500" />
                Performa Berjalan
              </div>
              <div className="text-base font-bold text-slate-800 mt-0.5">
                {runningPerformance && runningPerformance.runningPerformance !== null
                  ? runningPerformance.runningPerformance.toFixed(1)
                  : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {runningPerformance
                  ? `Bobot tersedia ${runningPerformance.availableWeight}%`
                  : "Belum ada bobot aktif"}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50">
              <div className="text-muted-foreground flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Remedial
              </div>
              <div className="text-base font-bold text-slate-800 mt-0.5">
                {assessmentSummary.remedialCount > 0 ? `${assessmentSummary.remedialCount}x Percobaan` : "Tidak ada"}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {assessmentSummary.belowKktpCount > 0
                  ? `${assessmentSummary.belowKktpCount} perlu tuntas`
                  : "Status tuntas"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Control */}
      <div className="border-b flex gap-4 text-sm font-medium">
        <button
          onClick={() => setActiveTab("NOTES")}
          className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "NOTES"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Catatan & Tindak Lanjut</span>
          {notes.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {notes.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("ASSESSMENT")}
          className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "ASSESSMENT"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Penilaian & Nilai</span>
          {assessmentSummary.gradedResultCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {assessmentSummary.gradedResultCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("ATTENDANCE")}
          className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "ATTENDANCE"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Riwayat Kehadiran</span>
          {attendanceSummary.totalRecordedSessions > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {attendanceSummary.totalRecordedSessions}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("TIMELINE")}
          className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "TIMELINE"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Timeline Aktivitas</span>
        </button>
      </div>

      {/* Tab 1: Catatan Guru & Tindak Lanjut */}
      {activeTab === "NOTES" && (
        <div className="space-y-6">
          {/* Note Creation Form (Current Roster Only) */}
          {isCurrentRosterStudent ? (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" />
                  Tambah Catatan Monitoring Baru
                </CardTitle>
                <CardDescription className="text-xs">
                  Catatan ini bersifat privat untuk konteks kelas mengajar Anda.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateNote} className="space-y-3">
                  <Textarea
                    placeholder="Tuliskan catatan perkembangan, kendala belajar, atau hal yang perlu diperhatikan..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                    maxLength={2000}
                  />

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1">
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={requiresFollowUp}
                        onChange={(e) => setRequiresFollowUp(e.target.checked)}
                        className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                      />
                      <span>Tandai sebagai hal yang memerlukan tindak lanjut</span>
                    </label>

                    <Button type="submit" size="sm" disabled={isSubmittingNote} className="text-xs">
                      {isSubmittingNote ? "Menyimpan..." : "Simpan Catatan"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <div className="p-3.5 rounded-md bg-slate-50 border text-xs text-muted-foreground">
              Siswa ini tidak lagi terdaftar pada roster kelas aktif saat ini. Penambahan catatan baru dinonaktifkan untuk
              menjaga integritas data historis.
            </div>
          )}

          {/* Note Filter Tabs */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant={noteFilter === "ALL" ? "default" : "outline"}
                onClick={() => setNoteFilter("ALL")}
                className="text-xs h-7"
              >
                Semua ({notes.filter((n) => !n.isArchived).length})
              </Button>
              <Button
                size="sm"
                variant={noteFilter === "OPEN" ? "default" : "outline"}
                onClick={() => setNoteFilter("OPEN")}
                className="text-xs h-7"
              >
                Terbuka ({openFollowUpCount})
              </Button>
              <Button
                size="sm"
                variant={noteFilter === "RESOLVED" ? "default" : "outline"}
                onClick={() => setNoteFilter("RESOLVED")}
                className="text-xs h-7"
              >
                Selesai ({notes.filter((n) => n.requiresFollowUp && n.resolvedAt !== null && !n.isArchived).length})
              </Button>
              <Button
                size="sm"
                variant={noteFilter === "ARCHIVED" ? "default" : "outline"}
                onClick={() => setNoteFilter("ARCHIVED")}
                className="text-xs h-7"
              >
                Diarsipkan ({notes.filter((n) => n.isArchived).length})
              </Button>
            </div>
          </div>

          {/* Notes List */}
          {filteredNotes.length === 0 ? (
            <Card className="p-8 text-center bg-slate-50 border-dashed">
              <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <h4 className="font-semibold text-sm">Belum Ada Catatan Monitoring</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {noteFilter === "ALL"
                  ? "Belum ada catatan yang ditambahkan untuk siswa ini."
                  : "Tidak ada catatan dengan filter yang dipilih."}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note) => {
                const isEditing = editingNoteId === note.id;

                return (
                  <Card key={note.id} className={`border-slate-200 ${note.isArchived ? "bg-slate-50/70" : "bg-white"}`}>
                    <CardContent className="p-4 space-y-3">
                      {isEditing ? (
                        <div className="space-y-3">
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={3}
                            className="text-sm"
                            maxLength={2000}
                          />

                          <div className="flex justify-between items-center">
                            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-slate-700">
                              <input
                                type="checkbox"
                                checked={editRequiresFollowUp}
                                onChange={(e) => setEditRequiresFollowUp(e.target.checked)}
                                className="rounded border-slate-300 text-primary h-4 w-4"
                              />
                              <span>Perlu tindak lanjut</span>
                            </label>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingNoteId(null)}
                                className="text-xs h-8"
                              >
                                Batal
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(note.id)}
                                disabled={isSavingEdit}
                                className="text-xs h-8"
                              >
                                {isSavingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(note.createdAt), "dd MMM yyyy, HH:mm", { locale: localeId })}
                              </span>

                              {note.isArchived ? (
                                <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600">
                                  Diarsipkan
                                </Badge>
                              ) : note.requiresFollowUp ? (
                                note.resolvedAt ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                                  >
                                    Tindak Lanjut Selesai (
                                    {format(new Date(note.resolvedAt), "dd/MM/yy", { locale: localeId })})
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-100 text-amber-800 border-amber-300 font-bold text-[10px]"
                                  >
                                    Perlu Tindak Lanjut
                                  </Badge>
                                )
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-slate-500">
                                  Catatan Biasa
                                </Badge>
                              )}
                            </div>

                            {!note.isArchived && (
                              <div className="flex items-center gap-1">
                                {note.requiresFollowUp && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleToggleResolve(note.id, !!note.resolvedAt)}
                                    className="h-7 px-2 text-xs text-slate-600 hover:text-primary"
                                  >
                                    {note.resolvedAt ? (
                                      <>
                                        <RotateCcw className="w-3 h-3 mr-1" />
                                        Buka Kembali
                                      </>
                                    ) : (
                                      <>
                                        <Check className="w-3 h-3 mr-1 text-emerald-600" />
                                        Tandai Selesai
                                      </>
                                    )}
                                  </Button>
                                )}

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingNoteId(note.id);
                                    setEditContent(note.content);
                                    setEditRequiresFollowUp(note.requiresFollowUp);
                                  }}
                                  className="h-7 px-2 text-xs text-slate-600 hover:text-primary"
                                >
                                  <Edit2 className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleArchiveNote(note.id)}
                                  className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50"
                                >
                                  <Archive className="w-3 h-3 mr-1" />
                                  Arsipkan
                                </Button>
                              </div>
                            )}
                          </div>

                          <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                            {note.content}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Penilaian & Nilai */}
      {activeTab === "ASSESSMENT" && (
        <div className="space-y-6">
          {/* Running Grade Policy Breakdown (If Active) */}
          {runningPerformance && (
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base font-semibold">Performa Berdasarkan Bobot Aktif</CardTitle>
                    <CardDescription className="text-xs">
                      Dihitung dari komponen penilaian yang sudah selesai dan dinilai.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-bold">
                    Performa: {runningPerformance.runningPerformance !== null ? runningPerformance.runningPerformance.toFixed(1) : "—"} (Bobot {runningPerformance.availableWeight}%)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {runningPerformance.categories.map((cat) => (
                    <div key={cat.assessmentTypeId} className="p-3 rounded-lg border bg-slate-50/70 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-800">{cat.assessmentTypeName}</span>
                        <span className="text-muted-foreground">{cat.weight}%</span>
                      </div>
                      <div className="text-lg font-bold text-slate-900">
                        {cat.categoryAverage !== null ? cat.categoryAverage.toFixed(1) : "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {cat.completedAssessmentCount} asesmen selesai
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Assessment Results Table */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Riwayat Penilaian Kelas</CardTitle>
              <CardDescription className="text-xs">
                Daftar nilai hasil evaluasi pembelajaran pada kelas ini.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assessmentResults.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-xs">
                  Belum ada data penilaian pada kelas ini.
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b font-semibold text-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3">Penilaian</th>
                        <th className="py-2.5 px-3">Jenis</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">Nilai Akhir</th>
                        <th className="py-2.5 px-3 text-center">KKTP</th>
                        <th className="py-2.5 px-3 text-center">Remedial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assessmentResults.map((res) => {
                        const isCompleted = res.assessment.status === "COMPLETED";
                        const isGraded = res.status === "GRADED" && res.finalScore !== null;
                        const kktp = res.assessment.minimumPassingScore ? Number(res.assessment.minimumPassingScore) : null;
                        const numScore = res.finalScore !== null ? Number(res.finalScore) : null;
                        const isBelowKktp = isGraded && kktp !== null && numScore !== null && numScore < kktp;

                        return (
                          <tr key={res.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {format(new Date(res.assessment.assessmentDate), "dd/MM/yyyy", { locale: localeId })}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900">{res.assessment.title}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">{res.assessment.assessmentType.name}</td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge
                                variant="outline"
                                className={
                                  res.status === "GRADED"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                                    : "text-[10px]"
                                }
                              >
                                {res.status === "GRADED" && "Dinilai"}
                                {res.status === "ABSENT" && "Tidak Hadir"}
                                {res.status === "EXCUSED" && "Dikecualikan"}
                                {res.status === "PENDING" && "Pending"}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-sm">
                              {numScore !== null ? numScore.toFixed(1) : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {!isCompleted || !isGraded || kktp === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : isBelowKktp ? (
                                <Badge variant="destructive" className="text-[10px] font-bold">
                                  Di Bawah ({kktp})
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                  Tuntas ({kktp})
                                </Badge>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {res.remedialAttempts.length > 0 ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  {res.remedialAttempts.length}x
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 3: Riwayat Kehadiran */}
      {activeTab === "ATTENDANCE" && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Riwayat Presensi Siswa</CardTitle>
            <CardDescription className="text-xs">
              Rincian kehadiran dari seluruh sesi pertemuan kelas yang telah dicatat.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="p-2.5 rounded bg-emerald-50 text-emerald-800 font-medium">
                <div className="text-lg font-bold">{attendanceSummary.presentCount}</div>
                Hadir
              </div>
              <div className="p-2.5 rounded bg-yellow-50 text-yellow-800 font-medium">
                <div className="text-lg font-bold">{attendanceSummary.lateCount}</div>
                Terlambat
              </div>
              <div className="p-2.5 rounded bg-amber-50 text-amber-800 font-medium">
                <div className="text-lg font-bold">{attendanceSummary.sickCount}</div>
                Sakit
              </div>
              <div className="p-2.5 rounded bg-slate-100 text-slate-800 font-medium">
                <div className="text-lg font-bold">{attendanceSummary.permissionCount}</div>
                Izin
              </div>
              <div className="p-2.5 rounded bg-rose-50 text-rose-800 font-medium col-span-2 sm:col-span-1">
                <div className="text-lg font-bold">{attendanceSummary.absentCount}</div>
                Alpa
              </div>
            </div>

            {attendanceRecords.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                Belum ada data presensi tercatat untuk siswa ini.
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b font-semibold text-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Topik Pertemuan</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceRecords.map((att) => (
                      <tr key={att.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {format(new Date(att.teachingSession.date), "dd/MM/yyyy", { locale: localeId })}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {att.teachingSession.actualTopic || att.teachingSession.plannedTopic || "Pertemuan Pembelajaran"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge
                            variant="outline"
                            className={
                              att.status === "PRESENT"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                                : att.status === "ABSENT"
                                ? "bg-rose-50 text-rose-700 border-rose-200 text-[10px]"
                                : att.status === "SICK"
                                ? "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                                : "text-[10px]"
                            }
                          >
                            {att.status === "PRESENT" && "Hadir"}
                            {att.status === "LATE" && "Terlambat"}
                            {att.status === "SICK" && "Sakit"}
                            {att.status === "PERMISSION" && "Izin"}
                            {att.status === "ABSENT" && "Alpa"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{att.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Timeline Aktivitas */}
      {activeTab === "TIMELINE" && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Timeline Aktivitas Siswa</CardTitle>
            <CardDescription className="text-xs">
              Kronologi faktual seluruh interaksi kehadiran, penilaian, remedial, dan catatan guru.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                Belum ada aktivitas tercatat untuk siswa ini pada kelas ini.
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {timeline.map((ev) => (
                  <div key={ev.id} className="relative group">
                    {/* Dot */}
                    <div className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-slate-400 group-hover:bg-primary transition-colors" />

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-900">{ev.title}</span>
                        {ev.badge && (
                          <Badge
                            variant={
                              ev.badge.variant === "destructive"
                                ? "destructive"
                                : "outline"
                            }
                            className={`text-[10px] ${
                              ev.badge.variant === "warning"
                                ? "bg-amber-100 text-amber-800 border-amber-300 font-bold"
                                : ev.badge.variant === "success"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : ""
                            }`}
                          >
                            {ev.badge.text}
                          </Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground ml-auto">
                          {format(new Date(ev.date), "dd MMM yyyy", { locale: localeId })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{ev.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
