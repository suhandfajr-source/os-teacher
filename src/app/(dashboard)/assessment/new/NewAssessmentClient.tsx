"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAssessment, createAssessmentType } from "@/modules/assessment/assessment.actions";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";

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

export default function NewAssessmentClient({ contexts }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedContextId = searchParams.get("teachingContextId") || (contexts.length > 0 ? contexts[0].id : "");

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
  const [newTypeCategory, setNewTypeCategory] = useState<
    "ASSIGNMENT" | "FORMATIVE" | "SUMMATIVE" | "MIDTERM" | "FINAL_TERM" | "SCHOOL_EXAM" | "PRACTICE" | "PROJECT" | "OTHER"
  >("OTHER");

  const currentContext = contexts.find((c) => c.id === teachingContextId);
  const availableTypes = currentContext?.assessmentTypes || [];
  const availableSessions = currentContext?.sessions || [];

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

            {/* 2. Pilih / Buat Jenis Penilaian */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium">Jenis Penilaian *</label>
                {teachingContextId && (
                  <button
                    type="button"
                    onClick={() => setShowAddTypeModal(true)}
                    className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Buat Jenis Baru
                  </button>
                )}
              </div>
              <select
                className="w-full border rounded-md p-2.5 text-sm"
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

      {/* Inline Add Type Modal */}
      {showAddTypeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold">Buat Jenis Penilaian Baru</h3>
            <form onSubmit={handleCreateType} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Jenis Penilaian</label>
                <Input
                  placeholder="Contoh: Hafalan Surat, Praktik Sholat"
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
                  Buat Jenis
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
