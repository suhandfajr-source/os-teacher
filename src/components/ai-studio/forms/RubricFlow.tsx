"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Sliders, CheckCheck, Table } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RubricFlowProps {
  topic: string;
  setTopic: (val: string) => void;
  onSubmit: (composedInstruction: string, tone: "CONCISE" | "STANDARD" | "DETAILED") => void;
  isGenerating: boolean;
  selectedContextLabel?: string;
}

export function RubricFlow({
  topic,
  setTopic,
  onSubmit,
  isGenerating,
  selectedContextLabel,
}: RubricFlowProps) {
  const [assessmentActivity, setAssessmentActivity] = useState<string>("Presentasi & Diskusi Kelompok");
  const [scaleType, setScaleType] = useState<string>("4_TIER_MERDEKA");
  const [aspectsCount, setAspectsCount] = useState<number>(4);
  const [rubricNotes, setRubricNotes] = useState<string>("");

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parts: string[] = [];
    parts.push(`[PANDUAN RUBRIK PENILAIAN AUTENTIK BERTAHAP]`);
    parts.push(`- Aktivitas / Tugas yang Dinilai: ${assessmentActivity}`);
    parts.push(`- Jumlah Aspek Penilaian: ${aspectsCount} Aspek Kunci`);

    const scaleDescription =
      scaleType === "4_TIER_MERDEKA"
        ? "Skala 4 Tingkat Kurikulum Merdeka (1: Perlu Bimbingan, 2: Cukup, 3: Cakap, 4: Mahir)"
        : "Skala Kuantitatif 3 Tingkat (1: Kurang, 2: Baik, 3: Sangat Baik)";

    parts.push(`- Skala Capaian: ${scaleDescription}`);

    if (rubricNotes.trim()) {
      parts.push(`- Kriteria Khusus Guru:\n"${rubricNotes.trim()}"`);
    }

    parts.push(`- Format Penulisan:
1. Judul Rubrik & Petunjuk Penggunaan untuk Guru/Penilai.
2. Tabel Matriks Rubrik Penilaian (Kolom: No, Aspek/Indikator yang Dinilai, Deskriptor Level 1, Deskriptor Level 2, Deskriptor Level 3, Deskriptor Level 4).
3. Rumus / Pedoman Konversi Nilai Akhir.
4. Lembar Catatan Umpan Balik Kualitatif Guru.`);

    onSubmit(parts.join("\n"), "DETAILED");
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-5">
      {/* Topik / Tugas yang Dinilai */}
      <div className="space-y-2">
        <Label htmlFor="rub-topic" className="text-sm font-semibold flex items-center gap-1.5 text-slate-800">
          <Sliders className="w-4 h-4 text-rose-600" />
          Tugas / Unjuk Kerja yang Dinilai <span className="text-rose-500">*</span>
        </Label>
        <Input
          id="rub-topic"
          placeholder="Contoh: Penilaian Proyek Pembuatan Infografis Sains / Penilaian Praktik Pidato"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={isGenerating}
          className="bg-white"
          required
        />
        {selectedContextLabel && (
          <p className="text-xs text-slate-500">
            Terkait dengan konteks kelas: <span className="font-medium text-slate-700">{selectedContextLabel}</span>
          </p>
        )}
      </div>

      {/* Jenis Aktivitas & Skala Penilaian */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
            <CheckCheck className="w-4 h-4 text-rose-600" />
            Jenis Penilaian
          </Label>
          <select
            aria-label="Jenis Penilaian"
            value={assessmentActivity}
            onChange={(e) => setAssessmentActivity(e.target.value)}
            disabled={isGenerating}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="Presentasi & Diskusi Kelompok">Presentasi & Diskusi Kelompok</option>
            <option value="Hasil Produk / Karya / Portofolio">Hasil Produk / Portofolio / Poster</option>
            <option value="Kinerja Praktikum Laboratorium">Unjuk Kerja / Praktikum Lab</option>
            <option value="Penulisan Makalah / Esai">Penulisan Laporan / Esai Ilmiah</option>
            <option value="Sikap & Karakter Profil Pelajar Pancasila">Observasi Sikap & Profil Pancasila</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
            <Table className="w-4 h-4 text-rose-600" />
            Skala Kriteria Capaian
          </Label>
          <select
            aria-label="Skala Kriteria Capaian"
            value={scaleType}
            onChange={(e) => setScaleType(e.target.value)}
            disabled={isGenerating}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="4_TIER_MERDEKA">4 Tingkat (Perlu Bimbingan, Cukup, Cakap, Mahir)</option>
            <option value="3_TIER_SIMPLE">3 Tingkat (Kurang, Baik, Sangat Baik)</option>
          </select>
        </div>
      </div>

      {/* Catatan / Kriteria Khusus */}
      <div className="space-y-2">
        <Label htmlFor="rub-notes" className="text-sm font-medium text-slate-700">
          Aspek Penekanan Khusus (Opsional)
        </Label>
        <Textarea
          id="rub-notes"
          placeholder="Misal: Beri penekanan tinggi pada keaslian data, kejelasan suara saat presentasi, dan kolaborasi antar anggota kelompok..."
          value={rubricNotes}
          onChange={(e) => setRubricNotes(e.target.value)}
          disabled={isGenerating}
          rows={2}
          className="bg-white text-sm resize-none"
        />
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <Badge variant="outline" className="text-xs text-rose-700 border-rose-200 bg-rose-50">
          Disarankan ekspor ke Word (.docx) atau Excel (.xlsx)
        </Badge>

        <Button
          type="submit"
          disabled={isGenerating || !topic.trim()}
          className="bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-sm"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {isGenerating ? "Menyusun Rubrik..." : "Buat Rubrik Penilaian"}
        </Button>
      </div>
    </form>
  );
}
