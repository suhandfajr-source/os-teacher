"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, BookOpen, Clock, Target, Layers, Table, AlignLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LessonPlanFlowProps {
  topic: string;
  setTopic: (val: string) => void;
  onSubmit: (composedInstruction: string, tone: "CONCISE" | "STANDARD" | "DETAILED") => void;
  isGenerating: boolean;
  selectedContextLabel?: string;
}

const LEARNING_MODELS = [
  "Problem Based Learning (PBL)",
  "Project Based Learning (PjBL)",
  "Discovery Learning",
  "Inquiry Learning",
  "Differentiated Learning (Berdiferensiasi)",
  "Kontekstual (CTL)",
];

const PPP_DIMENSIONS = [
  "Beriman & Bertakwa",
  "Bernalar Kritis",
  "Kreatif",
  "Gotong Royong",
  "Mandiri",
  "Berkebinekaan Global",
];

export function LessonPlanFlow({
  topic,
  setTopic,
  onSubmit,
  isGenerating,
  selectedContextLabel,
}: LessonPlanFlowProps) {
  const [layoutFormat, setLayoutFormat] = useState<"TABLE_MATRIX" | "STRUCTURED_NARRATIVE">("TABLE_MATRIX");
  const [learningModel, setLearningModel] = useState<string>("Problem Based Learning (PBL)");
  const [selectedPpp, setSelectedPpp] = useState<string[]>(["Bernalar Kritis", "Kreatif"]);
  const [learningGoal, setLearningGoal] = useState<string>("");
  const [timeAllocation, setTimeAllocation] = useState<string>("2 x 45 Menit (1 Pertemuan)");
  const [additionalNotes, setAdditionalNotes] = useState<string>("");
  const [tone, setTone] = useState<"CONCISE" | "STANDARD" | "DETAILED">("DETAILED");

  const togglePpp = (dim: string) => {
    setSelectedPpp((prev) =>
      prev.includes(dim) ? prev.filter((d) => d !== dim) : [...prev, dim]
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parts: string[] = [];
    parts.push(`[PANDUAN SUSUNAN MODUL AJAR / RPP]`);
    parts.push(`- Model Pembelajaran: ${learningModel}`);
    parts.push(`- Alokasi Waktu: ${timeAllocation}`);
    if (selectedPpp.length > 0) {
      parts.push(`- Dimensi Profil Pelajar Pancasila: ${selectedPpp.join(", ")}`);
    }
    if (learningGoal.trim()) {
      parts.push(`- Tujuan Pembelajaran (TP) Khusus: ${learningGoal.trim()}`);
    }
    if (additionalNotes.trim()) {
      parts.push(`- Catatan Khusus Guru: ${additionalNotes.trim()}`);
    }

    if (layoutFormat === "TABLE_MATRIX") {
      parts.push(`- FORMAT UTAMA: MODEL MATRIKS TABEL (RPP / MODUL AJAR TABEL EFISIEN 1-2 LEMBAR)`);
      parts.push(`- Wajib susun ke dalam format Markdown Table yang rapi dan presisi:
1. TABEL 1: IDENTITAS & CAPAIAN PEMBELAJARAN
| Komponen | Keterangan Rinci |
|---|---|
| Satuan Pendidikan / Kelas / Semester | ... |
| Mata Pelajaran / Topik Pokok | ${topic} |
| Alokasi Waktu / Model Pembelajaran | ${timeAllocation} / ${learningModel} |
| Tujuan Pembelajaran (TP) | ... |
| Dimensi Profil Pelajar Pancasila | ${selectedPpp.join(", ") || "Bernalar Kritis"} |

2. TABEL 2: MATRIKS SKENARIO KEGIATAN PEMBELAJARAN (Sintaks ${learningModel})
| Tahapan / Sintaks | Peran & Aktivitas Guru | Aktivitas Aktif Peserta Didik | Alokasi Waktu |
|---|---|---|:---:|
| **Pendahuluan** | • Menyampaikan salam, apersepsi, dan stimulus fenomena.<br>• Menyampaikan pertanyaan pemantik & tujuan pembelajaran. | • Merespons salam & aktif menjawab apersepsi.<br>• Menyimak stimulus & tujuan pembelajaran. | ... Menit |
| **Inti: Fase 1 (Orientasi Masalah)** | • ... | • ... | ... Menit |
| **Inti: Fase 2 & 3 (Penyelidikan Kelompok)** | • ... | • ... | ... Menit |
| **Inti: Fase 4 & 5 (Presentasi & Penguatan)** | • ... | • ... | ... Menit |
| **Penutup & Refleksi** | • Memandu kesimpulan & memberi refleksi formatif. | • Menyimpulkan hikmah pembelajaran & mengisi refleksi. | ... Menit |

3. TABEL 3: MATRIKS ASESMEN & EVALUASI
| Ranah Penilaian | Teknik Penilaian | Bentuk Instrumen | Waktu Penilaian |
|---|---|---|---|
| **Sikap (Afektif)** | Observasi Profil Pelajar Pancasila | Jurnal Sikap & Lembar Observasi | Selama Pembelajaran |
| **Pengetahuan (Kognitif)** | Tes Tertulis / Kuis Formatif | Pilihan Ganda & Soal Analisis Kasus | Akhir Pertemuan |
| **Keterampilan (Psikomotorik)** | Unjuk Kerja Diskusi & Presentasi | Rubrik Penilaian Kinerja Kelompok | Kegiatan Inti |

4. REFLEKSI GURU & SISWA (3 butir pertanyaan reflektif).`);
    } else {
      parts.push(
        `- Struktur Wajib: Identitas & Capaian, Tujuan Pembelajaran, Pertanyaan Pemantik, Kegiatan Pendahuluan (dengan durasi menit), Kegiatan Inti sesuai sintaks ${learningModel} (dengan durasi menit), Kegiatan Penutup & Refleksi (dengan durasi menit), serta Asesmen Formatif/Summatif & Lampiran Ringkas.`
      );
    }

    onSubmit(parts.join("\n"), tone);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-5">
      {/* Topik / Pokok Bahasan */}
      <div className="space-y-2">
        <Label htmlFor="lp-topic" className="text-sm font-semibold flex items-center gap-1.5 text-slate-800">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          Topik / Materi Pokok <span className="text-rose-500">*</span>
        </Label>
        <Input
          id="lp-topic"
          placeholder="Contoh: Sistem Ekskresi pada Manusia / Persamaan Linear Dua Variabel"
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

      {/* Format Tata Letak RPP */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-1.5 text-slate-800">
          <Table className="w-4 h-4 text-indigo-600" />
          Format Tata Letak Dokumen RPP
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setLayoutFormat("TABLE_MATRIX")}
            disabled={isGenerating}
            className={`p-3 text-left rounded-xl border transition-all flex items-start gap-2.5 ${
              layoutFormat === "TABLE_MATRIX"
                ? "border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600 shadow-xs"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div className={`p-1.5 rounded-lg ${layoutFormat === "TABLE_MATRIX" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
              <Table className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                Model Matriks Tabel
                <Badge className="text-[9px] px-1.5 py-0 bg-emerald-600 hover:bg-emerald-700 text-white">Rekomendasi</Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Tabel perbandingan aktivitas guru & siswa per sintaks (Ringkas, rapi, siap cetak 1-2 lembar).
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setLayoutFormat("STRUCTURED_NARRATIVE")}
            disabled={isGenerating}
            className={`p-3 text-left rounded-xl border transition-all flex items-start gap-2.5 ${
              layoutFormat === "STRUCTURED_NARRATIVE"
                ? "border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600 shadow-xs"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div className={`p-1.5 rounded-lg ${layoutFormat === "STRUCTURED_NARRATIVE" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
              <AlignLeft className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Narasi Terstruktur</div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Format paragraf elaboratif dan uraian langkah panjang (Modul ajar lengkap).
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Model Pembelajaran & Alokasi Waktu */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
            <Layers className="w-4 h-4 text-indigo-600" />
            Model Pembelajaran
          </Label>
          <select
            aria-label="Model Pembelajaran"
            value={learningModel}
            onChange={(e) => setLearningModel(e.target.value)}
            disabled={isGenerating}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {LEARNING_MODELS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lp-time" className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
            <Clock className="w-4 h-4 text-indigo-600" />
            Alokasi Waktu
          </Label>
          <Input
            id="lp-time"
            value={timeAllocation}
            onChange={(e) => setTimeAllocation(e.target.value)}
            placeholder="Contoh: 2 x 45 Menit (1 Pertemuan)"
            disabled={isGenerating}
            className="bg-white text-sm"
          />
        </div>
      </div>

      {/* Profil Pelajar Pancasila (Multi-select Badges) */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">
          Dimensi Profil Pelajar Pancasila (Opsional)
        </Label>
        <div className="flex flex-wrap gap-2">
          {PPP_DIMENSIONS.map((dim) => {
            const isSelected = selectedPpp.includes(dim);
            return (
              <button
                key={dim}
                type="button"
                onClick={() => togglePpp(dim)}
                disabled={isGenerating}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  isSelected
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-medium shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {isSelected ? "✓ " : "+ "}
                {dim}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tujuan Pembelajaran Khusus */}
      <div className="space-y-2">
        <Label htmlFor="lp-goal" className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
          <Target className="w-4 h-4 text-indigo-600" />
          Tujuan Pembelajaran Khusus (Opsional)
        </Label>
        <Input
          id="lp-goal"
          placeholder="Contoh: Peserta didik mampu menganalisis mekanisme pembentukan urine melalui simulasi..."
          value={learningGoal}
          onChange={(e) => setLearningGoal(e.target.value)}
          disabled={isGenerating}
          className="bg-white text-sm"
        />
      </div>

      {/* Catatan / Instruksi Tambahan */}
      <div className="space-y-2">
        <Label htmlFor="lp-notes" className="text-sm font-medium text-slate-700">
          Instruksi / Penyesuaian Tambahan (Opsional)
        </Label>
        <Textarea
          id="lp-notes"
          placeholder="Misal: Sertakan ice breaking interaktif di awal, gunakan analogi filter air, tekankan praktikum kelompok..."
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          disabled={isGenerating}
          rows={2}
          className="bg-white text-sm resize-none"
        />
      </div>

      {/* Kedalaman / Tone */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Tingkat Rincian:</span>
          <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTone("CONCISE")}
              className={`px-2 py-1 rounded ${tone === "CONCISE" ? "bg-white text-slate-900 shadow-xs font-medium" : "text-slate-500 hover:text-slate-900"}`}
            >
              Ringkas (1 Lembar)
            </button>
            <button
              type="button"
              onClick={() => setTone("DETAILED")}
              className={`px-2 py-1 rounded ${tone === "DETAILED" ? "bg-white text-slate-900 shadow-xs font-medium" : "text-slate-500 hover:text-slate-900"}`}
            >
              Lengkap & Detail
            </button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isGenerating || !topic.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {isGenerating ? "Menyusun Modul Ajar..." : "Susun Modul Ajar"}
        </Button>
      </div>
    </form>
  );
}
