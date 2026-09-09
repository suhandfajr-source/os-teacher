"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckSquare, Users, FlaskConical, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LkpdFlowProps {
  topic: string;
  setTopic: (val: string) => void;
  onSubmit: (composedInstruction: string, tone: "CONCISE" | "STANDARD" | "DETAILED") => void;
  isGenerating: boolean;
  selectedContextLabel?: string;
}

const ACTIVITY_TYPES = [
  "Eksperimen / Praktikum Terbimbing",
  "Analisis Studi Kasus Kontekstual",
  "Diskusi Kelompok & Peta Masalah",
  "Observasi Lingkungan Nyata",
  "Latihan Terstruktur Berjenjang (Scaffolded)",
];

export function LkpdFlow({
  topic,
  setTopic,
  onSubmit,
  isGenerating,
  selectedContextLabel,
}: LkpdFlowProps) {
  const [activityType, setActivityType] = useState<string>("Analisis Studi Kasus Kontekstual");
  const [workMode, setWorkMode] = useState<"KELOMPOK" | "INDIVIDU">("KELOMPOK");
  const [targetDuration, setTargetDuration] = useState<string>("40 Menit (1 Jam Pelajaran)");
  const [stimulusInput, setStimulusInput] = useState<string>("");
  const [specificInstructions, setSpecificInstructions] = useState<string>("");

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parts: string[] = [];
    parts.push(`[PANDUAN LEMBAR KERJA PESERTA DIDIK (LKPD) INTERAKTIF]`);
    parts.push(`- Jenis Aktivitas Siswa: ${activityType}`);
    parts.push(`- Moda Kerja: ${workMode === "KELOMPOK" ? "Berkelompok (3-4 Siswa)" : "Mandiri / Individu"}`);
    parts.push(`- Estimasi Waktu Pengerjaan: ${targetDuration}`);

    if (stimulusInput.trim()) {
      parts.push(`- Wajib Menggunakan Stimulus/Kasus Ini:\n"${stimulusInput.trim()}"`);
    }

    if (specificInstructions.trim()) {
      parts.push(`- Catatan Khusus Guru:\n${specificInstructions.trim()}`);
    }

    parts.push(`- Struktur Format LKPD yang Dihasilkan:
1. Header Identitas Siswa (Nama Kelompok / Anggota, Kelas, Tanggal).
2. Judul Lembar Kerja & Tujuan Pembelajaran yang Menarik.
3. Stimulus / Deskripsi Masalah / Bacaan Pengantar.
4. Alat, Bahan, atau Petunjuk Kerja Langkah demi Langkah.
5. Lembar Kerja Isian Siswa (Sediakan tabel pengamatan dan ruang bertitik-titik / box tempat siswa menuliskan jawaban atau hipotesis).
6. Pertanyaan Pemantik & Analisis Bertingkat (Mudah -> Menantang).
7. Kesimpulan & Refleksi Singkat Siswa.`);

    onSubmit(parts.join("\n"), "DETAILED");
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-5">
      {/* Topik / Pokok Bahasan */}
      <div className="space-y-2">
        <Label htmlFor="lkpd-topic" className="text-sm font-semibold flex items-center gap-1.5 text-slate-800">
          <CheckSquare className="w-4 h-4 text-amber-600" />
          Topik Aktivitas LKPD <span className="text-rose-500">*</span>
        </Label>
        <Input
          id="lkpd-topic"
          placeholder="Contoh: Menyelidiki Pengaruh Suhu terhadap Laju Reaksi Kimia"
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

      {/* Jenis Aktivitas & Moda Pengerjaan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
            <FlaskConical className="w-4 h-4 text-amber-600" />
            Bentuk / Model Lembar Kerja
          </Label>
          <select
            aria-label="Bentuk Model Lembar Kerja"
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            disabled={isGenerating}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
            <Users className="w-4 h-4 text-amber-600" />
            Moda Pengerjaan
          </Label>
          <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setWorkMode("KELOMPOK")}
              className={`flex-1 py-1.5 text-center rounded ${
                workMode === "KELOMPOK"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Kelompok
            </button>
            <button
              type="button"
              onClick={() => setWorkMode("INDIVIDU")}
              className={`flex-1 py-1.5 text-center rounded ${
                workMode === "INDIVIDU"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Individu
            </button>
          </div>
        </div>
      </div>

      {/* Stimulus / Kasus Masalah */}
      <div className="space-y-2">
        <Label htmlFor="lkpd-stimulus" className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
          <HelpCircle className="w-4 h-4 text-amber-600" />
          Stimulus Masalah / Fenomena Pengantar (Opsional)
        </Label>
        <Textarea
          id="lkpd-stimulus"
          placeholder="Contoh: Berikan kasus pencemaran sungai akibat limbah detergen di daerah perkotaan, mintalah siswa menemukan solusinya..."
          value={stimulusInput}
          onChange={(e) => setStimulusInput(e.target.value)}
          disabled={isGenerating}
          rows={2}
          className="bg-white text-sm resize-none"
        />
      </div>

      {/* Durasi & Catatan Khusus */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lkpd-duration" className="text-sm font-medium text-slate-700">
            Alokasi Waktu Pengerjaan
          </Label>
          <Input
            id="lkpd-duration"
            value={targetDuration}
            onChange={(e) => setTargetDuration(e.target.value)}
            placeholder="Contoh: 30-40 Menit"
            disabled={isGenerating}
            className="bg-white text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lkpd-notes" className="text-sm font-medium text-slate-700">
            Instruksi Tambahan (Opsional)
          </Label>
          <Input
            id="lkpd-notes"
            value={specificInstructions}
            onChange={(e) => setSpecificInstructions(e.target.value)}
            placeholder="Misal: Sertakan tabel perbandingan 3 kolom..."
            disabled={isGenerating}
            className="bg-white text-sm"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <Badge variant="outline" className="text-xs text-amber-700 border-amber-200 bg-amber-50">
          Format cetak siap pakai untuk siswa
        </Badge>

        <Button
          type="submit"
          disabled={isGenerating || !topic.trim()}
          className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {isGenerating ? "Menyusun LKPD..." : "Buat LKPD Interaktif"}
        </Button>
      </div>
    </form>
  );
}
