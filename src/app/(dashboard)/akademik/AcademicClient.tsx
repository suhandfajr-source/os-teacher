"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  BookOpen,
  ListOrdered,
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
  createAcademicPlanItem,
  archiveAcademicPlanItem,
} from "@/modules/academic/academic.actions";
import { getMonthNameIndonesian } from "@/modules/academic/academic.service";
import {
  AcademicContextProfileData,
  LearningObjectiveData,
  AcademicPlanItemData,
} from "@/modules/academic/academic.types";
import { AcademicPlanType } from "@prisma/client";

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

  const [activeTab, setActiveTab] = useState<"profile" | "objectives" | "plan">("profile");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Profile Form state
  const [curriculumName, setCurriculumName] = useState(initialData?.profile?.curriculumName || "");
  const [phase, setPhase] = useState(initialData?.profile?.phase || "");
  const [academicNote, setAcademicNote] = useState(initialData?.profile?.academicNote || "");
  const [cpText, setCpText] = useState(initialData?.profile?.cpText || "");

  // New TP Form state
  const [showAddTp, setShowAddTp] = useState(false);
  const [tpCode, setTpCode] = useState("");
  const [tpDescription, setTpDescription] = useState("");

  // Edit TP Form state
  const [editingTpId, setEditingTpId] = useState<string | null>(null);
  const [editTpCode, setEditTpCode] = useState("");
  const [editTpDesc, setEditTpDesc] = useState("");

  // Plan Type state
  const [selectedPlanType, setSelectedPlanType] = useState<AcademicPlanType>(AcademicPlanType.PROSEM);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [planMonth, setPlanMonth] = useState<string>("");
  const [planHours, setPlanHours] = useState<string>("");
  const [planNotes, setPlanNotes] = useState("");

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
        });
        setStatusMessage({ type: "success", text: "Profil akademik dan CP berhasil disimpan!" });
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Gagal menyimpan profil akademik.";
        setStatusMessage({ type: "error", text: message });
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
        });
        setTpCode("");
        setTpDescription("");
        setShowAddTp(false);
        setStatusMessage({ type: "success", text: "Tujuan Pembelajaran (TP) berhasil ditambahkan!" });
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Gagal membuat TP.";
        setStatusMessage({ type: "error", text: message });
      }
    });
  };

  // Update TP
  const handleUpdateTp = (objectiveId: string) => {
    if (!editTpDesc.trim()) {
      setStatusMessage({ type: "error", text: "Deskripsi TP wajib diisi." });
      return;
    }
    setStatusMessage(null);
    startTransition(async () => {
      try {
        await updateLearningObjective({
          objectiveId,
          code: editTpCode.trim() || null,
          description: editTpDesc.trim(),
        });
        setEditingTpId(null);
        setStatusMessage({ type: "success", text: "Tujuan Pembelajaran berhasil diperbarui!" });
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Gagal memperbarui TP.";
        setStatusMessage({ type: "error", text: message });
      }
    });
  };

  // Archive TP
  const handleArchiveTp = (objectiveId: string) => {
    if (!confirm("Arsipkan Tujuan Pembelajaran ini? Riwayat tautan pada pertemuan dan penilaian terdahulu akan tetap dipertahankan.")) {
      return;
    }
    setStatusMessage(null);
    startTransition(async () => {
      try {
        await archiveLearningObjective(objectiveId);
        setStatusMessage({ type: "success", text: "Tujuan Pembelajaran berhasil diarsipkan." });
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Gagal mengarsipkan TP.";
        setStatusMessage({ type: "error", text: message });
      }
    });
  };

  // Reorder TP
  const handleMoveTp = (index: number, direction: "up" | "down", activeTps: LearningObjectiveData[]) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeTps.length) return;

    const newOrder = [...activeTps];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    const orderedIds = newOrder.map((t) => t.id);
    startTransition(async () => {
      try {
        await reorderLearningObjectives({
          teachingContextId: selectedContextId,
          orderedObjectiveIds: orderedIds,
        });
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Gagal mengatur urutan ATP.";
        setStatusMessage({ type: "error", text: message });
      }
    });
  };

  // Create Plan Item
  const handleCreatePlanItem = () => {
    if (!planTitle.trim()) {
      setStatusMessage({ type: "error", text: "Judul materi program wajib diisi." });
      return;
    }
    setStatusMessage(null);
    startTransition(async () => {
      try {
        const monthNum = planMonth ? parseInt(planMonth, 10) : null;
        const hoursNum = planHours ? parseInt(planHours, 10) : null;
        await createAcademicPlanItem({
          teachingContextId: selectedContextId,
          planType: selectedPlanType,
          title: planTitle.trim(),
          targetMonth: monthNum,
          allocatedHours: hoursNum,
          notes: planNotes.trim() || null,
        });
        setPlanTitle("");
        setPlanMonth("");
        setPlanHours("");
        setPlanNotes("");
        setShowAddPlan(false);
        setStatusMessage({ type: "success", text: `Program ${selectedPlanType} berhasil ditambahkan!` });
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Gagal membuat program.";
        setStatusMessage({ type: "error", text: message });
      }
    });
  };

  // Archive Plan Item
  const handleArchivePlanItem = (id: string) => {
    if (!confirm("Arsipkan item program ini?")) return;
    setStatusMessage(null);
    startTransition(async () => {
      try {
        await archiveAcademicPlanItem(id);
        setStatusMessage({ type: "success", text: "Program berhasil diarsipkan." });
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Gagal mengarsipkan program.";
        setStatusMessage({ type: "error", text: message });
      }
    });
  };

  const activeObjectives = initialData?.objectives?.filter((o) => o.status === "ACTIVE") || [];
  const archivedObjectives = initialData?.objectives?.filter((o) => o.status === "ARCHIVED") || [];
  const activePlanItems =
    initialData?.planItems?.filter((p) => p.planType === selectedPlanType && p.status === "ACTIVE") || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Akademik & Kurikulum</h1>
          <p className="text-sm text-muted-foreground">
            Konteks akademik opsional: Profil Kurikulum, CP, Tujuan Pembelajaran (ATP), dan Program Perencanaan (Prota/Prosem).
          </p>
        </div>

        {/* Context Selector */}
        {contexts.length > 0 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="context-select" className="text-xs font-semibold uppercase text-muted-foreground whitespace-nowrap">
              Kelas:
            </Label>
            <select
              id="context-select"
              value={selectedContextId}
              onChange={(e) => handleContextChange(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {contexts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.className} • {c.subjectName} ({c.academicPeriodYear})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {statusMessage && (
        <div
          className={`flex items-center gap-2 p-3 text-sm rounded-md border ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200"
          }`}
        >
          {statusMessage.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {contexts.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent className="space-y-3">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">Belum Ada Kelas Pembelajaran</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Silakan buat kelas atau hubungkan mata pelajaran terlebih dahulu di Pengaturan atau Kelas Saya.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Sub Navigation Tabs */}
          <div className="flex border-b space-x-6 text-sm font-medium">
            <button
              onClick={() => setActiveTab("profile")}
              className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
                activeTab === "profile" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpen className="h-4 w-4" />
              Profil & CP
            </button>
            <button
              onClick={() => setActiveTab("objectives")}
              className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
                activeTab === "objectives" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListOrdered className="h-4 w-4" />
              Tujuan Pembelajaran (ATP)
              {activeObjectives.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                  {activeObjectives.length}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab("plan")}
              className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
                activeTab === "plan" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="h-4 w-4" />
              Program Perencanaan (Prota/Prosem)
            </button>
          </div>

          {/* TAB 1: Profil & CP */}
          {activeTab === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Profil Kurikulum & Capaian Pembelajaran (CP)
                </CardTitle>
                <CardDescription>
                  Informasi kurikulum dan teks Capaian Pembelajaran yang menjadi rujukan kelas ini.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="curriculumName">Nama Kurikulum (Opsional)</Label>
                    <Input
                      id="curriculumName"
                      placeholder="e.g. Kurikulum Merdeka"
                      value={curriculumName}
                      onChange={(e) => setCurriculumName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phase">Fase / Tingkat (Opsional)</Label>
                    <Input
                      id="phase"
                      placeholder="e.g. Fase E (Kelas 10)"
                      value={phase}
                      onChange={(e) => setPhase(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cpText">Capaian Pembelajaran (CP) Rujukan</Label>
                  <Textarea
                    id="cpText"
                    rows={4}
                    placeholder="Masukkan narasi atau poin Capaian Pembelajaran (CP) sebagai rujukan pembelajaran..."
                    value={cpText}
                    onChange={(e) => setCpText(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="academicNote">Catatan Akademik Guru (Opsional)</Label>
                  <Textarea
                    id="academicNote"
                    rows={3}
                    placeholder="Catatan strategi pengajaran, fokus kompetensi, atau penyesuaian materi..."
                    value={academicNote}
                    onChange={(e) => setAcademicNote(e.target.value)}
                  />
                </div>

                <Button onClick={handleSaveProfile} disabled={isPending} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {isPending ? "Menyimpan..." : "Simpan Profil Akademik"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* TAB 2: Tujuan Pembelajaran (ATP) */}
          {activeTab === "objectives" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-4 rounded-lg border">
                <div>
                  <h3 className="text-base font-semibold">Alur Tujuan Pembelajaran (ATP)</h3>
                  <p className="text-xs text-muted-foreground">
                    Urutan Tujuan Pembelajaran (TP) ini menjadi rujukan alur pengajaran dan penilaian kelas.
                  </p>
                </div>
                {!showAddTp && (
                  <Button size="sm" onClick={() => setShowAddTp(true)} className="flex items-center gap-1.5">
                    <Plus className="h-4 w-4" />
                    Tambah TP
                  </Button>
                )}
              </div>

              {/* Add TP Card */}
              {showAddTp && (
                <Card className="border-primary/50 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Tambah Tujuan Pembelajaran Baru</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="tpCode" className="text-xs">
                          Kode TP (Opsional)
                        </Label>
                        <Input
                          id="tpCode"
                          placeholder="e.g. TP 1.1"
                          value={tpCode}
                          onChange={(e) => setTpCode(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1">
                        <Label htmlFor="tpDescription" className="text-xs">
                          Deskripsi Tujuan Pembelajaran *
                        </Label>
                        <Input
                          id="tpDescription"
                          placeholder="e.g. Peserta didik mampu mengidentifikasi struktur teks deskripsi dengan tepat."
                          value={tpDescription}
                          onChange={(e) => setTpDescription(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => setShowAddTp(false)}>
                        Batal
                      </Button>
                      <Button size="sm" onClick={handleCreateTp} disabled={isPending}>
                        {isPending ? "Menyimpan..." : "Simpan TP"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Active TP List */}
              {activeObjectives.length === 0 ? (
                <Card className="text-center py-10">
                  <CardContent className="space-y-2">
                    <HelpCircle className="h-10 w-10 mx-auto text-muted-foreground/40" />
                    <p className="text-sm font-medium">Belum Ada Tujuan Pembelajaran</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Klik &quot;Tambah TP&quot; untuk menyusun alur kompetensi pembelajaran yang dapat ditautkan ke pertemuan dan penilaian.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {activeObjectives.map((tp, idx) => (
                    <Card key={tp.id} className="p-3 transition-all hover:border-primary/30">
                      {editingTpId === tp.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <Input
                              placeholder="Kode TP"
                              value={editTpCode}
                              onChange={(e) => setEditTpCode(e.target.value)}
                            />
                            <div className="md:col-span-3">
                              <Input
                                placeholder="Deskripsi TP"
                                value={editTpDesc}
                                onChange={(e) => setEditTpDesc(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setEditingTpId(null)}>
                              Batal
                            </Button>
                            <Button size="sm" onClick={() => handleUpdateTp(tp.id)} disabled={isPending}>
                              Simpan Perubahan
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
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
                              className="h-8 w-8"
                              disabled={idx === 0 || isPending}
                              onClick={() => handleMoveTp(idx, "up", activeObjectives)}
                              title="Pindah ke atas"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              disabled={idx === activeObjectives.length - 1 || isPending}
                              onClick={() => handleMoveTp(idx, "down", activeObjectives)}
                              title="Pindah ke bawah"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setEditingTpId(tp.id);
                                setEditTpCode(tp.code || "");
                                setEditTpDesc(tp.description);
                              }}
                              title="Edit TP"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-amber-600"
                              onClick={() => handleArchiveTp(tp.id)}
                              title="Arsipkan TP"
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}

              {/* Archived TP Section */}
              {archivedObjectives.length > 0 && (
                <div className="pt-6 border-t space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Archive className="h-3.5 w-3.5" />
                    Tujuan Pembelajaran Diarsipkan ({archivedObjectives.length})
                  </h4>
                  <div className="space-y-1.5 opacity-75">
                    {archivedObjectives.map((tp) => (
                      <div key={tp.id} className="flex items-center justify-between p-2.5 rounded border bg-muted/20 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            Arsip
                          </Badge>
                          {tp.code && <span className="font-mono font-semibold">{tp.code}</span>}
                          <span>{tp.description}</span>
                        </div>
                        <span className="text-muted-foreground text-[11px]">
                          {tp._count?.sessionLinks || 0} sesi • {tp._count?.assessmentLinks || 0} penilaian
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Program Perencanaan (Prota / Prosem) */}
          {activeTab === "plan" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">Tipe Program:</span>
                  <div className="flex rounded-md bg-muted p-1 border">
                    <button
                      onClick={() => setSelectedPlanType(AcademicPlanType.PROSEM)}
                      className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                        selectedPlanType === AcademicPlanType.PROSEM ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      Program Semester (PROSEM)
                    </button>
                    <button
                      onClick={() => setSelectedPlanType(AcademicPlanType.PROTA)}
                      className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                        selectedPlanType === AcademicPlanType.PROTA ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      Program Tahunan (PROTA)
                    </button>
                  </div>
                </div>

                {!showAddPlan && (
                  <Button size="sm" onClick={() => setShowAddPlan(true)} className="flex items-center gap-1.5">
                    <Plus className="h-4 w-4" />
                    Tambah Item {selectedPlanType}
                  </Button>
                )}
              </div>

              {/* Add Plan Card */}
              {showAddPlan && (
                <Card className="border-primary/50 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Tambah Item {selectedPlanType}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="planTitle" className="text-xs">
                        Materi / Pokok Bahasan *
                      </Label>
                      <Input
                        id="planTitle"
                        placeholder="e.g. Bab 1: Menulis Teks Laporan Hasil Observasi"
                        value={planTitle}
                        onChange={(e) => setPlanTitle(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedPlanType === AcademicPlanType.PROSEM && (
                        <div className="space-y-1">
                          <Label htmlFor="planMonth" className="text-xs">
                            Bulan Pelaksanaan (1-12)
                          </Label>
                          <select
                            id="planMonth"
                            value={planMonth}
                            onChange={(e) => setPlanMonth(e.target.value)}
                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="">Pilih Bulan (Opsional)</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                              <option key={m} value={m}>
                                Bulan {m} ({getMonthNameIndonesian(m)})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label htmlFor="planHours" className="text-xs">
                          Alokasi Jam Pelajaran (JP)
                        </Label>
                        <Input
                          id="planHours"
                          type="number"
                          min="1"
                          placeholder="e.g. 6"
                          value={planHours}
                          onChange={(e) => setPlanHours(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="planNotes" className="text-xs">
                        Catatan / Keterangan (Opsional)
                      </Label>
                      <Input
                        id="planNotes"
                        placeholder="e.g. Dilengkapi asesmen formatif 1"
                        value={planNotes}
                        onChange={(e) => setPlanNotes(e.target.value)}
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => setShowAddPlan(false)}>
                        Batal
                      </Button>
                      <Button size="sm" onClick={handleCreatePlanItem} disabled={isPending}>
                        {isPending ? "Menyimpan..." : "Simpan Item"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Plan Item Table */}
              {activePlanItems.length === 0 ? (
                <Card className="text-center py-10">
                  <CardContent className="space-y-2">
                    <Calendar className="h-10 w-10 mx-auto text-muted-foreground/40" />
                    <p className="text-sm font-medium">Belum Ada Item {selectedPlanType}</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Tambahkan pokok bahasan dan alokasi waktu untuk menyusun perencanaan pembelajaran berkala.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="overflow-x-auto rounded-lg border bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground">
                        <th className="px-4 py-3 text-left w-12">No</th>
                        <th className="px-4 py-3 text-left">Materi / Pokok Bahasan</th>
                        {selectedPlanType === AcademicPlanType.PROSEM && <th className="px-4 py-3 text-left w-32">Bulan</th>}
                        <th className="px-4 py-3 text-left w-24">Alokasi (JP)</th>
                        <th className="px-4 py-3 text-left">Keterangan</th>
                        <th className="px-4 py-3 text-right w-24">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {activePlanItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 text-muted-foreground font-mono">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium">{item.title}</td>
                          {selectedPlanType === AcademicPlanType.PROSEM && (
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {item.targetMonth ? getMonthNameIndonesian(item.targetMonth) : "-"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-xs font-mono">{item.allocatedHours ? `${item.allocatedHours} JP` : "-"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{item.notes || "-"}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-amber-600"
                              onClick={() => handleArchivePlanItem(item.id)}
                              title="Arsipkan"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
