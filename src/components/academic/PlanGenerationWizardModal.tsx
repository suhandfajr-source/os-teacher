"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Camera,
  Upload,
  FileText,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CurriculumSourceMode,
  ExtractedChapter,
  ExtractedCurriculumStructure,
  GeneratedAcademicPlanPreview,
} from "@/modules/academic/academic-ai.types";
import {
  extractCurriculumMaterialAction,
  generateAcademicPlanAction,
  applyAcademicPlanPreviewAction,
} from "@/modules/academic/academic-ai.actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Props {
  open: boolean;
  onClose: () => void;
  teachingContextId: string;
  defaultHoursPerWeek?: number;
  defaultEffectiveWeeksSem1?: number;
  defaultEffectiveWeeksSem2?: number;
  defaultCpText?: string | null;
}

export function PlanGenerationWizardModal({
  open,
  onClose,
  teachingContextId,
  defaultHoursPerWeek = 3,
  defaultEffectiveWeeksSem1 = 18,
  defaultEffectiveWeeksSem2 = 16,
  defaultCpText = "",
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"SOURCE_SELECT" | "PREVIEW_CHAPTERS" | "GENERATED_PLAN">("SOURCE_SELECT");
  const [sourceMode, setSourceMode] = useState<CurriculumSourceMode>("CP");

  // Input states
  const [cpInputText, setCpInputText] = useState(defaultCpText || "");
  const [customText, setCustomText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");

  // Config parameters
  const [targetSemester, setTargetSemester] = useState<number>(1);
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(defaultHoursPerWeek);
  const [effectiveWeeks, setEffectiveWeeks] = useState<number>(
    targetSemester === 1 ? defaultEffectiveWeeksSem1 : defaultEffectiveWeeksSem2
  );

  // Extracted Structure
  const [extractedData, setExtractedData] = useState<ExtractedCurriculumStructure | null>(null);
  const [chapters, setChapters] = useState<ExtractedChapter[]>([]);

  // Generated Result
  const [generatedPreview, setGeneratedPreview] = useState<GeneratedAcademicPlanPreview | null>(null);

  // Loading States
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  if (!open) return null;

  // Handle File / Camera Upload
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageMimeType(file.type || "image/jpeg");
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageBase64(result);
    };
    reader.readAsDataURL(file);
  };

  // Step 1 -> Step 2: Extract Material
  const handleExtractMaterial = async () => {
    setIsExtracting(true);
    try {
      const textContent = sourceMode === "CP" ? cpInputText : sourceMode === "CUSTOM_TEXT" ? customText : undefined;
      const res = await extractCurriculumMaterialAction({
        teachingContextId,
        sourceMode,
        textContent,
        imageBase64: imageBase64 || undefined,
        imageMimeType,
      });

      if (res.success && res.data) {
        setExtractedData(res.data);
        setChapters(res.data.chapters);
        setStep("PREVIEW_CHAPTERS");
        toast.success(`Berhasil mengekstrak ${res.data.chapters.length} bab materi!`);
      } else {
        toast.error(res.error || "Gagal mengekstrak materi.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan saat ekstraksi materi.");
    } finally {
      setIsExtracting(false);
    }
  };

  // Step 2 -> Step 3: Generate Academic Plan Matrix
  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      const res = await generateAcademicPlanAction({
        teachingContextId,
        targetSemester,
        chapters,
        hoursPerWeek,
        effectiveWeeks,
      });

      if (res.success && res.data) {
        setGeneratedPreview(res.data);
        setStep("GENERATED_PLAN");
        toast.success("Rencana Program Semester berhasil disusun oleh AI!");
      } else {
        toast.error(res.error || "Gagal meng-generate rencana.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan saat generate matriks.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Step 3 -> Apply to Database & Finish
  const handleApplyAndSave = async () => {
    if (!generatedPreview) return;
    setIsApplying(true);
    try {
      const res = await applyAcademicPlanPreviewAction({
        teachingContextId,
        planPreview: generatedPreview,
      });

      if (res.success) {
        toast.success("Program Semester & Tahunan berhasil disimpan ke database!");
        onClose();
        router.refresh();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menerapkan rencana.");
    } finally {
      setIsApplying(false);
    }
  };

  // Helper to edit extracted chapters inline
  const handleChapterTitleChange = (index: number, newTitle: string) => {
    setChapters((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], title: newTitle };
      return copy;
    });
  };

  const handleChapterHoursChange = (index: number, newHours: number) => {
    setChapters((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], suggestedHours: Math.max(1, newHours) };
      return copy;
    });
  };

  const handleRemoveChapter = (index: number) => {
    setChapters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddChapter = () => {
    setChapters((prev) => [
      ...prev,
      {
        chapterNumber: prev.length + 1,
        title: `Bab ${prev.length + 1}: Materi Pokok Baru`,
        subTopics: [],
        suggestedHours: hoursPerWeek * 2,
        suggestedSemester: targetSemester as 1 | 2,
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-card shadow-2xl border-border overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">AI Curriculum & Prosem Generator</h2>
              <p className="text-xs text-muted-foreground">
                {step === "SOURCE_SELECT"
                  ? "Pilih sumber materi pembelajaran yang Anda gunakan"
                  : step === "PREVIEW_CHAPTERS"
                  ? "Verifikasi dan sesuaikan daftar bab sebelum didistribusikan"
                  : "Pratinjau Program Semester & Matriks Mingguan"}
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-8 w-8 p-0 rounded-full">
            ✕
          </Button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* STEP 1: SOURCE SELECTION */}
          {step === "SOURCE_SELECT" && (
            <div className="space-y-4">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                1. Pilih Sumber Materi
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Option 1: CP */}
                <div
                  onClick={() => setSourceMode("CP")}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all relative ${
                    sourceMode === "CP"
                      ? "border-teal-600 bg-sky-100/90 ring-2 ring-teal-600 shadow-sm"
                      : "border-sky-200/90 bg-sky-50/70 hover:bg-sky-100/70 hover:border-sky-300 text-slate-900"
                  }`}
                >
                  {sourceMode === "CP" && (
                    <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-teal-600 text-white flex items-center justify-center">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div className="h-9 w-9 rounded-xl bg-sky-600 text-white flex items-center justify-center mb-2.5 shadow-2xs">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">Capaian Pembelajaran</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ekstrak otomatis dari CP resmi kementerian (Kurikulum Merdeka).
                  </p>
                </div>

                {/* Option 2: TOC Image / Scan */}
                <div
                  onClick={() => setSourceMode("TOC_IMAGE")}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all relative ${
                    sourceMode === "TOC_IMAGE"
                      ? "border-teal-600 bg-teal-100/90 ring-2 ring-teal-600 shadow-sm"
                      : "border-teal-200/90 bg-teal-50/80 hover:bg-teal-100/70 hover:border-teal-300 text-slate-900"
                  }`}
                >
                  {sourceMode === "TOC_IMAGE" && (
                    <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-teal-600 text-white flex items-center justify-center">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="h-9 w-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-2xs">
                      <Camera className="h-4 w-4" />
                    </div>
                    {sourceMode !== "TOC_IMAGE" && (
                      <Badge className="text-[10px] bg-teal-700 text-white font-bold rounded-full">
                        ⭐ Favorit Guru
                      </Badge>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">Foto Daftar Isi Buku</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Jepret/upload foto daftar isi buku cetak (Erlangga, Pusbuk, dll).
                  </p>
                </div>

                {/* Option 3: Custom Text */}
                <div
                  onClick={() => setSourceMode("CUSTOM_TEXT")}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all relative ${
                    sourceMode === "CUSTOM_TEXT"
                      ? "border-teal-600 bg-indigo-100/90 ring-2 ring-teal-600 shadow-sm"
                      : "border-indigo-200/90 bg-indigo-50/70 hover:bg-indigo-100/70 hover:border-indigo-300 text-slate-900"
                  }`}
                >
                  {sourceMode === "CUSTOM_TEXT" && (
                    <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-teal-600 text-white flex items-center justify-center">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-2.5 shadow-2xs">
                    <FileText className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">Tulis / Tempel Silabus</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Copy-paste daftar bab dari Word/PDF silabus mandiri Anda.
                  </p>
                </div>
              </div>

              {/* Source Input Area */}
              <div className="pt-2">
                {sourceMode === "CP" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cpInput" className="text-xs font-medium">
                      Teks Capaian Pembelajaran (CP)
                    </Label>
                    <Textarea
                      id="cpInput"
                      rows={4}
                      placeholder="Tempel teks Capaian Pembelajaran di sini..."
                      value={cpInputText}
                      onChange={(e) => setCpInputText(e.target.value)}
                      className="text-xs leading-relaxed"
                    />
                  </div>
                )}

                {sourceMode === "TOC_IMAGE" && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Upload / Ambil Foto Daftar Isi Buku</Label>
                    <div className="border-2 border-dashed rounded-xl p-4 text-center hover:bg-muted/20 transition-all flex flex-col items-center justify-center space-y-2">
                      {imagePreview ? (
                        <div className="space-y-2 w-full max-w-xs">
                          <img
                            src={imagePreview}
                            alt="Daftar Isi Preview"
                            className="max-h-44 object-contain rounded border mx-auto"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setImagePreview(null);
                              setImageBase64(null);
                            }}
                            className="text-xs"
                          >
                            Ganti Foto
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                            <Upload className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold">Klik untuk memilih file atau ambil foto kamera</p>
                            <p className="text-[11px] text-muted-foreground">Mendukung JPG, PNG, WebP (maks 5MB)</p>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleImageFileChange}
                            className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-primary file:text-primary-foreground"
                          />
                        </>
                      )}
                    </div>
                  </div>
                )}

                {sourceMode === "CUSTOM_TEXT" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="customInput" className="text-xs font-medium">
                      Daftar Bab & Materi Pokok
                    </Label>
                    <Textarea
                      id="customInput"
                      rows={4}
                      placeholder="Contoh:&#10;Bab 1: Eksponen dan Logaritma&#10;Bab 2: Barisan dan Deret&#10;Bab 3: Vektor..."
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      className="text-xs font-mono leading-relaxed"
                    />
                  </div>
                )}
              </div>

              {/* Basic Planning Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
                <div className="space-y-1">
                  <Label className="text-xs">Target Semester</Label>
                  <select
                    value={targetSemester}
                    onChange={(e) => {
                      const sem = parseInt(e.target.value) || 1;
                      setTargetSemester(sem);
                      setEffectiveWeeks(sem === 1 ? defaultEffectiveWeeksSem1 : defaultEffectiveWeeksSem2);
                    }}
                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                  >
                    <option value={1}>Semester Ganjil (1)</option>
                    <option value={2}>Semester Genap (2)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Beban Mengajar (JP/Minggu)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(parseInt(e.target.value) || 3)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Pekan Efektif Semester</Label>
                  <Input
                    type="number"
                    min="1"
                    max="25"
                    value={effectiveWeeks}
                    onChange={(e) => setEffectiveWeeks(parseInt(e.target.value) || 18)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW EXTRACTED CHAPTERS */}
          {step === "PREVIEW_CHAPTERS" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Daftar Bab Terdeteksi</h4>
                  <p className="text-xs text-muted-foreground">
                    Periksa alokasi jam dan judul bab sebelum AI mendistribusikannya ke kalender mingguan.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  Target: {effectiveWeeks * hoursPerWeek} JP Semester
                </Badge>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {chapters.map((ch, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20">
                    <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                      {idx + 1}
                    </span>
                    <Input
                      value={ch.title}
                      onChange={(e) => handleChapterTitleChange(idx, e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        type="number"
                        min="1"
                        value={ch.suggestedHours}
                        onChange={(e) => handleChapterHoursChange(idx, parseInt(e.target.value) || 0)}
                        className="h-8 w-16 text-xs text-center font-semibold"
                      />
                      <span className="text-[11px] text-muted-foreground">JP</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveChapter(idx)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive ml-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button size="sm" variant="outline" onClick={handleAddChapter} className="text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Tambah Baris Bab
              </Button>
            </div>
          )}

          {/* STEP 3: GENERATED PLAN SUMMARY */}
          {step === "GENERATED_PLAN" && generatedPreview && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold">Perencanaan Program Semester Berhasil Disusun!</p>
                  <p>
                    Total alokasi: <strong>{generatedPreview.totalScheduledHours} JP</strong> dari total kapasitas{" "}
                    <strong>{generatedPreview.totalAvailableHours} JP</strong> ({generatedPreview.effectiveWeeks} pekan efektif
                    × {generatedPreview.hoursPerWeek} JP).
                  </p>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden text-xs">
                <div className="p-2.5 bg-muted/60 font-semibold border-b flex justify-between">
                  <span>Ringkasan Item Program Semester</span>
                  <span>{generatedPreview.items.length} Item Terjadwal</span>
                </div>
                <div className="divide-y max-h-60 overflow-y-auto">
                  {generatedPreview.items.map((it, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-muted/10">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground text-[11px]">{idx + 1}.</span>
                        <span className="font-medium">{it.title}</span>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs">
                        {it.allocatedHours} JP
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t bg-muted/20 flex items-center justify-between">
          {step === "SOURCE_SELECT" ? (
            <Button variant="outline" size="sm" onClick={onClose}>
              Batal
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(step === "GENERATED_PLAN" ? "PREVIEW_CHAPTERS" : "SOURCE_SELECT")}
              disabled={isGenerating || isApplying}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Kembali
            </Button>
          )}

          {step === "SOURCE_SELECT" && (
            <Button
              size="sm"
              onClick={handleExtractMaterial}
              disabled={
                isExtracting ||
                (sourceMode === "CP" && !cpInputText.trim()) ||
                (sourceMode === "TOC_IMAGE" && !imageBase64) ||
                (sourceMode === "CUSTOM_TEXT" && !customText.trim())
              }
              className="flex items-center gap-1.5"
            >
              {isExtracting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {isExtracting ? "Mengekstrak Materi..." : "Lanjut: Analisis Materi"}
            </Button>
          )}

          {step === "PREVIEW_CHAPTERS" && (
            <Button
              size="sm"
              onClick={handleGeneratePlan}
              disabled={isGenerating || chapters.length === 0}
              className="flex items-center gap-1.5"
            >
              {isGenerating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {isGenerating ? "Menyusun Matriks..." : "✨ Generate Matriks PROSEM"}
            </Button>
          )}

          {step === "GENERATED_PLAN" && (
            <Button
              size="sm"
              onClick={handleApplyAndSave}
              disabled={isApplying}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
            >
              {isApplying ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {isApplying ? "Menyimpan ke Sistem..." : "Terapkan ke Matriks & Simpan"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
