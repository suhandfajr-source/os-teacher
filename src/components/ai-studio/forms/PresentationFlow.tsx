"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Presentation, Sliders, Layers, MonitorPlay } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PresentationFlowProps {
  topic: string;
  setTopic: (val: string) => void;
  onSubmit: (composedInstruction: string, tone: "CONCISE" | "STANDARD" | "DETAILED") => void;
  isGenerating: boolean;
  selectedContextLabel?: string;
}

export function PresentationFlow({
  topic,
  setTopic,
  onSubmit,
  isGenerating,
  selectedContextLabel,
}: PresentationFlowProps) {
  const [slideCount, setSlideCount] = useState<number>(6);
  const [slideStyle, setSlideStyle] = useState<string>("Konseptual & Visual (Poin Ringkas)");
  const [includeSpeakerNotes, setIncludeSpeakerNotes] = useState<boolean>(true);
  const [includeVisualPrompts, setIncludeVisualPrompts] = useState<boolean>(true);
  const [sessionGoal, setSessionGoal] = useState<string>("");

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parts: string[] = [];
    parts.push(`[PANDUAN PEMBUATAN SLIDE PRESENTASI ADAPTIF (DECK)]`);
    parts.push(`- Target Jumlah Slide: Tepat ${slideCount} Slide Materi`);
    parts.push(`- Gaya Paparan Slide: ${slideStyle}`);
    parts.push(`- Sertakan Catatan Guru (Speaker Notes): ${includeSpeakerNotes ? "YA (Wajib ada di setiap slide)" : "TIDAK"}`);
    parts.push(`- Sertakan Saran Visual / Ilustrasi: ${includeVisualPrompts ? "YA (Beri tag [Visual: Deskripsi visual kontekstual])" : "TIDAK"}`);

    if (sessionGoal.trim()) {
      parts.push(`- Tujuan / Penekanan Khusus Sesi Ini:\n"${sessionGoal.trim()}"`);
    }

    parts.push(`
--- STRUKTUR & ATURAN PENULISAN SLIDE (WAJIB DIIKUTI) ---
1. Baris Pertama Dokumen: Tuliskan Judul Utama Deck Presentasi menggunakan '# Judul Materi'.
2. Judul Setiap Slide: Gunakan '## Judul Slide yang Alami dan Kontekstual'.
   ⚠️ DILARANG KERAS menggunakan judul output mesin seperti 'Slide 1:', 'Slide 2:', '(1/2)', '(1/3)', 'Slide Pembuka', dsb.
   Contoh judul yang baik:
   - 'Pertanyaan Pemantik: Apa yang Terjadi Saat Kita Bernapas?'
   - 'Tujuan Pembelajaran Sesi Ini'
   - 'Perbandingan: Pembuluh Nadi (Arteri) vs Pembuluh Balik (Vena)'
   - 'Tiga Pilar Utama Ekosistem'
   - 'Kuis Cepat Pemahaman'
   - 'Refleksi & Rangkuman Inti'
3. Struktur Isi Setiap Slide:
   - [Role: Hook / Objectives / Split / Cards / Concept / Story / Quiz / Summary] (Tentukan peran slide secara semantik)
   - Tuliskan 1 kalimat Pesan Utama / Fokus Bahasan yang tajam.
   - Sajikan 2-4 poin penjelas ringkas (hindari paragraf tebal bertumpuk).
   - Cantumkan [Speaker Notes]: penjelasan lisan guru.
   - Cantumkan [Visual: saran ilustrasi/diagram kontekstual].
4. Variasi Alur Slide (Rekomendasi ${slideCount} Slide):
   - Slide 1: Pertanyaan Pemantik / Hook / Fakta Menarik Pembuka
   - Slide 2: Capaian / Tujuan Pembelajaran
   - Slide 3 s.d. ${slideCount - 2}: Materi Inti dengan variasi (Konsep, Perbandingan/Split, Alur Proses, atau Studi Kasus)
   - Slide ${slideCount - 1}: Kuis Cepat / Cek Pemahaman Interaktif
   - Slide ${slideCount}: Rangkuman Inti / Refleksi`);

    onSubmit(parts.join("\n"), "STANDARD");
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-5">
      {/* Topik / Pokok Bahasan */}
      <div className="space-y-2">
        <Label htmlFor="ppt-topic" className="text-sm font-semibold flex items-center gap-1.5 text-slate-800">
          <Presentation className="w-4 h-4 text-purple-600" />
          Topik Presentasi Sesi Mengajar <span className="text-rose-500">*</span>
        </Label>
        <Input
          id="ppt-topic"
          placeholder="Contoh: Peredaran Darah Manusia & Penyakit Terkait"
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

      {/* Target Jumlah Slide & Gaya Penyampaian */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ppt-count" className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
            <Layers className="w-4 h-4 text-purple-600" />
            Jumlah Slide Target
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="ppt-count"
              type="number"
              min={3}
              max={15}
              value={slideCount}
              onChange={(e) => setSlideCount(Math.max(3, parseInt(e.target.value) || 5))}
              disabled={isGenerating}
              className="bg-white text-sm w-24"
            />
            <span className="text-xs text-slate-500">Slide (Rekomendasi 5–8 slide per pertemuan)</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
            <Sliders className="w-4 h-4 text-purple-600" />
            Gaya Paparan Slide
          </Label>
          <select
            aria-label="Gaya Paparan Slide"
            value={slideStyle}
            onChange={(e) => setSlideStyle(e.target.value)}
            disabled={isGenerating}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="Konseptual & Visual (Poin Ringkas)">Poin Ringkas & Visual Focus</option>
            <option value="Interaktif (Pertanyaan & Diskusi di Slide)">Interaktif (Tanya-Jawab & Kuis Singkat)</option>
            <option value="Studi Kasus & Fakta Nyata">Studi Kasus Berbasis Fakta</option>
            <option value="Langkah Tutorial & Praktik">Langkah demi Langkah (Tutorial)</option>
          </select>
        </div>
      </div>

      {/* Fitur Tambahan: Speaker Notes & Visual Cues */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Kelengkapan Slide</Label>
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSpeakerNotes}
              onChange={(e) => setIncludeSpeakerNotes(e.target.checked)}
              disabled={isGenerating}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="font-medium text-slate-800">Catatan Penjelasan Guru (Speaker Notes)</span>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeVisualPrompts}
              onChange={(e) => setIncludeVisualPrompts(e.target.checked)}
              disabled={isGenerating}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span>Saran Visual / Ilustrasi Tiap Slide</span>
          </label>
        </div>
      </div>

      {/* Fokus Utama / Tujuan Sesi */}
      <div className="space-y-2">
        <Label htmlFor="ppt-goal" className="text-sm font-medium text-slate-700">
          Pesan Utama / Tujuan yang Ingin Ditekankan (Opsional)
        </Label>
        <Textarea
          id="ppt-goal"
          placeholder="Misal: Tekankan perbedaan pembuluh vena dan arteri, sertakan analogi jalan tol..."
          value={sessionGoal}
          onChange={(e) => setSessionGoal(e.target.value)}
          disabled={isGenerating}
          rows={2}
          className="bg-white text-sm resize-none"
        />
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <Badge variant="outline" className="text-xs text-purple-700 border-purple-200 bg-purple-50">
          Siap diekspor langsung ke PowerPoint (.pptx)
        </Badge>

        <Button
          type="submit"
          disabled={isGenerating || !topic.trim()}
          className="bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-sm"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {isGenerating ? "Menyusun Slide..." : "Buat Slide Presentasi"}
        </Button>
      </div>
    </form>
  );
}
