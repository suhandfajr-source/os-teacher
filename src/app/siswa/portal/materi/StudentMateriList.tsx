"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Calendar,
  Presentation,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Target,
  Layers,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { exportToPowerPoint } from "@/lib/export/ppt-exporter";
import { cleanInlineMarkdown } from "@/lib/export/ppt/ppt-parser";
import { MarkdownReader } from "./MarkdownReader";
import { toast } from "sonner";

export interface PublishedMaterialItem {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
  subjectName: string | null;
  teacherName: string | null;
}

/**
 * Deteksi konten slide-based (R3):
 * - Delimiter `---` harus benar-benar berdiri sendiri di satu baris penuh
 *   (separator tabel GFM `| --- |` TIDAK ikut terdeteksi), DAN
 * - menghasilkan lebih dari satu bagian, ATAU
 * - konten memakai tag peran internal [Role: …] dari generator presentasi.
 */
const SLIDE_DELIMITER_LINE_RE = /\n\s*-{3,}\s*\n/;

function isSlideBasedContent(content: string): boolean {
  if (content.includes("[Role:")) return true;
  const padded = `\n${content.trim()}\n`;
  if (!SLIDE_DELIMITER_LINE_RE.test(padded)) return false;
  const sections = padded.split(/\n\s*-{3,}\s*\n/).map((s) => s.trim()).filter(Boolean);
  return sections.length > 1;
}

interface SlideItem {
  id: string;
  slideNumber: number;
  totalSlides: number;
  title: string;
  roleTag?: string;
  category: "cover" | "hook" | "objectives" | "content" | "quiz" | "summary" | "reflection";
  paragraphs: string[];
  bullets: Array<{ label?: string; text: string }>;
}

function parseSlidesFromContent(content: string, mainTitle: string, subjectName: string | null, teacherName: string | null): SlideItem[] {
  // Check if content uses slide delimiter ---
  const rawSections = content.split(/\n\s*---\s*\n/).map((s) => s.trim()).filter(Boolean);

  if (rawSections.length === 0) {
    return [];
  }

  const slides: SlideItem[] = [];

  // 1. Cover Slide
  slides.push({
    id: "slide-0",
    slideNumber: 1,
    totalSlides: rawSections.length + (rawSections[0]?.startsWith("# ") ? 0 : 1),
    title: mainTitle,
    category: "cover",
    roleTag: "Sampul Pembelajaran",
    paragraphs: [
      `Mata Pelajaran: ${subjectName || "Umum"}`,
      `Pengampu: ${teacherName || "Guru Mata Pelajaran"}`,
    ],
    bullets: [],
  });

  // 2. Parse remaining sections
  rawSections.forEach((sectionText, idx) => {
    // If the first section is just the document # Title, skip duplicate
    if (idx === 0 && sectionText.startsWith("# ") && !sectionText.includes("\n## ")) {
      return;
    }

    const lines = sectionText.split("\n").map((l) => l.trim()).filter(Boolean);
    let slideTitle = "";
    let roleTag = "";
    const paragraphs: string[] = [];
    const bullets: Array<{ label?: string; text: string }> = [];

    // (R2) Akumulator baris tabel GFM → dikonversi jadi bullet/kartu terstruktur.
    // Baris separator | --- | tidak ikut dirender.
    let tableRows: string[][] = [];
    const flushTable = () => {
      if (tableRows.length === 0) return;
      const [header, ...dataRows] = tableRows;
      const hasHeader = header.some((c) => c.length > 0);
      for (const row of dataRows) {
        const label = cleanInlineMarkdown(row[0] ?? "");
        const rest = row.slice(1).map((c) => cleanInlineMarkdown(c)).filter(Boolean);
        const text =
          hasHeader && rest.length > 0
            ? rest
                .map((cell, ci) => {
                  const colName = cleanInlineMarkdown(header[ci + 1] ?? "");
                  return colName ? `${colName}: ${cell}` : cell;
                })
                .join(" • ")
            : rest.join(" • ");
        bullets.push({ label: label || undefined, text });
      }
      tableRows = [];
    };

    for (const line of lines) {
      // (R2) Baris tabel GFM: kumpulkan; baris separator | --- | dilewati
      if (line.startsWith("|")) {
        const cells = line
          .split("|")
          .slice(1, line.endsWith("|") ? -1 : undefined)
          .map((c) => c.trim());
        if (cells.length > 0 && cells.every((c) => c.length > 0 && /^:?-{2,}:?$/.test(c))) continue;
        tableRows.push(cells);
        continue;
      }
      flushTable();

      // Role tag extraction: [Role: Hook] or [Tujuan]
      const roleMatch = line.match(/^\[(?:Role:\s*)?([^\]]+)\]/i);
      if (roleMatch) {
        roleTag = roleMatch[1].trim();
        continue;
      }

      // Heading 1 or 2
      if (line.startsWith("# ") || line.startsWith("## ") || line.startsWith("### ")) {
        if (!slideTitle) {
          slideTitle = cleanInlineMarkdown(line.replace(/^#+\s*/, ""));
          // Remove "Slide 1:", etc.
          slideTitle = slideTitle.replace(/^(slide|bagian|bab)\s*\d+[\s:.-]*/i, "").trim();
          continue;
        }
      }

      // Bullets
      if (line.startsWith("* ") || line.startsWith("- ") || line.startsWith("• ")) {
        const rawBullet = line.replace(/^[*•-]\s*/, "");
        // Check for **Label:** or **Label** -
        const labelMatch = rawBullet.match(/^\*\*([^*]+)\*\*[:\s-]*(.*)/);
        if (labelMatch) {
          bullets.push({
            label: cleanInlineMarkdown(labelMatch[1]),
            text: cleanInlineMarkdown(labelMatch[2]),
          });
        } else {
          bullets.push({
            text: cleanInlineMarkdown(rawBullet),
          });
        }
        continue;
      }

      // Normal paragraph (remove markdown symbols for clean display)
      const cleanLine = cleanInlineMarkdown(line);
      if (cleanLine && !cleanLine.startsWith("[Role:")) {
        paragraphs.push(cleanLine);
      }
    }
    flushTable();

    if (!slideTitle) {
      slideTitle = `Bagian ${slides.length + 1}`;
    }

    // Determine category
    const norm = (roleTag + " " + slideTitle).toLowerCase();
    let category: SlideItem["category"] = "content";
    if (norm.includes("hook") || norm.includes("pemantik") || norm.includes("tahukah")) {
      category = "hook";
    } else if (norm.includes("tujuan") || norm.includes("objective") || norm.includes("capaian")) {
      category = "objectives";
    } else if (norm.includes("kuis") || norm.includes("quiz") || norm.includes("soal")) {
      category = "quiz";
    } else if (norm.includes("kesimpulan") || norm.includes("rangkuman") || norm.includes("takeaway") || norm.includes("penutup")) {
      category = "summary";
    } else if (norm.includes("refleksi") || norm.includes("diskusi")) {
      category = "reflection";
    }

    slides.push({
      id: `slide-${slides.length}`,
      slideNumber: slides.length + 1,
      totalSlides: 0, // will be updated below
      title: slideTitle,
      roleTag: roleTag || undefined,
      category,
      paragraphs,
      bullets,
    });
  });

  // Update totalSlides for each slide
  const total = slides.length;
  slides.forEach((s) => (s.totalSlides = total));

  return slides;
}

export function StudentMateriList({
  materials,
}: {
  materials: PublishedMaterialItem[];
}) {
  const [openMaterialId, setOpenMaterialId] = useState<string | null>(
    materials.length > 0 ? materials[0].id : null
  );
  const [activeSlideIndexMap, setActiveSlideIndexMap] = useState<Record<string, number>>({});
  const [viewModeMap, setViewModeMap] = useState<Record<string, "slide" | "reading">>({});
  const [isDownloadingMap, setIsDownloadingMap] = useState<Record<string, boolean>>({});

  const toggleMaterial = (id: string) => {
    setOpenMaterialId((prev) => (prev === id ? null : id));
  };

  const getActiveSlideIndex = (materialId: string) => {
    return activeSlideIndexMap[materialId] || 0;
  };

  const setActiveSlideIndex = (materialId: string, idx: number) => {
    setActiveSlideIndexMap((prev) => ({ ...prev, [materialId]: idx }));
  };

  const getViewMode = (materialId: string) => {
    return viewModeMap[materialId] || "slide";
  };

  const handleDownloadPptx = async (m: PublishedMaterialItem) => {
    setIsDownloadingMap((prev) => ({ ...prev, [m.id]: true }));
    try {
      await exportToPowerPoint({
        title: m.title,
        content: m.content,
        subjectName: m.subjectName || undefined,
        teacherName: m.teacherName || undefined,
      });
      toast.success("File PowerPoint (.pptx) berhasil diunduh.");
    } catch (err: unknown) {
      console.error("PPTX Download error:", err);
      toast.error(err instanceof Error ? err.message : "Gagal mengunduh presentasi PowerPoint.");
    } finally {
      setIsDownloadingMap((prev) => ({ ...prev, [m.id]: false }));
    }
  };

  return (
    <div className="space-y-4">
      {materials.map((m) => {
        const isOpen = openMaterialId === m.id;
        const isSlideBased = isSlideBasedContent(m.content);
        const slides = isSlideBased ? parseSlidesFromContent(m.content, m.title, m.subjectName, m.teacherName) : [];
        const activeSlideIdx = getActiveSlideIndex(m.id);
        const currentSlide = slides[activeSlideIdx] || slides[0];
        const viewMode = getViewMode(m.id);
        const isDownloading = Boolean(isDownloadingMap[m.id]);

        return (
          <div
            key={m.id}
            className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden transition-all duration-200"
          >
            {/* Summary / Header Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleMaterial(m.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleMaterial(m.id);
                }
              }}
              className="cursor-pointer select-none p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    isSlideBased
                      ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                      : "bg-teal-50 text-teal-700 border border-teal-200/60"
                  }`}
                >
                  {isSlideBased ? <Presentation className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-bold text-slate-900 leading-snug">{m.title}</p>
                    {isSlideBased ? (
                      <Badge variant="outline" className="bg-amber-50/60 text-amber-700 border-amber-200 text-[10px] py-0 px-1.5 font-medium gap-1">
                        <Presentation className="w-3 h-3" />
                        {slides.length} Slide Presentasi
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-teal-50/60 text-teal-700 border-teal-200 text-[10px] py-0 px-1.5 font-medium gap-1">
                        <FileText className="w-3 h-3" />
                        Modul Teks
                      </Badge>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 mt-1">
                    {m.subjectName ?? "Mata Pelajaran"} • Guru: {m.teacherName ?? "Pengampu"}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-400 shrink-0">
                <span className="flex items-center gap-1 text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(m.publishedAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200/60 px-2 py-0.5 rounded-full">
                  {isOpen ? "Tutup ↑" : "Buka Materi ↓"}
                </span>
              </div>
            </div>

            {/* Expanded Content Area */}
            {isOpen && (
              <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5 space-y-4">
                {/* Action Bar (Download & Mode Switch) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/70">
                  <div className="flex items-center gap-1.5">
                    {isSlideBased && (
                      <>
                        <Button
                          size="sm"
                          variant={viewMode === "slide" ? "default" : "outline"}
                          onClick={() => setViewModeMap((p) => ({ ...p, [m.id]: "slide" }))}
                          className={`h-8 text-xs gap-1.5 rounded-lg font-medium ${
                            viewMode === "slide"
                              ? "bg-teal-700 text-white hover:bg-teal-800"
                              : "bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <Presentation className="w-3.5 h-3.5" />
                          Tampilan Slide
                        </Button>
                        <Button
                          size="sm"
                          variant={viewMode === "reading" ? "default" : "outline"}
                          onClick={() => setViewModeMap((p) => ({ ...p, [m.id]: "reading" }))}
                          className={`h-8 text-xs gap-1.5 rounded-lg font-medium ${
                            viewMode === "reading"
                              ? "bg-teal-700 text-white hover:bg-teal-800"
                              : "bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Tampilan Baca Ringkas
                        </Button>
                      </>
                    )}
                  </div>

                  {/* PowerPoint Download Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadPptx(m)}
                    disabled={isDownloading}
                    className="h-8 text-xs gap-1.5 rounded-lg bg-white border-amber-200 text-amber-800 hover:bg-amber-50 hover:text-amber-900 font-semibold shadow-2xs ml-auto"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                        Menyiapkan PPTX...
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 text-amber-600" />
                        Unduh File PowerPoint (.pptx)
                      </>
                    )}
                  </Button>
                </div>

                {/* SLIDE VIEW MODE */}
                {isSlideBased && viewMode === "slide" && currentSlide && (
                  <div className="space-y-4">
                    {/* Main Slide Card Display */}
                    <div className="relative rounded-2xl border-2 border-slate-200/80 bg-linear-to-br from-white via-slate-50/50 to-teal-50/20 p-5 sm:p-7 shadow-xs min-h-[300px] flex flex-col justify-between overflow-hidden">
                      {/* Decorative Background Blob */}
                      <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

                      {/* Slide Top Metadata */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {currentSlide.category === "cover" && (
                            <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-xs py-0.5 gap-1 font-semibold">
                              <Sparkles className="w-3 h-3" />
                              Slide Pembuka
                            </Badge>
                          )}
                          {currentSlide.category === "hook" && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs py-0.5 gap-1 font-semibold">
                              <Lightbulb className="w-3 h-3" />
                              Pemantik / Hook
                            </Badge>
                          )}
                          {currentSlide.category === "objectives" && (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs py-0.5 gap-1 font-semibold">
                              <Target className="w-3 h-3" />
                              Tujuan Pembelajaran
                            </Badge>
                          )}
                          {currentSlide.category === "quiz" && (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs py-0.5 gap-1 font-semibold">
                              <HelpCircle className="w-3 h-3" />
                              Uji Pemahaman
                            </Badge>
                          )}
                          {currentSlide.category === "summary" && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs py-0.5 gap-1 font-semibold">
                              <CheckCircle2 className="w-3 h-3" />
                              Rangkuman / Intisari
                            </Badge>
                          )}
                          {currentSlide.category === "content" && (
                            <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-xs py-0.5 gap-1 font-medium">
                              <Layers className="w-3 h-3 text-slate-500" />
                              {currentSlide.roleTag || "Konsep Utama"}
                            </Badge>
                          )}
                        </div>

                        {/* Slide Indicator Badge */}
                        <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200/80 px-2.5 py-1 rounded-full shadow-2xs font-mono">
                          {activeSlideIdx + 1} / {slides.length}
                        </span>
                      </div>

                      {/* Slide Body */}
                      <div className="space-y-4 my-auto py-2">
                        {/* Slide Title */}
                        <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug">
                          {currentSlide.title}
                        </h3>

                        {/* Paragraphs */}
                        {currentSlide.paragraphs.length > 0 && (
                          <div className="space-y-2">
                            {currentSlide.paragraphs.map((p, pIdx) => (
                              <p key={pIdx} className="text-[13px] text-slate-700 leading-relaxed">
                                {p}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Bullets & Structured Cards */}
                        {currentSlide.bullets.length > 0 && (
                          <div className="grid grid-cols-1 gap-2.5 pt-2">
                            {currentSlide.bullets.map((b, bIdx) => (
                              <div
                                key={bIdx}
                                className="flex items-start gap-2.5 p-3 rounded-xl bg-white/90 border border-slate-200/70 shadow-2xs"
                              >
                                <div className="w-2 h-2 rounded-full bg-teal-600 mt-1.5 shrink-0" />
                                <div className="text-[12.5px] leading-relaxed text-slate-800">
                                  {b.label && (
                                    <span className="font-bold text-slate-900 mr-1.5">
                                      {b.label}:
                                    </span>
                                  )}
                                  <span>{b.text}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Slide Bottom Controls */}
                      <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActiveSlideIndex(m.id, Math.max(0, activeSlideIdx - 1))}
                          disabled={activeSlideIdx === 0}
                          className="h-8 px-3 text-xs gap-1 rounded-lg"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Sebelumnya
                        </Button>

                        {/* Slide Dots */}
                        <div className="flex items-center gap-1.5 overflow-x-auto max-w-[180px] sm:max-w-xs py-1">
                          {slides.map((s, sIdx) => (
                            <button
                              key={s.id}
                              onClick={() => setActiveSlideIndex(m.id, sIdx)}
                              title={`Slide ${sIdx + 1}: ${s.title}`}
                              className={`h-2 rounded-full transition-all duration-200 ${
                                activeSlideIdx === sIdx
                                  ? "w-6 bg-teal-700"
                                  : "w-2 bg-slate-300 hover:bg-slate-400"
                              }`}
                            />
                          ))}
                        </div>

                        <Button
                          size="sm"
                          variant="default"
                          onClick={() =>
                            setActiveSlideIndex(m.id, Math.min(slides.length - 1, activeSlideIdx + 1))
                          }
                          disabled={activeSlideIdx === slides.length - 1}
                          className="h-8 px-3 text-xs gap-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white"
                        >
                          Selanjutnya
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* READING / ARTICLE VIEW MODE (Clean formatted Markdown) */}
                {(!isSlideBased || viewMode === "reading") && (
                  <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5">
                    <MarkdownReader content={m.content} />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
