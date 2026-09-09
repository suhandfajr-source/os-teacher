"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText, Bookmark, GraduationCap, Compass } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LearningMaterialFlowProps {
  topic: string;
  setTopic: (val: string) => void;
  onSubmit: (composedInstruction: string, tone: "CONCISE" | "STANDARD" | "DETAILED") => void;
  isGenerating: boolean;
  selectedContextLabel?: string;
}

export function LearningMaterialFlow({
  topic,
  setTopic,
  onSubmit,
  isGenerating,
  selectedContextLabel,
}: LearningMaterialFlowProps) {
  const [differentiationLevel, setDifferentiationLevel] = useState<"FOUNDATIONAL" | "STANDARD" | "ENRICHMENT">("STANDARD");
  const [includeGlossary, setIncludeGlossary] = useState<boolean>(true);
  const [includeConceptMap, setIncludeConceptMap] = useState<boolean>(true);
  const [includeAnalogies, setIncludeAnalogies] = useState<boolean>(true);
  const [sourceText, setSourceText] = useState<string>("");
  const [tone, setTone] = useState<"CONCISE" | "STANDARD" | "DETAILED">("STANDARD");

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parts: string[] = [];
    parts.push(`[PANDUAN BAHAN BACAAN & RINGKASAN MATERI DIFERENSIASI]`);

    const levelDescription = {
      FOUNDATIONAL: "Level Dasar / Pemula: Gunakan bahasa sangat ramah siswa, kalimat pendek, analogi konkret sehari-hari, dan hilangkan jargon rumit.",
      STANDARD: "Level Standar Kurikulum: Seimbang antara penjelasan konsep formal, contoh terapan, dan struktur ilmiah.",
      ENRICHMENT: "Level Pengayaan / Lanjutan: Analisis mendalam, studi kasus kritis, korelasi antar-konsep, dan tantangan berpikir tingkat tinggi.",
    }[differentiationLevel];

    parts.push(`- Target Kesiapan Belajar Siswa: ${levelDescription}`);
    parts.push(`- Sertakan Glosarium Istilah Penting: ${includeGlossary ? "YA" : "TIDAK"}`);
    parts.push(`- Sertakan Peta Konsep / Alur Logika: ${includeConceptMap ? "YA" : "TIDAK"}`);
    parts.push(`- Sertakan Analogi Nyata / Kontekstual: ${includeAnalogies ? "YA" : "TIDAK"}`);

    if (sourceText.trim()) {
      parts.push(`- Berdasarkan Sumber Teks / Catatan Ini:\n"${sourceText.trim()}"`);
    }

    parts.push(`- Format Struktur Dokumen:
1. Judul Materi & Rangkuman Eksekutif (3-4 kalimat).
2. Peta Konsep / Hirarki Materi.
3. Penjelasan Inti Bertahap dengan Sub-Heading yang Terang.
4. Analogi / Contoh Kontekstual Kehidupan Sehari-hari.
5. Glosarium / Daftar Istilah Kunci.
6. Pertanyaan Cek Pemahaman Mandiri.`);

    onSubmit(parts.join("\n"), tone);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-5">
      {/* Topik / Pokok Bahasan */}
      <div className="space-y-2">
        <Label htmlFor="mat-topic" className="text-sm font-semibold flex items-center gap-1.5 text-slate-800">
          <FileText className="w-4 h-4 text-blue-600" />
          Topik / Pokok Bahasan Materi <span className="text-rose-500">*</span>
        </Label>
        <Input
          id="mat-topic"
          placeholder="Contoh: Termodinamika & Hukum Kekekalan Energi"
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

      {/* Tingkat Diferensiasi Belajar */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
          <GraduationCap className="w-4 h-4 text-blue-600" />
          Tingkat Kesiapan / Diferensiasi Siswa
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              id: "FOUNDATIONAL",
              label: "Dasar / Pemula",
              desc: "Bahasa sederhana & analogi visual",
            },
            {
              id: "STANDARD",
              label: "Standar Kurikulum",
              desc: "Komprehensif & terstruktur",
            },
            {
              id: "ENRICHMENT",
              label: "Pengayaan / Cepat",
              desc: "Analisis lanjutan & berpikir kritis",
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDifferentiationLevel(item.id as "FOUNDATIONAL" | "STANDARD" | "ENRICHMENT")}
              disabled={isGenerating}
              className={`p-2.5 text-left rounded-lg border text-xs transition-all ${
                differentiationLevel === item.id
                  ? "border-blue-500 bg-blue-50/70 text-blue-900 font-medium ring-1 ring-blue-500"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <div className="font-semibold text-slate-800">{item.label}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Komponen Pengayaan Tambahan */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Elemen Tambahan</Label>
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeGlossary}
              onChange={(e) => setIncludeGlossary(e.target.checked)}
              disabled={isGenerating}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Glosarium Istilah Kunci</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeConceptMap}
              onChange={(e) => setIncludeConceptMap(e.target.checked)}
              disabled={isGenerating}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Peta Konsep Ringkas</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAnalogies}
              onChange={(e) => setIncludeAnalogies(e.target.checked)}
              disabled={isGenerating}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Analogi Kehidupan Sehari-hari</span>
          </label>
        </div>
      </div>

      {/* Sumber Teks / Bahan Mentah */}
      <div className="space-y-2">
        <Label htmlFor="mat-source" className="text-sm font-medium text-slate-700">
          Tempel Teks Buku / Sumber Materi Mentah (Opsional)
        </Label>
        <Textarea
          id="mat-source"
          placeholder="Tempelkan kutipan bab buku, artikel, atau poin-poin yang ingin diringkas dan disederhanakan oleh AI..."
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          disabled={isGenerating}
          rows={3}
          className="bg-white text-sm resize-none"
        />
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <Badge variant="outline" className="text-xs text-blue-700 border-blue-200 bg-blue-50">
          Disarankan ekspor ke Word (.docx) atau PDF
        </Badge>

        <Button
          type="submit"
          disabled={isGenerating || !topic.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {isGenerating ? "Menyusun Bahan Ajar..." : "Susun Bahan Ajar"}
        </Button>
      </div>
    </form>
  );
}
