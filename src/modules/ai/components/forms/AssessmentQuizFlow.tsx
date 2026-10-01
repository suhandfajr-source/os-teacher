"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, HelpCircle, CheckCircle, BarChart3, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AssessmentQuizFlowProps {
  topic: string;
  setTopic: (val: string) => void;
  onSubmit: (composedInstruction: string, tone: "CONCISE" | "STANDARD" | "DETAILED") => void;
  isGenerating: boolean;
  selectedContextLabel?: string;
}

export function AssessmentQuizFlow({
  topic,
  setTopic,
  onSubmit,
  isGenerating,
  selectedContextLabel,
}: AssessmentQuizFlowProps) {
  const [assessmentType, setAssessmentType] = useState<string>("Ulangan Harian / Formatif");
  const [mcqCount, setMcqCount] = useState<number>(5);
  const [essayCount, setEssayCount] = useState<number>(2);
  const [bloomLevel, setBloomLevel] = useState<"BALANCED" | "HOTS" | "LOTS">("BALANCED");
  const [includeAnswerKey, setIncludeAnswerKey] = useState<boolean>(true);
  const [includeDiscussion, setIncludeDiscussion] = useState<boolean>(true);
  const [includeRubric, setIncludeRubric] = useState<boolean>(true);
  const [contextNotes, setContextNotes] = useState<string>("");

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parts: string[] = [];
    parts.push(`[PANDUAN PEMBUATAN SOAL, KISI-KISI, DAN KUNCI JAWABAN]`);
    parts.push(`- Jenis Evaluasi: ${assessmentType}`);
    parts.push(`- Jumlah Soal Pilihan Ganda (PG): ${mcqCount} butir (dengan 4/5 opsi A, B, C, D, E)`);
    parts.push(`- Jumlah Soal Uraian / Essay: ${essayCount} butir`);

    const bloomDescription = {
      BALANCED: "Seimbang antara LOTS (C1-C2: 30%), MOTS (C3: 40%), dan HOTS (C4-C6: 30%)",
      HOTS: "Dominan HOTS (C4-C6: Analisis, Evaluasi, Kreasi) dengan stimulus kasus kontekstual nyata",
      LOTS: "Fokus Pemahaman Konsep Dasar & Ingatan (C1-C3: Mengingat, Menjelaskan, Menerapkan)",
    }[bloomLevel];

    parts.push(`- Distribusi Tingkat Kesulitan: ${bloomDescription}`);
    parts.push(`- Sertakan Kunci Jawaban Lengkap: ${includeAnswerKey ? "YA" : "TIDAK"}`);
    parts.push(`- Sertakan Pembahasan / Rasional Jawaban: ${includeDiscussion ? "YA" : "TIDAK"}`);
    parts.push(`- Sertakan Rubrik Pedoman Penskoran Essay: ${includeRubric ? "YA" : "TIDAK"}`);

    if (contextNotes.trim()) {
      parts.push(`- Catatan Khusus Soal: ${contextNotes.trim()}`);
    }

    parts.push(`- Format Penulisan:
1. Tabel Kisi-kisi Soal (Nomor, Indikator Soal, Level Kognitif / C1-C6, Bentuk Soal).
2. Naskah Butir Soal (Format Siap Cetak & Siap Digunakan Siswa):
   - WAJIB BERSIH: JANGAN cantumkan label seperti '(HOTS)', '(LOTS)', '(MOTS)', atau '(C1-C6)' pada teks naskah butir soal. Tulis langsung nomor dan soalnya (contoh: '20. Nabi Ibrahim AS berhasil...'). Keterangan level kognitif HANYA boleh ada di Tabel Kisi-kisi dan Kunci Jawaban.
   - JANGAN gunakan simbol blockquote '>' untuk teks bacaan/stimulus soal. Tuliskan teks bacaan/stimulus langsung sebagai teks narasi biasa tanpa karakter '>'.
   - Opsi pilihan ganda A, B, C, D, E diletakkan pada baris baru terpisah.
3. Kunci Jawaban & Pembahasan (Sajikan kunci jawaban dan pembahasan secara padat, presisi, dan to-the-point untuk seluruh nomor soal).
4. Rubrik & Pedoman Penskoran Uraian.
- KETENTUAN WAJIB: Tuliskan seluruh butir soal nomor 1 s.d. selesai dan tuntaskan seluruh bagian kunci jawaban serta rubrik hingga selesai tanpa terputus.`);

    onSubmit(parts.join("\n"), "STANDARD");
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-5">
      {/* Topik / Pokok Bahasan */}
      <div className="space-y-2">
        <Label htmlFor="quiz-topic" className="text-sm font-semibold flex items-center gap-1.5 text-slate-800">
          <HelpCircle className="w-4 h-4 text-emerald-600" />
          Materi / Kisi-Kisi yang Diujikan <span className="text-rose-500">*</span>
        </Label>
        <Input
          id="quiz-topic"
          placeholder="Contoh: Hukum Newton & Penerapannya dalam Kehidupan Sehari-hari"
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

      {/* Jenis Asesmen & Jumlah Butir Soal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">Jenis Asesmen</Label>
          <select
            aria-label="Jenis Asesmen"
            value={assessmentType}
            onChange={(e) => setAssessmentType(e.target.value)}
            disabled={isGenerating}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="Ulangan Harian / Formatif">Ulangan Harian / Formatif</option>
            <option value="Penilaian Tengah Semester (PTS/STS)">Penilaian Tengah Semester (PTS)</option>
            <option value="Penilaian Akhir Semester (PAS/SAS)">Penilaian Akhir Semester (PAS)</option>
            <option value="Kuis Singkat Pemahaman">Kuis Singkat Pemahaman</option>
            <option value="Bank Soal Pengayaan & Remedial">Bank Soal Pengayaan & Remedial</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quiz-mcq" className="text-sm font-medium text-slate-700">
            Jumlah Pilihan Ganda
          </Label>
          <Input
            id="quiz-mcq"
            type="number"
            min={0}
            max={50}
            value={mcqCount}
            onChange={(e) => setMcqCount(Math.max(0, parseInt(e.target.value) || 0))}
            disabled={isGenerating}
            className="bg-white text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quiz-essay" className="text-sm font-medium text-slate-700">
            Jumlah Soal Essay / Uraian
          </Label>
          <Input
            id="quiz-essay"
            type="number"
            min={0}
            max={20}
            value={essayCount}
            onChange={(e) => setEssayCount(Math.max(0, parseInt(e.target.value) || 0))}
            disabled={isGenerating}
            className="bg-white text-sm"
          />
        </div>
      </div>

      {/* Level Kognitif Bloom / HOTS Focus */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
          <BarChart3 className="w-4 h-4 text-emerald-600" />
          Komposisi Tingkat Kesulitan (Taksonomi Bloom)
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "BALANCED", label: "Seimbang (LOTS + HOTS)", desc: "C1-C6 proporsional" },
            { id: "HOTS", label: "Dominan HOTS (C4-C6)", desc: "Analisis, studi kasus & nalar" },
            { id: "LOTS", label: "Dasar & Konseptual (C1-C3)", desc: "Pemahaman & ingatan" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setBloomLevel(item.id as "BALANCED" | "HOTS" | "LOTS")}
              disabled={isGenerating}
              className={`p-2.5 text-left rounded-lg border text-xs transition-all ${
                bloomLevel === item.id
                  ? "border-emerald-500 bg-emerald-50/70 text-emerald-900 font-medium ring-1 ring-emerald-500"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <div className="font-semibold text-slate-800">{item.label}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Opsi Output & Kunci Jawaban */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Kelengkapan Output</Label>
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAnswerKey}
              onChange={(e) => setIncludeAnswerKey(e.target.checked)}
              disabled={isGenerating}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Kunci Jawaban Soal</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDiscussion}
              onChange={(e) => setIncludeDiscussion(e.target.checked)}
              disabled={isGenerating}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Pembahasan / Penjelasan Jawaban</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeRubric}
              onChange={(e) => setIncludeRubric(e.target.checked)}
              disabled={isGenerating}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Rubrik Penskoran Essay</span>
          </label>
        </div>
      </div>

      {/* Catatan / Instruksi Tambahan */}
      <div className="space-y-2">
        <Label htmlFor="quiz-notes" className="text-sm font-medium text-slate-700">
          Konteks / Kasus Tambahan untuk Soal (Opsional)
        </Label>
        <Textarea
          id="quiz-notes"
          placeholder="Misal: Buat soal studi kasus terkait lingkungan pesisir Indonesia, sertakan grafik/tabel ilustrasi pada soal nomor 3..."
          value={contextNotes}
          onChange={(e) => setContextNotes(e.target.value)}
          disabled={isGenerating}
          rows={2}
          className="bg-white text-sm resize-none"
        />
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-200 bg-emerald-50">
          Disarankan ekspor ke Excel (.xlsx) atau Word (.docx)
        </Badge>

        <Button
          type="submit"
          disabled={isGenerating || !topic.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {isGenerating ? "Menyusun Bank Soal..." : "Buat Bank Soal & Kisi-Kisi"}
        </Button>
      </div>
    </form>
  );
}
