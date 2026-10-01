"use client";

import React, { useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Download,
  X,
  CheckCircle2,
  Calendar,
  User,
  GraduationCap,
  Building2,
  BookOpen,
  LayoutTemplate,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AiContentType, CONTENT_TYPE_LABELS } from "@/modules/ai/ai.types";
import { DocumentTemplateItem } from "@/modules/templates/template.types";

export type PreviewFormat = "docx" | "xlsx" | "pdf" | "pptx";

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  contentType: AiContentType;
  initialFormat?: PreviewFormat;
  schoolName?: string;
  teacherName?: string;
  subjectName?: string;
  className?: string;
  academicPeriod?: string;
  dateStr?: string;
  availableTemplates?: DocumentTemplateItem[];
  selectedTemplateId?: string | null;
  onSelectTemplate?: (templateId: string | null) => void;
  onDownload: (format: PreviewFormat, template?: DocumentTemplateItem) => void;
  isDownloading?: boolean;
}

export function DocumentPreviewModal({
  isOpen,
  onClose,
  title,
  content,
  contentType,
  initialFormat,
  schoolName = "SMA / SMK Negeri",
  teacherName = "Guru Pengampu",
  subjectName = "Mata Pelajaran",
  className = "Kelas",
  academicPeriod = "T.A. 2026/2027",
  dateStr = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }),
  availableTemplates = [],
  selectedTemplateId = null,
  onSelectTemplate,
  onDownload,
  isDownloading = false,
}: DocumentPreviewModalProps) {
  const isPresentationDoc =
    contentType === "LEARNING_MATERIAL" &&
    (/slide|presentasi|powerpoint|pptx/i.test(title) ||
      content.includes("## Slide") ||
      content.includes("[Speaker Notes]") ||
      content.includes("[PANDUAN SLIDE"));

  const effectiveInitialFormat = initialFormat || (isPresentationDoc ? "pptx" : "docx");
  const [userSelectedFormat, setUserSelectedFormat] = useState<PreviewFormat | null>(null);
  const activeFormat = userSelectedFormat || effectiveInitialFormat;
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(selectedTemplateId);

  if (!isOpen) return null;

  const currentTemplate = availableTemplates.find((t) => t.id === activeTemplateId);
  const relevantTemplates = availableTemplates.filter((t) => {
    if (activeFormat === "docx") return (t.format || "DOCX") === "DOCX";
    if (activeFormat === "xlsx") return t.format === "XLSX";
    return false;
  });

  const handleFormatChange = (format: PreviewFormat) => {
    setUserSelectedFormat(format);
    // Reset selected template if incompatible
    if (format === "docx" || format === "xlsx") {
      const firstCompat = availableTemplates.find((t) =>
        format === "docx" ? (t.format || "DOCX") === "DOCX" : t.format === "XLSX"
      );
      setActiveTemplateId(firstCompat?.id || null);
      if (onSelectTemplate) onSelectTemplate(firstCompat?.id || null);
    } else {
      setActiveTemplateId(null);
      if (onSelectTemplate) onSelectTemplate(null);
    }
  };

  const handleTemplateChange = (templateId: string | null) => {
    setActiveTemplateId(templateId);
    if (onSelectTemplate) onSelectTemplate(templateId);
  };

  // Helper to split content into slide decks simulation for PPT
  const getPptSlides = () => {
    const lines = content.split("\n");
    const slides: Array<{ title: string; bullets: string[]; roleTag?: string }> = [];
    
    // First slide is always the Hero Cover Slide
    slides.push({
      title: title || "Materi Pembelajaran",
      bullets: [
        `Mata Pelajaran: ${subjectName}`,
        `Kelas / Tingkat: ${className}`,
        `Guru Pengampu: ${teacherName}`,
        `Satuan Pendidikan: ${schoolName}`,
      ],
      roleTag: "COVER",
    });

    let currentSlideTitle = "";
    let currentBullets: string[] = [];
    let currentRole: string | undefined = undefined;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "---" || trimmed === "***") return;

      // Filter out Speaker Notes or Visual tag from slide bullets preview
      if (/^>?\s*\[?(?:Speaker Notes|Catatan Guru|Visual|Ilustrasi)\]?:/i.test(trimmed)) {
        return;
      }

      // Check role tag
      const roleMatch = trimmed.match(/^\[(?:Role|Peran):\s*([^\]]+)\]/i);
      if (roleMatch) {
        currentRole = roleMatch[1].trim();
        return;
      }

      if (/^#{1,6}\s+/.test(trimmed)) {
        const rawHeading = trimmed.replace(/^#+\s*/, "").replace(/[*_#`~]+/g, "").trim();
        // Skip document H1 title as it's already in the cover slide
        if (trimmed.startsWith("# ") && !currentSlideTitle) {
          return;
        }

        if (currentSlideTitle && currentBullets.length > 0) {
          slides.push({
            title: currentSlideTitle,
            bullets: currentBullets,
            roleTag: currentRole,
          });
          currentBullets = [];
          currentRole = undefined;
        }

        // Sanitize machine prefix like "Slide 1:" or "Slide 02 -"
        currentSlideTitle = rawHeading
          .replace(/^(slide|bagian|bab)\s*\d+[\s:.-]*/i, "")
          .replace(/[\(\[]\s*\d+\s*[\/\-]\s*\d+\s*[\)\]]$/i, "")
          .trim() || rawHeading;
      } else if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        if (trimmed.replace(/[|\-\s:]/g, "").length === 0) return;
        const cells = trimmed.split("|").slice(1, -1).map((c) => c.replace(/<br\s*\/?>/gi, " ").replace(/[*_#`~]+/g, "").trim());
        currentBullets.push(cells.join(" — "));
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s/.test(trimmed)) {
        currentBullets.push(
          trimmed
            .replace(/^[-*]\s*|\d+\.\s*/, "")
            .replace(/(\*\*\*|___)(.*?)\1/g, "$2")
            .replace(/(\*\*|__)(.*?)\1/g, "$2")
            .replace(/(\*|_)(.*?)\1/g, "$2")
            .replace(/`([^`]+)`/g, "$1")
            .trim()
        );
      } else {
        const cleanP = trimmed
          .replace(/^>\s*/, "")
          .replace(/(\*\*\*|___)(.*?)\1/g, "$2")
          .replace(/(\*\*|__)(.*?)\1/g, "$2")
          .replace(/(\*|_)(.*?)\1/g, "$2")
          .replace(/`([^`]+)`/g, "$1")
          .trim();
        if (cleanP && !cleanP.startsWith("#")) {
          currentBullets.push(cleanP);
        }
      }
    });

    if (currentSlideTitle && currentBullets.length > 0) {
      slides.push({
        title: currentSlideTitle,
        bullets: currentBullets,
        roleTag: currentRole,
      });
    }

    return slides;
  };

  // Helper to parse inline bold and italic into React nodes
  const renderInlineFormatted = (text: string) => {
    const clean = text.trim();
    if (!clean) return null;

    const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|___[^_]+___|__[^_]+__|_[^_]+_|`[^`]+`)/g;
    const parts = clean.split(regex);

    return parts.map((part, i) => {
      if (!part) return null;
      if (part.startsWith("***") && part.endsWith("***") && part.length > 6) {
        return <strong key={i} className="font-bold italic">{part.slice(3, -3)}</strong>;
      }
      if (
        (part.startsWith("**") && part.endsWith("**") && part.length > 4) ||
        (part.startsWith("__") && part.endsWith("__") && part.length > 4)
      ) {
        return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      if (
        (part.startsWith("*") && part.endsWith("*") && part.length > 2) ||
        (part.startsWith("_") && part.endsWith("_") && part.length > 2)
      ) {
        return <em key={i} className="italic text-slate-800">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return (
          <code key={i} className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-xs font-mono">
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Render markdown lines into formatted HTML preview with table support
  const renderFormattedMarkdown = (rawText: string) => {
    const lines = rawText.split("\n");
    const elements: React.ReactNode[] = [];
    let tableRows: string[][] = [];
    let inTable = false;

    const flushTable = (keyPrefix: number) => {
      if (tableRows.length === 0) return;
      const [headers, ...dataRows] = tableRows;
      elements.push(
        <div key={`tbl-${keyPrefix}`} className="overflow-x-auto my-4 rounded-xl border border-slate-200 shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-800 font-semibold">
                {headers.map((h, hi) => (
                  <th key={hi} className="px-3.5 py-2.5 border-r border-slate-200 last:border-r-0">
                    {renderInlineFormatted(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {dataRows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 1 ? "bg-slate-50/50" : ""}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3.5 py-2 border-r border-slate-100 last:border-r-0 align-top text-slate-700 leading-relaxed">
                      {cell.split(/<br\s*\/?>/gi).map((cLine, cli) => (
                        <div key={cli} className={cli > 0 ? "mt-1" : ""}>
                          {renderInlineFormatted(cLine)}
                        </div>
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Table row
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        if (trimmed.replace(/[|\-\s:]/g, "").length === 0) return;
        const cells = trimmed
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        tableRows.push(cells);
        inTable = true;
        return;
      } else if (inTable) {
        flushTable(idx);
      }

      if (!trimmed || trimmed === "---" || trimmed === "***") {
        elements.push(<div key={idx} className="h-2" />);
        return;
      }

      if (trimmed.startsWith("# ")) {
        elements.push(
          <h1 key={idx} className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2 mt-5 mb-2">
            {renderInlineFormatted(trimmed.replace(/^#+\s*/, ""))}
          </h1>
        );
        return;
      }
      if (trimmed.startsWith("## ")) {
        elements.push(
          <h2 key={idx} className="text-base font-bold text-slate-800 border-l-4 border-indigo-600 pl-2.5 mt-4 mb-2 bg-indigo-50/40 py-1 rounded-r">
            {renderInlineFormatted(trimmed.replace(/^#+\s*/, ""))}
          </h2>
        );
        return;
      }
      if (trimmed.startsWith("### ")) {
        elements.push(
          <h3 key={idx} className="text-sm font-semibold text-slate-800 mt-3 mb-1">
            {renderInlineFormatted(trimmed.replace(/^#+\s*/, ""))}
          </h3>
        );
        return;
      }
      if (/^#{4,}\s+/.test(trimmed)) {
        elements.push(
          <h4 key={idx} className="text-xs font-bold text-slate-700 uppercase tracking-wide mt-3 mb-1">
            {renderInlineFormatted(trimmed.replace(/^#+\s*/, ""))}
          </h4>
        );
        return;
      }
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        elements.push(
          <li key={idx} className="ml-5 list-disc text-sm text-slate-700 leading-relaxed my-0.5">
            {renderInlineFormatted(trimmed.replace(/^[-*]\s*/, ""))}
          </li>
        );
        return;
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        elements.push(
          <li key={idx} className="ml-5 list-decimal text-sm text-slate-700 leading-relaxed my-0.5">
            {numMatch ? renderInlineFormatted(numMatch[2]) : renderInlineFormatted(trimmed)}
          </li>
        );
        return;
      }
      if (trimmed.startsWith("> ")) {
        elements.push(
          <blockquote key={idx} className="border-l-4 border-amber-400 bg-amber-50/60 p-2.5 text-xs text-amber-900 rounded-r my-2 italic">
            {renderInlineFormatted(trimmed.replace(/^>\s*/, ""))}
          </blockquote>
        );
        return;
      }

      elements.push(
        <p key={idx} className="text-sm text-slate-700 leading-relaxed my-1">
          {renderInlineFormatted(trimmed)}
        </p>
      );
    });

    if (inTable) {
      flushTable(lines.length);
    }

    return elements;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Pratinjau Dokumen Pembelajaran</h2>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    isPresentationDoc || activeFormat === "pptx"
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : "bg-indigo-50 text-indigo-700 border-indigo-200"
                  }`}
                >
                  {isPresentationDoc || activeFormat === "pptx"
                    ? "Slide Presentasi"
                    : CONTENT_TYPE_LABELS[contentType]?.title || contentType}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Periksa susunan dan format dokumen sebelum mengunduhnya ke perangkat Anda.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* FORMAT SELECTOR BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 bg-white">
          {/* Format Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            {isPresentationDoc || activeFormat === "pptx" ? (
              <button
                type="button"
                onClick={() => handleFormatChange("pptx")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-purple-700 shadow-sm transition-all"
              >
                <Presentation className="h-3.5 w-3.5 text-purple-600" />
                PowerPoint (.pptx)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleFormatChange("docx")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-blue-700 shadow-sm transition-all"
              >
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                Word (.docx)
              </button>
            )}
          </div>

          {/* Template Selector (Word & Excel only) */}
          {(activeFormat === "docx" || activeFormat === "xlsx") && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <LayoutTemplate className="h-3.5 w-3.5 text-slate-400" />
                Template:
              </span>
              <select
                value={activeTemplateId || ""}
                onChange={(e) => handleTemplateChange(e.target.value || null)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[240px]"
              >
                <option value="">Standar KLASSA ({activeFormat.toUpperCase()})</option>
                {relevantTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    Template: {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* PREVIEW BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/80 flex justify-center">
          
          {/* A4 SIMULATED PAPER SHEET */}
          <div className="bg-white rounded-xl shadow-md border border-slate-200 w-full max-w-3xl min-h-[500px] p-8 md:p-12 relative flex flex-col justify-between">
            
            <div>
              {/* KOP / OFFICIAL DOCUMENT HEADER */}
              <div className="border-b-2 border-slate-900 pb-4 mb-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-indigo-900 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      KOP
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base tracking-wide uppercase">
                        {schoolName}
                      </h3>
                      <p className="text-xs text-slate-600 font-medium">
                        Perencanaan Pembelajaran — Tahun Ajaran {academicPeriod}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500 space-y-0.5">
                    <div className="flex items-center justify-end gap-1 font-semibold text-slate-700">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      {dateStr}
                    </div>
                    <div className="text-[11px] text-slate-400">Status: Pratinjau Resmi</div>
                  </div>
                </div>

                {/* METADATA GRID */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-slate-200 text-xs">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <BookOpen className="h-2.5 w-2.5" /> Mata Pelajaran
                    </div>
                    <div className="font-semibold text-slate-800 truncate">{subjectName}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <GraduationCap className="h-2.5 w-2.5" /> Kelas
                    </div>
                    <div className="font-semibold text-slate-800 truncate">{className}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <User className="h-2.5 w-2.5" /> Guru Pengampu
                    </div>
                    <div className="font-semibold text-slate-800 truncate">{teacherName}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <Building2 className="h-2.5 w-2.5" /> Jenis Dokumen
                    </div>
                    <div className="font-semibold text-slate-800 truncate">{CONTENT_TYPE_LABELS[contentType]?.title || contentType}</div>
                  </div>
                </div>
              </div>

              {/* DOKUMEN JUDUL BESAR */}
              <div className="mb-6">
                <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 leading-snug">
                  {title}
                </h1>
              </div>

              {/* FORMAT-SPECIFIC PREVIEWS */}
              {activeFormat === "pptx" ? (
                /* PPTX SLIDE DECK CARDS PREVIEW */
                <div className="space-y-4 my-6">
                  <div className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Presentation className="h-4 w-4 text-purple-600" />
                      Pratinjau Simulasi {getPptSlides().length} Slide Presentasi PowerPoint (.pptx)
                    </span>
                    <Badge className="bg-purple-600 text-white text-[10px]">
                      Format PPTX
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getPptSlides().map((slide, i) => {
                      const isCover = i === 0;
                      const titleLower = slide.title.toLowerCase();
                      const roleLower = (slide.roleTag || "").toLowerCase();

                      let badgeText = "📌 POKOK BAHASAN";
                      let badgeBg = "bg-blue-50 text-blue-700 border-blue-200";

                      if (isCover) {
                        badgeText = "✨ COVER UTAMA";
                        badgeBg = "bg-indigo-900/60 text-indigo-200 border-indigo-500/40";
                      } else if (titleLower.includes("pemantik") || roleLower.includes("hook")) {
                        badgeText = "💡 PEMANTIK";
                        badgeBg = "bg-amber-50 text-amber-700 border-amber-200";
                      } else if (titleLower.includes("tujuan") || roleLower.includes("obj")) {
                        badgeText = "🎯 TUJUAN BELAJAR";
                        badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
                      } else if (titleLower.includes("kuis") || roleLower.includes("quiz")) {
                        badgeText = "📝 KUIS CEPAT";
                        badgeBg = "bg-purple-50 text-purple-700 border-purple-200";
                      } else if (titleLower.includes("rangkum") || titleLower.includes("kesimpulan") || roleLower.includes("sum")) {
                        badgeText = "✨ RANGKUMAN INTI";
                        badgeBg = "bg-indigo-50 text-indigo-700 border-indigo-200";
                      } else if (titleLower.includes("vs") || titleLower.includes("banding") || roleLower.includes("split")) {
                        badgeText = "⚖️ PERBANDINGAN";
                        badgeBg = "bg-cyan-50 text-cyan-700 border-cyan-200";
                      }

                      return (
                        <div
                          key={i}
                          className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between min-h-[175px] transition-all ${
                            isCover
                              ? "bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border-slate-700 shadow-md"
                              : "bg-white text-slate-900 border-slate-200 hover:border-indigo-300 hover:shadow-md"
                          }`}
                        >
                          <div>
                            <div className={`flex items-center justify-between text-[11px] mb-2.5 pb-2 border-b ${isCover ? "border-slate-700 text-slate-300" : "border-slate-100 text-slate-500"}`}>
                              <span className="font-bold flex items-center gap-1.5">
                                <span className={isCover ? "text-indigo-400" : "text-indigo-600"}>●</span> Slide {i + 1}
                              </span>
                              <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${badgeBg}`}>
                                {badgeText}
                              </span>
                            </div>
                            <h4 className={`font-bold text-sm leading-snug mb-2.5 ${isCover ? "text-white text-base" : "text-slate-900"}`}>
                              {slide.title}
                            </h4>
                            <ul className={`space-y-1.5 text-xs ${isCover ? "text-slate-200" : "text-slate-600"}`}>
                              {slide.bullets.slice(0, 4).map((b, bi) => (
                                <li key={bi} className="truncate flex items-start gap-1.5">
                                  <span className={isCover ? "text-indigo-400 font-bold" : "text-indigo-600 font-bold"}>•</span>
                                  <span className="truncate">{b}</span>
                                </li>
                              ))}
                              {slide.bullets.length > 4 && (
                                <li className={`text-[10px] italic ${isCover ? "text-slate-400" : "text-slate-400"}`}>
                                  + {slide.bullets.length - 4} poin lainnya...
                                </li>
                              )}
                            </ul>
                          </div>
                          <div className={`text-[10px] mt-3 pt-2 border-t flex justify-between ${isCover ? "border-slate-700 text-slate-400" : "border-slate-100 text-slate-400"}`}>
                            <span>{schoolName}</span>
                            <span className="font-medium">{teacherName}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : activeFormat === "xlsx" ? (
                /* EXCEL SHEET SIMULATOR PREVIEW */
                <div className="space-y-4 my-6">
                  <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Pratinjau Lembar Kerja Excel (.xlsx)
                    </span>
                    {currentTemplate && (
                      <Badge className="bg-emerald-600 text-white text-[10px]">
                        Template: {currentTemplate.name}
                      </Badge>
                    )}
                  </div>

                  {/* Excel Simulated Table */}
                  <div className="border border-slate-300 rounded-lg overflow-x-auto shadow-inner bg-slate-50 font-mono text-xs">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-200 text-slate-600 text-center font-bold">
                          <th className="border border-slate-300 px-2 py-1 w-12 bg-slate-300"></th>
                          <th className="border border-slate-300 px-3 py-1">A</th>
                          <th className="border border-slate-300 px-3 py-1">B</th>
                          <th className="border border-slate-300 px-3 py-1">C</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-slate-300 bg-slate-200 text-center text-slate-500 font-bold">1</td>
                          <td className="border border-slate-300 px-3 py-1.5 font-bold text-slate-700">Judul</td>
                          <td className="border border-slate-300 px-3 py-1.5 text-slate-900 bg-white" colSpan={2}>
                            {title}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 bg-slate-200 text-center text-slate-500 font-bold">2</td>
                          <td className="border border-slate-300 px-3 py-1.5 font-bold text-slate-700">Guru / Sekolah</td>
                          <td className="border border-slate-300 px-3 py-1.5 text-slate-800 bg-white">{teacherName}</td>
                          <td className="border border-slate-300 px-3 py-1.5 text-slate-800 bg-white">{schoolName}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 bg-slate-200 text-center text-slate-500 font-bold">3</td>
                          <td className="border border-slate-300 px-3 py-1.5 font-bold text-slate-700">Mata Pelajaran</td>
                          <td className="border border-slate-300 px-3 py-1.5 text-slate-800 bg-white">{subjectName}</td>
                          <td className="border border-slate-300 px-3 py-1.5 text-slate-800 bg-white">{className}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 bg-slate-200 text-center text-slate-500 font-bold">4</td>
                          <td className="border border-slate-300 px-3 py-1.5 font-bold text-slate-700 align-top">Isi Konten</td>
                          <td className="border border-slate-300 px-3 py-1.5 text-slate-700 bg-white whitespace-pre-wrap font-sans text-xs" colSpan={2}>
                            {content.slice(0, 300)}...
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* FORMATTED TEXT / MARKDOWN PREVIEW (WORD & PDF) */
                <div className="prose prose-slate max-w-none text-slate-800 my-6">
                  {renderFormattedMarkdown(content)}
                </div>
              )}

              {/* TEMPLATE PLACEHOLDER MAPPING BADGES (IF CUSTOM TEMPLATE SELECTED) */}
              {currentTemplate && (
                <div className="my-6 p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Tag Placeholder Terpetakan pada Template: &quot;{currentTemplate.name}&quot;
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(currentTemplate.placeholderManifest?.detectedPlaceholders || []).map((ph: string, pi: number) => (
                      <Badge
                        key={pi}
                        variant="outline"
                        className="bg-white border-indigo-300 text-indigo-800 text-[11px] px-2 py-0.5 font-mono"
                      >
                        &#123;&#123;{ph}&#125;&#125;
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SIGNATURE FOOTER */}
            <div className="pt-8 mt-10 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-700">
              <div>
                <p className="text-slate-500">Mengetahui,</p>
                <p className="font-semibold text-slate-800 mt-1">Kepala Sekolah {schoolName}</p>
                <div className="h-16 border-b border-dashed border-slate-300 w-3/4 mt-2"></div>
                <p className="text-[11px] text-slate-400 mt-1">NIP. ........................................</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500">{dateStr}</p>
                <p className="font-semibold text-slate-800 mt-1">Guru Mata Pelajaran</p>
                <div className="h-16 border-b border-dashed border-slate-300 w-3/4 ml-auto mt-2"></div>
                <p className="font-bold text-slate-900 mt-1">{teacherName}</p>
              </div>
            </div>

          </div>
        </div>

        {/* MODAL FOOTER WITH ACTIONS */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs font-semibold text-slate-700"
          >
            Tutup & Kembali ke Editor
          </Button>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              disabled={isDownloading}
              onClick={() => onDownload(activeFormat, currentTemplate)}
              className={`px-5 py-2 text-xs font-bold text-white shadow-md rounded-xl gap-2 transition-all hover:scale-[1.02] ${
                activeFormat === "pptx"
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              <Download className="h-4 w-4" />
              {isDownloading
                ? "Menyiapkan Dokumen..."
                : activeFormat === "pptx"
                ? "Unduh Slide PowerPoint (.PPTX)"
                : `Unduh Dokumen ${activeFormat.toUpperCase()} Sekarang`}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
