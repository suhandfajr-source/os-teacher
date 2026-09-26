"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createAssessment,
  createAssessmentType,
  updateAssessmentType,
  deleteAssessmentType,
} from "@/modules/assessment/assessment.actions";
import { ArrowLeft, Plus, Settings2, Pencil, Trash2, Loader2, Check } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type AssessmentCategoryType =
  | "ASSIGNMENT"
  | "FORMATIVE"
  | "SUMMATIVE"
  | "MIDTERM"
  | "FINAL_TERM"
  | "SCHOOL_EXAM"
  | "PRACTICE"
  | "PROJECT"
  | "OTHER";

interface ContextOption {
  id: string;
  className: string;
  subjectName: string;
  period: string;
  assessmentTypes: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  sessions: Array<{
    id: string;
    date: Date;
    actualTopic: string | null;
    plannedTopic: string | null;
  }>;
}

interface Props {
  contexts: ContextOption[];
}

export default function NewAssessmentClient({ contexts: initialContexts }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedContextId =
    searchParams.get("teachingContextId") ||
    (initialContexts.length > 0 ? initialContexts[0].id : "");

  const [contexts, setContexts] = useState<ContextOption[]>(initialContexts);
  const [teachingContextId, setTeachingContextId] = useState(preselectedContextId);
  const [assessmentTypeId, setAssessmentTypeId] = useState("");
  const [teachingSessionId, setTeachingSessionId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [maxScore, setMaxScore] = useState("100");
  const [minimumPassingScore, setMinimumPassingScore] = useState("75");
  const [hasKKTP, setHasKKTP] = useState(true);
  const [loading, setLoading] = useState(false);

  // Inline Add Type Modal
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeCategory, setNewTypeCategory] = useState<AssessmentCategoryType>("OTHER");

  // Manage Types Modal & Edit Modal
  const [showManageTypesModal, setShowManageTypesModal] = useState(false);
  const [editingType, setEditingType] = useState<{
    id: string;
    name: string;
    category: AssessmentCategoryType;
  } | null>(null);
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null);

  const currentContext = contexts.find((c) => c.id === teachingContextId);
  const availableTypes = currentContext?.assessmentTypes || [];
  const availableSessions = currentContext?.sessions || [];
  const selectedType = availableTypes.find((t) => t.id === assessmentTypeId);

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim() || !teachingContextId) return;
    setLoading(true);
    try {
      const created = await createAssessmentType({
        teachingContextId,
        name: newTypeName.trim(),
        category: newTypeCategory,
      });

      // Update local state
      setContexts((prev) =>
        prev.map((c) =>
          c.id === teachingContextId
            ? {
                ...c,
                assessmentTypes: [
                  ...c.assessmentTypes,
                  { id: created.id, name: created.name, category: created.category },
                ],
              }
            : c
        )
      );

      toast.success(`Jenis penilaian "${created.name}" berhasil dibuat.`);
      setShowAddTypeModal(false);
      setNewTypeName("");
      setAssessmentTypeId(created.id);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat jenis penilaian.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingType || !editingType.name.trim()) return;
    setLoading(true);
    try {
      const updated = await updateAssessmentType({
        id: editingType.id,
        name: editingType.name.trim(),
        category: editingType.category,
      });

      // Update local state
      setContexts((prev) =>
        prev.map((c) =>
          c.id === teachingContextId
            ? {
                ...c,
                assessmentTypes: c.assessmentTypes.map((t) =>
                  t.id === updated.id
                    ? { id: updated.id, name: updated.name, category: updated.category }
                    : t
                ),
              }
            : c
        )
      );

      toast.success(`Jenis penilaian diperbarui menjadi "${updated.name}".`);
      setEditingType(null);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui jenis penilaian.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteType = async (typeId: string, typeName: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus/menonaktifkan jenis penilaian "${typeName}"?`)) {
      return;
    }

    setDeletingTypeId(typeId);
    try {
      const res = await deleteAssessmentType(typeId);

      // Update local state
      setContexts((prev) =>
        prev.map((c) =>
          c.id === teachingContextId
            ? {
                ...c,
                assessmentTypes: c.assessmentTypes.filter((t) => t.id !== typeId),
              }
            : c
        )
      );

      if (assessmentTypeId === typeId) {
        setAssessmentTypeId("");
      }

      toast.success(
        res.mode === "DELETED"
          ? `Jenis penilaian "${typeName}" berhasil dihapus.`
          : `Jenis penilaian "${typeName}" berhasil dinonaktifkan (diarsipkan).`
      );
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus jenis penilaian.");
    } finally {
      setDeletingTypeId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teachingContextId) {
      toast.error("Pilih kelas terlebih dahulu.");
      return;
    }
    if (!assessmentTypeId) {
      toast.error("Pilih jenis penilaian.");
      return;
    }
    const max = parseFloat(maxScore);
    if (isNaN(max) || max <= 0) {
      toast.error("Skor maksimum harus lebih besar dari 0.");
      return;
    }

    setLoading(true);
    try {
      const created = await createAssessment({
        teachingContextId,
        assessmentTypeId,
        teachingSessionId: teachingSessionId || null,
        title: title.trim(),
        description: description.trim() || null,
        assessmentDate: new Date(assessmentDate),
        maxScore: max,
        minimumPassingScore: hasKKTP && minimumPassingScore ? parseFloat(minimumPassingScore) : null,
      });

      toast.success("Penilaian berhasil dibuat!");
      router.push(`/assessment/${created.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat penilaian.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6 pb-16">
      <div>
        <Link
          href={teachingContextId ? `/kelas/${teachingContextId}/penilaian` : "/assessment"}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-3"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Buat Penilaian Baru</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Langkah pertama: atur data penilaian sebelum memulai pengisian lembar skor siswa.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informasi Penilaian</CardTitle>
          <CardDescription>
            Isi detail penilaian seperti kelas, jenis, tanggal, dan skala skor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Pilih Kelas */}
            <div>
              <label className="block text-sm font-medium mb-1">Kelas & Mata Pelajaran *</label>
              <select
                className="w-full border rounded-md p-2.5 text-sm"
                value={teachingContextId}
                onChange={(e) => {
                  setTeachingContextId(e.target.value);
                  setAssessmentTypeId("");
                  setTeachingSessionId("");
                }}
                required
              >
                <option value="">-- Pilih Kelas --</option>
                {contexts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.className} &bull; {c.subjectName} ({c.period})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Pilih / Buat / Kelola Jenis Penilaian */}
            <div>
              <div className="flex justify-between items-center mb-1.5 flex-wrap gap-2">
                <label className="text-sm font-medium">Jenis Penilaian *</label>
                {teachingContextId && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddTypeModal(true)}
                      className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Buat Jenis Baru
                    </button>
                    {availableTypes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowManageTypesModal(true)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 px-2 py-0.5 rounded"
                      >
                        <Settings2 className="w-3 h-3 text-slate-500" /> Kelola Jenis
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="flex-1 border rounded-md p-2.5 text-sm bg-background"
                  value={assessmentTypeId}
                  onChange={(e) => setAssessmentTypeId(e.target.value)}
                  required
                  disabled={!teachingContextId}
                >
                  <option value="">-- Pilih Jenis Penilaian --</option>
                  {availableTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </select>

                {selectedType && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditingType({
                          id: selectedType.id,
                          name: selectedType.name,
                          category: selectedType.category as AssessmentCategoryType,
                        })
                      }
                      className="h-9 px-2.5 text-xs text-slate-700 hover:text-primary gap-1"
                      title="Edit Nama / Kategori Jenis Ini"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteType(selectedType.id, selectedType.name)}
                      disabled={deletingTypeId === selectedType.id}
                      className="h-9 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 gap-1"
                      title="Hapus / Nonaktifkan Jenis Ini"
                    >
                      {deletingTypeId === selectedType.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">Hapus</span>
                    </Button>
                  </div>
                )}
              </div>

              {teachingContextId && availableTypes.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Belum ada jenis penilaian di kelas ini. Klik &quot;+ Buat Jenis Baru&quot; di atas.
                </p>
              )}
            </div>

            {/* 3. Judul Penilaian */}
            <div>
              <label className="block text-sm font-medium mb-1">Judul Penilaian *</label>
              <Input
                placeholder="Contoh: UH 1 — Zakat Fitrah & Mal, Tugas Mandiri 2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* 4. Deskripsi / Catatan */}
            <div>
              <label className="block text-sm font-medium mb-1">Deskripsi / Materi (Opsional)</label>
              <Input
                placeholder="Catatan lingkup materi atau petunjuk penilaian"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* 5. Tanggal Penilaian */}
            <div>
              <label className="block text-sm font-medium mb-1">Tanggal Penilaian *</label>
              <Input
                type="date"
                value={assessmentDate}
                onChange={(e) => setAssessmentDate(e.target.value)}
                required
              />
            </div>

            {/* 6. Tautkan Pertemuan (Opsional) */}
            {availableSessions.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1">Tautkan ke Pertemuan Belajar (Opsional)</label>
                <select
                  className="w-full border rounded-md p-2.5 text-sm"
                  value={teachingSessionId}
                  onChange={(e) => setTeachingSessionId(e.target.value)}
                >
                  <option value="">-- Tidak Ditautkan --</option>
                  {availableSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.date).toLocaleDateString("id-ID")} &bull; {s.actualTopic || s.plannedTopic || "Pertemuan"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 7. Skor Maksimum & KKTP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-sm font-medium mb-1">Skor Maksimum (maxScore) *</label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Contoh: 100, 40, atau 50. Nilai akan dinormalisasi ke skala 0-100.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium">KKTP / Batas Tuntas (0-100)</label>
                  <label className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasKKTP}
                      onChange={(e) => setHasKKTP(e.target.checked)}
                      className="rounded"
                    />
                    Aktifkan KKTP
                  </label>
                </div>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={minimumPassingScore}
                  onChange={(e) => setMinimumPassingScore(e.target.value)}
                  disabled={!hasKKTP}
                  placeholder={hasKKTP ? "75" : "Tanpa KKTP"}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Opsional. Nilai akhir di bawah KKTP otomatis berstatus Perlu Remedial.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/assessment">
                <Button type="button" variant="outline">
                  Batal
                </Button>
              </Link>
              <Button type="submit" disabled={loading} className="font-semibold px-6">
                Simpan & Lanjutkan ke Lembar Nilai
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Modal 1: Buat Jenis Penilaian Baru */}
      {showAddTypeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border">
            <h3 className="text-base font-bold text-slate-900">Buat Jenis Penilaian Baru</h3>
            <form onSubmit={handleCreateType} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Jenis Penilaian <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="Contoh: Tugas Harian, UH / Formatif, UTS, Praktik"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  required
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  💡 Tips: Nama jenis penilaian adalah nama kategori besar (misal: *Formatif* atau *Tugas*), bukan judul ulangan spesifik.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori Internal Pembobotan <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full border rounded-lg p-2 text-sm bg-background"
                  value={newTypeCategory}
                  onChange={(e) => setNewTypeCategory(e.target.value as AssessmentCategoryType)}
                >
                  <option value="ASSIGNMENT">Tugas (ASSIGNMENT)</option>
                  <option value="FORMATIVE">Formatif / UH (FORMATIVE)</option>
                  <option value="SUMMATIVE">Sumatif (SUMMATIVE)</option>
                  <option value="MIDTERM">UTS / PTS / STS (MIDTERM)</option>
                  <option value="FINAL_TERM">UAS / PAS / SAS (FINAL_TERM)</option>
                  <option value="SCHOOL_EXAM">Ujian Sekolah (SCHOOL_EXAM)</option>
                  <option value="PRACTICE">Praktik (PRACTICE)</option>
                  <option value="PROJECT">Proyek (PROJECT)</option>
                  <option value="OTHER">Lainnya (OTHER)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddTypeModal(false)}>
                  Batal
                </Button>
                <Button type="submit" size="sm" disabled={loading} className="bg-primary font-semibold">
                  Buat Jenis
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Jenis Penilaian */}
      {editingType && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
              <Pencil className="w-4 h-4 text-primary" />
              Edit Jenis Penilaian
            </h3>
            <form onSubmit={handleUpdateType} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Jenis Penilaian <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={editingType.name}
                  onChange={(e) => setEditingType({ ...editingType, name: e.target.value })}
                  placeholder="Contoh: Tugas Harian / Formatif"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori Internal Pembobotan <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full border rounded-lg p-2 text-sm bg-background"
                  value={editingType.category}
                  onChange={(e) =>
                    setEditingType({
                      ...editingType,
                      category: e.target.value as AssessmentCategoryType,
                    })
                  }
                >
                  <option value="ASSIGNMENT">Tugas (ASSIGNMENT)</option>
                  <option value="FORMATIVE">Formatif / UH (FORMATIVE)</option>
                  <option value="SUMMATIVE">Sumatif (SUMMATIVE)</option>
                  <option value="MIDTERM">UTS / PTS / STS (MIDTERM)</option>
                  <option value="FINAL_TERM">UAS / PAS / SAS (FINAL_TERM)</option>
                  <option value="SCHOOL_EXAM">Ujian Sekolah (SCHOOL_EXAM)</option>
                  <option value="PRACTICE">Praktik (PRACTICE)</option>
                  <option value="PROJECT">Proyek (PROJECT)</option>
                  <option value="OTHER">Lainnya (OTHER)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingType(null)}>
                  Batal
                </Button>
                <Button type="submit" size="sm" disabled={loading} className="bg-primary font-semibold">
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Kelola Semua Jenis Penilaian di Kelas Ini */}
      {showManageTypesModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <Settings2 className="w-4 h-4 text-primary" />
                  Kelola Jenis Penilaian
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Daftar jenis penilaian aktif pada kelas {currentContext?.className}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowManageTypesModal(false);
                  setShowAddTypeModal(true);
                }}
                className="text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Baru
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y border rounded-xl">
              {availableTypes.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Belum ada jenis penilaian di kelas ini.
                </div>
              ) : (
                availableTypes.map((t) => (
                  <div key={t.id} className="p-3 flex items-center justify-between gap-3 hover:bg-muted/20">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{t.name}</p>
                      <Badge variant="outline" className="text-[10px] font-mono mt-0.5">
                        {t.category}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingType({
                            id: t.id,
                            name: t.name,
                            category: t.category as AssessmentCategoryType,
                          });
                        }}
                        className="h-8 px-2 text-xs text-slate-700 hover:text-primary gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteType(t.id, t.name)}
                        disabled={deletingTypeId === t.id}
                        className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1"
                      >
                        {deletingTypeId === t.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Hapus</span>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowManageTypesModal(false)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
