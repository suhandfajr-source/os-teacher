"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  BookOpen,
  Calendar,
  Plus,
  ArrowUp,
  ArrowDown,
  Archive,
  Edit2,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Layers,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  saveAcademicProfile,
  createLearningObjective,
  updateLearningObjective,
  archiveLearningObjective,
  reorderLearningObjectives,
} from "@/modules/academic/academic.actions";
import {
  AcademicContextProfileData,
  LearningObjectiveData,
  AcademicPlanItemData,
} from "@/modules/academic/academic.types";
import { InteractiveProsemGrid } from "@/components/academic/InteractiveProsemGrid";
import { PlanGenerationWizardModal } from "@/components/academic/PlanGenerationWizardModal";
import { toast } from "sonner";

interface ContextOption {
  id: string;
  className: string;
  subjectName: string;
  academicPeriodYear: string;
  academicPeriodSemester: string;
}

interface Props {
  contexts: ContextOption[];
  initialContextId?: string;
  initialData: {
    profile: AcademicContextProfileData | null;
    objectives: LearningObjectiveData[];
    planItems: AcademicPlanItemData[];
  } | null;
}

export default function AcademicClient({ contexts, initialContextId, initialData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedContextId, setSelectedContextId] = useState<string>(
    initialContextId || (contexts.length > 0 ? contexts[0].id : "")
  );

  const [activeTab, setActiveTab] = useState<"profile" | "planning">("planning");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Wizard Modal State
  const [showWizardModal, setShowWizardModal] = useState(false);

  // Profile Form state
  const [curriculumName, setCurriculumName] = useState(initialData?.profile?.curriculumName || "Kurikulum Merdeka");
  const [phase, setPhase] = useState(initialData?.profile?.phase || "");
  const [academicNote, setAcademicNote] = useState(initialData?.profile?.academicNote || "");
  const [cpText, setCpText] = useState(initialData?.profile?.cpText || "");
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(initialData?.profile?.hoursPerWeek || 3);
  const [effectiveWeeksSem1, setEffectiveWeeksSem1] = useState<number>(initialData?.profile?.effectiveWeeksSem1 || 18);
  const [effectiveWeeksSem2, setEffectiveWeeksSem2] = useState<number>(initialData?.profile?.effectiveWeeksSem2 || 16);

  // New TP Form state
  const [showAddTp, setShowAddTp] = useState(false);
  const [tpCode, setTpCode] = useState("");
  const [tpDescription, setTpDescription] = useState("");
  const [tpSemester, setTpSemester] = useState<number>(1);
  const [tpHours, setTpHours] = useState<number>(6);

  // Edit TP Form state
  const [editingTpId, setEditingTpId] = useState<string | null>(null);
  const [editTpCode, setEditTpCode] = useState("");
  const [editTpDesc, setEditTpDesc] = useState("");
  const [editTpSem, setEditTpSem] = useState<number>(1);
  const [editTpHours, setEditTpHours] = useState<number>(6);

  // Filtered TP lists
  const activeObjectives = initialData?.objectives.filter((o) => o.status === "ACTIVE") || [];
  const archivedObjectives = initialData?.objectives.filter((o) => o.status === "ARCHIVED") || [];

  // Handle Context Change
  const handleContextChange = (newContextId: string) => {
    setSelectedContextId(newContextId);
    setStatusMessage(null);
    router.push(`/akademik?contextId=${newContextId}`);
  };

  // Profile Save
  const handleSaveProfile = () => {
    if (!selectedContextId) return;
    setStatusMessage(null);
    startTransition(async () => {
      try {
        await saveAcademicProfile({
          teachingContextId: selectedContextId,
          curriculumName: curriculumName.trim() || null,
          phase: phase.trim() || null,
          academicNote: academicNote.trim() || null,
          cpText: cpText.trim() || null,
          hoursPerWeek,
          effectiveWeeksSem1,
          effectiveWeeksSem2,
        });
        setStatusMessage({ type: "success", text: "Profil akademik & alokasi jam berhasil disimpan!" });
        toast.success("Profil akademik berhasil disimpan!");
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Gagal menyimpan profil akademik.";
        setStatusMessage({ type: "error", text: message });
        toast.error(message);
      }
    });
  };

  // Create TP
  const handleCreateTp = () => {
    if (!tpDescription.trim()) {
      setStatusMessage({ type: "error", text: "Deskripsi Tujuan Pembelajaran wajib diisi." });
      return;
    }
    setStatusMessage(null);
    startTransition(async () => {
      try {
        await createLearningObjective({
          teachingContextId: selectedContextId,
          code: tpCode.trim() || null,
          description: tpDescription.trim(),
          targetSemester: tpSemester,
          allocatedHours: tpHours,
        });
        setTpCode("");
        setTpDescription("");
        setShowAddTp(false);
        setStatusMessage({ type: "success", text: "Tujuan Pembelajaran (TP) berhasil ditambahkan!" });
        toast.success("TP berhasil ditambahkan!");
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Gagal membuat TP.";
        setStatusMessage({ type: "error", text: message });
        toast.error(message);
      }
    });
  };

  // Update TP
  const handleUpdateTp = (objectiveId: string) => {
    if (!editTpDesc.trim()) return;
    setStatusMessage(null);
    startTransition(async () => {
      try {
        await updateLearningObjective({
          objectiveId,
          code: editTpCode.trim() || null,
          description: editTpDesc.trim(),
          targetSemester: editTpSem,
          allocatedHours: editTpHours,
        });
        setEditingTpId(null);
        setStatusMessage({ type: "success", text: "Tujuan Pembelajaran (TP) berhasil diperbarui!" });
        toast.success("TP berhasil diperbarui!");
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Gagal memperbarui TP.";
        setStatusMessage({ type: "error", text: message });
        toast.error(message);
      }
    });
  };

  // Archive TP
  const handleArchiveTp = (objectiveId: string) => {
    if (!confirm("Arsipkan Tujuan Pembelajaran ini? Link historis pada pertemuan & nilai akan tetap aman.")) return;
    setStatusMessage(null);
    startTransition(async () => {
      try {
        await archiveLearningObjective(objectiveId);
        setStatusMessage({ type: "success", text: "Tujuan Pembelajaran (TP) berhasil diarsipkan." });
        toast.success("TP berhasil diarsipkan.");
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Gagal mengarsipkan TP.";
        setStatusMessage({ type: "error", text: message });
        toast.error(message);
      }
    });
  };

  // Move TP (Reorder ATP)
  const handleMoveTp = (index: number, direction: "up" | "down", list: LearningObjectiveData[]) => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const reordered = [...list];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);

    const orderedIds = reordered.map((o) => o.id);

    startTransition(async () => {
      try {
        await reorderLearningObjectives({
          teachingContextId: selectedContextId,
          orderedObjectiveIds: orderedIds,
        });
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal mengatur urutan TP.");
      }
    });
  };

  // Export handlers (Forwarded to API routes in Phase 4)
  const handleExportExcel = (semester: number) => {
    window.open(`/api/reports/export/prosem-xlsx?contextId=${selectedContextId}&semester=${semester}`, "_blank");
  };

  const handleExportWord = (semester: number) => {
    window.open(`/api/reports/export/prota-docx?contextId=${selectedContextId}&semester=${semester}`, "_blank");
  };

  if (contexts.length === 0) {
    return (
      <div className="container max-w-5xl py-8 px-4 sm:px-6">
        <Card className="text-center p-8">
          <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-lg font-semibold">Belum Ada Kelas Mengajar</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Silakan buat kelas dan jadwal mengajar terlebih dahulu di menu Pengaturan.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-6 px-4 sm:px-6 space-y-6">
      {/* Header & Context Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Akademik & Perencanaan Kurikulum</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola Capaian Pembelajaran (CP), Alur Tujuan Pembelajaran (ATP), serta Matriks Program Semester & Tahunan (PROSEM/PROTA).
          </p>
        </div>

        {/* Class Context Selector */}
        <div className="flex items-center gap-2">
          <Label htmlFor="contextSelect" className="text-xs font-semibold uppercase text-muted-foreground shrink-0">
            KELAS:
          </Label>
          <select
            id="contextSelect"
            value={selectedContextId}
            onChange={(e) => handleContextChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
          >
            {contexts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.className} • {c.subjectName} ({c.academicPeriodYear})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status Feedback Alert */}
      {statusMessage && (
        <div
          className={`p-3 rounded-md text-sm flex items-center gap-2 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Tabs Navigation (2 Tab Ringkas) */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("planning")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "planning"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calendar className="h-4 w-4" />
          Alur TP & Matriks Perencanaan (Prota/Prosem)
        </button>
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "profile"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Profil Kurikulum & Capaian (CP)
        </button>
      </div>

      {/* TAB 1: ALUR TP & MATRIKS PERENCANAAN (PROTA/PROSEM) */}
      {activeTab === "planning" && (
        <div className="space-y-6">
          {/* Interactive Prosem Matrix Grid */}
          <InteractiveProsemGrid
            teachingContextId={selectedContextId}
            initialItems={initialData?.planItems || []}
            hoursPerWeek={hoursPerWeek}
            effectiveWeeksSem1={effectiveWeeksSem1}
            effectiveWeeksSem2={effectiveWeeksSem2}
            onOpenWizard={() => setShowWizardModal(true)}
            onExportExcel={handleExportExcel}
            onExportWord={handleExportWord}
          />

          {/* Collapsible / Section: Tujuan Pembelajaran (ATP Sequence) */}
          <div className="pt-6 border-t space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Alur Tujuan Pembelajaran (ATP)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Daftar Tujuan Pembelajaran terurut yang telah disinkronkan dengan sesi mengajar harian.
                </p>
              </div>

              {!showAddTp && (
                <Button size="sm" variant="outline" onClick={() => setShowAddTp(true)} className="flex items-center gap-1 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  Tambah TP Manual
                </Button>
              )}
            </div>

            {/* Add TP Form Card */}
            {showAddTp && (
              <Card className="border-primary/50 shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Tambah Tujuan Pembelajaran (TP)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="tpCode" className="text-xs">
                        Kode TP (Opsional)
                      </Label>
                      <Input
                        id="tpCode"
                        placeholder="e.g. TP-1.1"
                        value={tpCode}
                        onChange={(e) => setTpCode(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="tpDescription" className="text-xs">
                        Deskripsi Tujuan Pembelajaran *
                      </Label>
                      <Input
                        id="tpDescription"
                        placeholder="e.g. Memahami konsep dasar eksponen dan sifat-sifatnya"
                        value={tpDescription}
                        onChange={(e) => setTpDescription(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Semester</Label>
                        <select
                          value={tpSemester}
                          onChange={(e) => setTpSemester(parseInt(e.target.value) || 1)}
                          className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                        >
                          <option value={1}>Sem 1</option>
                          <option value={2}>Sem 2</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Alokasi (JP)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={tpHours}
                          onChange={(e) => setTpHours(parseInt(e.target.value) || 6)}
                          className="h-8 text-xs text-center"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => setShowAddTp(false)} className="h-8 text-xs">
                      Batal
                    </Button>
                    <Button size="sm" onClick={handleCreateTp} disabled={isPending} className="h-8 text-xs">
                      {isPending ? "Menyimpan..." : "Simpan TP"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* List of Active Objectives */}
            {activeObjectives.length === 0 ? (
              <p className="text-xs text-muted-foreground italic bg-muted/20 p-4 rounded-lg border text-center">
                Belum ada Tujuan Pembelajaran yang tersimpan. Gunakan AI Generator di atas atau tambahkan secara manual.
              </p>
            ) : (
              <div className="space-y-2">
                {activeObjectives.map((tp, idx) => (
                  <Card key={tp.id} className="p-3 transition-all hover:border-primary/30">
                    {editingTpId === tp.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <Input
                            placeholder="Kode TP"
                            value={editTpCode}
                            onChange={(e) => setEditTpCode(e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                          <div className="sm:col-span-2">
                            <Input
                              placeholder="Deskripsi TP"
                              value={editTpDesc}
                              onChange={(e) => setEditTpDesc(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min="1"
                              value={editTpHours}
                              onChange={(e) => setEditTpHours(parseInt(e.target.value) || 6)}
                              className="h-8 text-xs text-center w-20"
                            />
                            <select
                              value={editTpSem}
                              onChange={(e) => setEditTpSem(parseInt(e.target.value) || 1)}
                              className="h-8 text-xs rounded border px-2 flex-1"
                            >
                              <option value={1}>Sem 1</option>
                              <option value={2}>Sem 2</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditingTpId(null)} className="h-7 text-xs">
                            Batal
                          </Button>
                          <Button size="sm" onClick={() => handleUpdateTp(tp.id)} disabled={isPending} className="h-7 text-xs">
                            Simpan Perubahan
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-semibold shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              {tp.code && (
                                <Badge variant="outline" className="font-mono text-xs font-semibold px-2">
                                  {tp.code}
                                </Badge>
                              )}
                              <span className="text-sm font-medium text-foreground">{tp.description}</span>
                              <Badge variant="secondary" className="text-[10px] font-mono">
                                Sem {tp.targetSemester || 1} • {tp.allocatedHours || 6} JP
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                              <span>{tp._count?.sessionLinks || 0} pertemuan terkait</span>
                              <span>•</span>
                              <span>{tp._count?.assessmentLinks || 0} penilaian terkait</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={idx === 0 || isPending}
                            onClick={() => handleMoveTp(idx, "up", activeObjectives)}
                            title="Pindah ke atas"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={idx === activeObjectives.length - 1 || isPending}
                            onClick={() => handleMoveTp(idx, "down", activeObjectives)}
                            title="Pindah ke bawah"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setEditingTpId(tp.id);
                              setEditTpCode(tp.code || "");
                              setEditTpDesc(tp.description);
                              setEditTpSem(tp.targetSemester || 1);
                              setEditTpHours(tp.allocatedHours || 6);
                            }}
                            title="Edit TP"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleArchiveTp(tp.id)}
                            title="Arsipkan TP"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PROFIL KURIKULUM & CAPAIAN (CP) */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Profil Kurikulum & Pengaturan Beban Mengajar
              </CardTitle>
              <CardDescription>
                Atur informasi dasar kurikulum, fase capaian, serta beban jam mingguan untuk kelas ini.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="curriculumName">Nama Kurikulum</Label>
                  <Input
                    id="curriculumName"
                    placeholder="e.g. Kurikulum Merdeka"
                    value={curriculumName}
                    onChange={(e) => setCurriculumName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phase">Fase / Tingkat</Label>
                  <Input
                    id="phase"
                    placeholder="e.g. Fase E (Kelas 10) atau Fase F (Kelas 11-12)"
                    value={phase}
                    onChange={(e) => setPhase(e.target.value)}
                  />
                </div>
              </div>

              {/* Load & Academic Calendar Settings */}
              <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Konfigurasi Jam & Pekan Efektif
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Beban Jam (JP / Minggu)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={hoursPerWeek}
                      onChange={(e) => setHoursPerWeek(parseInt(e.target.value) || 3)}
                      className="h-8 text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pekan Efektif Sem 1 (Ganjil)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="25"
                      value={effectiveWeeksSem1}
                      onChange={(e) => setEffectiveWeeksSem1(parseInt(e.target.value) || 18)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pekan Efektif Sem 2 (Genap)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="25"
                      value={effectiveWeeksSem2}
                      onChange={(e) => setEffectiveWeeksSem2(parseInt(e.target.value) || 16)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpText">Teks Capaian Pembelajaran (CP)</Label>
                <Textarea
                  id="cpText"
                  rows={6}
                  placeholder="Salin dan tempel deskripsi Capaian Pembelajaran (CP) elemen mapel ini di sini..."
                  value={cpText}
                  onChange={(e) => setCpText(e.target.value)}
                  className="leading-relaxed"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="academicNote">Catatan Akademik / Pendekatan Pedagogis</Label>
                <Input
                  id="academicNote"
                  placeholder="e.g. Pembelajaran berbasis proyek (PjBL) & penguatan literasi numerasi"
                  value={academicNote}
                  onChange={(e) => setAcademicNote(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-3">
                <Button onClick={handleSaveProfile} disabled={isPending} className="flex items-center gap-1.5">
                  <Save className="h-4 w-4" />
                  {isPending ? "Menyimpan..." : "Simpan Profil & Pengaturan"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Plan Generation Wizard Modal */}
      <PlanGenerationWizardModal
        open={showWizardModal}
        onClose={() => setShowWizardModal(false)}
        teachingContextId={selectedContextId}
        defaultHoursPerWeek={hoursPerWeek}
        defaultEffectiveWeeksSem1={effectiveWeeksSem1}
        defaultEffectiveWeeksSem2={effectiveWeeksSem2}
        defaultCpText={cpText}
      />
    </div>
  );
}
