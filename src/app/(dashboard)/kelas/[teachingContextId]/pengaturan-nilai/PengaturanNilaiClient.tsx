"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createAssessmentType,
  renameAssessmentType,
  archiveAssessmentType,
  applyStarterTemplate,
  saveGradePolicyItems,
  activateGradePolicy,
  copyGradePolicy,
} from "@/modules/assessment/assessment.actions";
import { Plus, Edit2, Archive, Copy, Sparkles, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import type { Prisma } from "@prisma/client";

interface AssessmentTypeItem {
  id: string;
  name: string;
  normalizedName: string;
  category: string;
  isActive: boolean;
}

interface GradePolicyItemData {
  id: string;
  assessmentTypeId: string;
  weight: Prisma.Decimal | number;
  sortOrder: number;
  assessmentType: AssessmentTypeItem;
}

interface GradePolicyData {
  id: string;
  status: "DRAFT" | "ACTIVE";
  items: GradePolicyItemData[];
}

interface OtherContext {
  id: string;
  class: { name: string };
  subject: { name: string };
  academicPeriod: { year: string; semester: string };
  gradePolicy: { items: Array<{ id: string; weight: Prisma.Decimal | number }> } | null;
}

interface Props {
  teachingContextId: string;
  policy: GradePolicyData | null;
  assessmentTypes: AssessmentTypeItem[];
  otherContexts: OtherContext[];
  scoredAssessmentCount: number;
}

export default function PengaturanNilaiClient({
  teachingContextId,
  policy,
  assessmentTypes,
  otherContexts,
  scoredAssessmentCount,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Type modal state
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeCategory, setNewTypeCategory] = useState<
    "ASSIGNMENT" | "FORMATIVE" | "SUMMATIVE" | "MIDTERM" | "FINAL_TERM" | "SCHOOL_EXAM" | "PRACTICE" | "PROJECT" | "OTHER"
  >("OTHER");

  // Rename modal state
  const [editingType, setEditingType] = useState<AssessmentTypeItem | null>(null);
  const [editTypeName, setEditTypeName] = useState("");

  // Weight edit working copy
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    if (policy?.items) {
      for (const item of policy.items) {
        map[item.assessmentTypeId] = Number(item.weight);
      }
    }
    return map;
  });

  // Copy policy modal state
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedSourceContextId, setSelectedSourceContextId] = useState("");

  // Confirmation before save when scored data exists
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<"SAVE" | "ACTIVATE" | null>(null);

  // Calculate live total weight
  const totalWeight = Object.entries(weights).reduce((acc, [typeId, val]) => {
    // only count if type is currently active
    const isActive = assessmentTypes.some((t) => t.id === typeId);
    return isActive ? acc + (Number(val) || 0) : acc;
  }, 0);

  const isExact100 = Math.abs(totalWeight - 100) < 0.01;

  const handleApplyTemplate = async () => {
    setLoading(true);
    try {
      await applyStarterTemplate(teachingContextId);
      toast.success("Template bobot nilai berhasil diterapkan (Status: DRAFT). Silakan tinjau dan aktifkan.");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menerapkan template.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    setLoading(true);
    try {
      const created = await createAssessmentType({
        teachingContextId,
        name: newTypeName.trim(),
        category: newTypeCategory,
      });
      toast.success(`Jenis penilaian "${created.name}" berhasil dibuat.`);
      setShowAddTypeModal(false);
      setNewTypeName("");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat jenis penilaian.");
    } finally {
      setLoading(false);
    }
  };

  const handleRenameType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingType || !editTypeName.trim()) return;
    setLoading(true);
    try {
      await renameAssessmentType({
        id: editingType.id,
        name: editTypeName.trim(),
      });
      toast.success("Nama jenis penilaian berhasil diperbarui.");
      setEditingType(null);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah nama jenis penilaian.");
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveType = async (type: AssessmentTypeItem) => {
    if (!confirm(`Arsipkan jenis penilaian "${type.name}"? Data penilaian sebelumnya akan tetap tersimpan aman.`)) {
      return;
    }
    setLoading(true);
    try {
      await archiveAssessmentType(type.id);
      toast.success(`Jenis penilaian "${type.name}" berhasil diarsipkan.`);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengarsipkan jenis penilaian.");
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (typeId: string, value: string) => {
    const num = parseFloat(value) || 0;
    setWeights((prev) => ({
      ...prev,
      [typeId]: num,
    }));
  };

  const executeSaveWeights = async () => {
    if (!policy) return;
    setLoading(true);
    try {
      const itemsPayload = assessmentTypes.map((t, idx) => ({
        assessmentTypeId: t.id,
        weight: weights[t.id] || 0,
        sortOrder: idx,
      }));

      await saveGradePolicyItems({
        gradePolicyId: policy.id,
        items: itemsPayload,
      });

      toast.success("Bobot nilai berhasil disimpan.");
      setShowConfirmModal(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan bobot nilai.");
    } finally {
      setLoading(false);
    }
  };

  const executeActivatePolicy = async () => {
    if (!policy) return;
    setLoading(true);
    try {
      // First save current weights
      const itemsPayload = assessmentTypes.map((t, idx) => ({
        assessmentTypeId: t.id,
        weight: weights[t.id] || 0,
        sortOrder: idx,
      }));

      await saveGradePolicyItems({
        gradePolicyId: policy.id,
        items: itemsPayload,
      });

      await activateGradePolicy(policy.id);
      toast.success("Pengaturan bobot nilai berhasil DIAKTIFKAN!");
      setShowConfirmModal(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengaktifkan pengaturan nilai.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTrigger = () => {
    if (scoredAssessmentCount > 0) {
      setPendingAction("SAVE");
      setShowConfirmModal(true);
    } else {
      executeSaveWeights();
    }
  };

  const handleActivateTrigger = () => {
    if (!isExact100) {
      toast.error(`Total bobot harus tepat 100.00% untuk diaktifkan. Total saat ini: ${totalWeight.toFixed(2)}%`);
      return;
    }
    if (scoredAssessmentCount > 0) {
      setPendingAction("ACTIVATE");
      setShowConfirmModal(true);
    } else {
      executeActivatePolicy();
    }
  };

  const handleCopyPolicy = async () => {
    if (!selectedSourceContextId) return;
    setLoading(true);
    try {
      await copyGradePolicy({
        sourceTeachingContextId: selectedSourceContextId,
        targetTeachingContextId: teachingContextId,
        confirmed: true,
      });
      toast.success("Pengaturan nilai berhasil disalin dalam status DRAFT.");
      setShowCopyModal(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menyalin pengaturan nilai.");
    } finally {
      setLoading(false);
    }
  };

  // FIRST TIME SETUP / EMPTY STATE
  if (!policy && assessmentTypes.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-12 px-4 border rounded-xl bg-slate-50 space-y-4">
          <Sparkles className="w-12 h-12 text-primary mx-auto" />
          <h2 className="text-2xl font-bold">Atur Bobot & Jenis Penilaian</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Tentukan jenis penilaian (seperti Tugas, Ulangan Harian, UTS, UAS) dan bobot persentasenya untuk perhitungan rekapitulasi nilai akhir.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              size="lg"
              onClick={handleApplyTemplate}
              disabled={loading}
              className="font-semibold"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Gunakan Template (Tugas 20%, UH 30%, UTS 20%, UAS 30%)
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setShowAddTypeModal(true)}
              disabled={loading}
            >
              <Plus className="w-4 h-4 mr-2" />
              Atur Sendiri (Kustom)
            </Button>
          </div>
        </div>

        {/* Add Type Modal */}
        {showAddTypeModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
              <h3 className="text-lg font-bold">Tambah Jenis Penilaian Baru</h3>
              <form onSubmit={handleCreateType} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nama Jenis Penilaian</label>
                  <Input
                    placeholder="Contoh: Tugas Mandiri, Praktik Ibadah"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Kategori Internal</label>
                  <select
                    className="w-full border rounded-md p-2 text-sm"
                    value={newTypeCategory}
                    onChange={(e) =>
                      setNewTypeCategory(
                        e.target.value as
                          | "ASSIGNMENT"
                          | "FORMATIVE"
                          | "SUMMATIVE"
                          | "MIDTERM"
                          | "FINAL_TERM"
                          | "SCHOOL_EXAM"
                          | "PRACTICE"
                          | "PROJECT"
                          | "OTHER"
                      )
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
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowAddTypeModal(false)}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={loading}>
                    Simpan
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pengaturan Bobot & Jenis Penilaian</h2>
          <p className="text-sm text-muted-foreground">
            Kelola jenis penilaian dan konfigurasi bobot untuk perhitungan rekapitulasi nilai.
          </p>
        </div>

        <div className="flex gap-2">
          {otherContexts.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowCopyModal(true)}>
              <Copy className="w-4 h-4 mr-2" />
              Salin dari Kelas Lain
            </Button>
          )}
          <Button size="sm" onClick={() => setShowAddTypeModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Jenis Penilaian
          </Button>
        </div>
      </div>

      {/* Policy Status Banner */}
      <Card className={policy?.status === "ACTIVE" ? "border-green-200 bg-green-50/40" : "border-amber-200 bg-amber-50/40"}>
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {policy?.status === "ACTIVE" ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-600" />
            )}
            <div>
              <div className="font-semibold flex items-center gap-2">
                Status Pengaturan Nilai:
                <Badge variant={policy?.status === "ACTIVE" ? "default" : "secondary"}>
                  {policy?.status === "ACTIVE" ? "AKTIF" : "DRAFT (BELUM AKTIF)"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {policy?.status === "ACTIVE"
                  ? "Bobot nilai aktif digunakan untuk rekapitulasi performa berjalan siswa."
                  : "Pengaturan belum aktif. Rekapitulasi bobot nilai akhir hanya muncul setelah status diaktifkan (Total tepat 100%)."}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-medium text-muted-foreground">Total Bobot Saat Ini</div>
            <div className={`text-xl font-bold ${isExact100 ? "text-green-600" : "text-amber-600"}`}>
              {totalWeight.toFixed(2)}%
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assessment Types & Weight Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Komponen Penilaian & Bobot</CardTitle>
          <CardDescription>
            Masukkan bobot persentase untuk setiap jenis penilaian yang aktif. Total bobot harus tepat 100.00% untuk dapat diaktifkan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="py-3 px-4 text-left font-semibold">Jenis Penilaian</th>
                  <th className="py-3 px-4 text-left font-semibold">Kategori Internal</th>
                  <th className="py-3 px-4 text-center font-semibold w-36">Bobot (%)</th>
                  <th className="py-3 px-4 text-right font-semibold w-32">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {assessmentTypes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      Belum ada jenis penilaian yang aktif.
                    </td>
                  </tr>
                ) : (
                  assessmentTypes.map((type) => (
                    <tr key={type.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-medium">{type.name}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {type.category}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            className="w-24 text-center h-8"
                            value={weights[type.id] !== undefined ? weights[type.id] : 0}
                            onChange={(e) => handleWeightChange(type.id, e.target.value)}
                          />
                          <span className="text-muted-foreground text-xs">%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setEditingType(type);
                              setEditTypeName(type.name);
                            }}
                            title="Ubah Nama"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            onClick={() => handleArchiveType(type)}
                            title="Arsipkan"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-50 border-t font-semibold">
                <tr>
                  <td colSpan={2} className="py-3 px-4 text-right">
                    Total Bobot:
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={isExact100 ? "text-green-600 font-bold" : "text-amber-600 font-bold"}>
                      {totalWeight.toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-xs">
                    {isExact100 ? (
                      <span className="text-green-600">✓ Tepat 100%</span>
                    ) : (
                      <span className="text-amber-600">
                        {totalWeight < 100
                          ? `Kurang ${(100 - totalWeight).toFixed(2)}%`
                          : `Kelebihan ${(totalWeight - 100).toFixed(2)}%`}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleSaveTrigger}
              disabled={loading || !policy}
            >
              Simpan Draft
            </Button>
            <Button
              onClick={handleActivateTrigger}
              disabled={loading || !policy || !isExact100}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Aktifkan Pengaturan (100%)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal when modifying scored data */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-amber-600">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-900">Konfirmasi Perubahan Bobot</h3>
            </div>
            <p className="text-sm text-slate-600">
              Terdapat <strong>{scoredAssessmentCount} penilaian</strong> yang telah dinilai di kelas ini.
            </p>
            <p className="text-xs text-muted-foreground bg-slate-50 p-3 rounded border">
              ℹ️ <strong>Perhatian:</strong> Perubahan bobot hanya akan memperbarui perhitungan performa berjalan (rekapitulasi nilai akhir). Nilai mentah, nilai asli, dan riwayat remedial siswa <strong>TIDAK</strong> akan berubah.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
                Batal
              </Button>
              <Button
                onClick={() => {
                  if (pendingAction === "ACTIVATE") executeActivatePolicy();
                  else executeSaveWeights();
                }}
                disabled={loading}
              >
                Lanjutkan & Terapkan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Type Modal */}
      {showAddTypeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold">Tambah Jenis Penilaian Baru</h3>
            <form onSubmit={handleCreateType} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Jenis Penilaian</label>
                <Input
                  placeholder="Contoh: Tugas Mandiri, Praktik Ibadah"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kategori Internal</label>
                <select
                  className="w-full border rounded-md p-2 text-sm"
                  value={newTypeCategory}
                  onChange={(e) =>
                    setNewTypeCategory(
                      e.target.value as
                        | "ASSIGNMENT"
                        | "FORMATIVE"
                        | "SUMMATIVE"
                        | "MIDTERM"
                        | "FINAL_TERM"
                        | "SCHOOL_EXAM"
                        | "PRACTICE"
                        | "PROJECT"
                        | "OTHER"
                    )
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
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddTypeModal(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={loading}>
                  Simpan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Type Modal */}
      {editingType && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold">Ubah Nama Jenis Penilaian</h3>
            <form onSubmit={handleRenameType} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Baru</label>
                <Input
                  value={editTypeName}
                  onChange={(e) => setEditTypeName(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingType(null)}>
                  Batal
                </Button>
                <Button type="submit" disabled={loading}>
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy Policy Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold">Salin Pengaturan dari Kelas Lain</h3>
            <p className="text-sm text-muted-foreground">
              Menyalin jenis penilaian dan bobot persentase dari kelas yang Anda ajar. Pengaturan yang disalin akan tersimpan sebagai <strong>DRAFT</strong> untuk ditinjau.
            </p>

            <div className="space-y-3">
              <label className="block text-sm font-medium">Pilih Kelas Sumber</label>
              <select
                className="w-full border rounded-md p-2 text-sm"
                value={selectedSourceContextId}
                onChange={(e) => setSelectedSourceContextId(e.target.value)}
              >
                <option value="">-- Pilih Kelas Sumber --</option>
                {otherContexts.map((ctx) => (
                  <option key={ctx.id} value={ctx.id}>
                    {ctx.class.name} &bull; {ctx.subject.name} ({ctx.academicPeriod.year} {ctx.academicPeriod.semester})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowCopyModal(false)}>
                Batal
              </Button>
              <Button
                onClick={handleCopyPolicy}
                disabled={loading || !selectedSourceContextId}
              >
                Salin Pengaturan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
