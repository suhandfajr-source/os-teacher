/**
 * TEACHER OS — AI STUDIO EXPORT V2 (PHASE A)
 * PPT Exporter Bridge
 * 
 * Orchestrates:
 * AI Draft Markdown → Parser → PresentationModel → Layout Resolver → PPTX Renderer
 */

import { parseMarkdownForPpt } from "./ppt/ppt-parser";
import { resolvePresentationLayout } from "./ppt/ppt-layout-resolver";
import { renderPresentationPptx } from "./ppt/ppt-renderer";
import { PresentationMetadata } from "./ppt/ppt-types";

export interface ExportPptOptions {
  title: string;
  content: string;
  schoolName?: string;
  subjectName?: string;
  teacherName?: string;
  className?: string;
  dateStr?: string;
}

/**
 * Converts structured AI output into clean PowerPoint (.pptx) presentation slides
 */
export async function exportToPowerPoint(options: ExportPptOptions): Promise<void> {
  const { title, content, schoolName, subjectName, teacherName, className, dateStr } = options;

  if (!title || !title.trim()) {
    throw new Error("Judul materi pembelajaran tidak boleh kosong.");
  }

  const effectiveDate =
    dateStr ||
    new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const metadata: PresentationMetadata = {
    title: title.trim(),
    schoolName: schoolName?.trim() || undefined,
    subjectName: subjectName?.trim() || undefined,
    teacherName: teacherName?.trim() || undefined,
    className: className?.trim() || undefined,
    dateFormatted: effectiveDate,
  };

  try {
    // 1. Markdown Parsing
    const parsedDoc = parseMarkdownForPpt(content || "", metadata.title);

    // 2. Deterministic Layout Resolution & Overflow Handling
    const presentationModel = resolvePresentationLayout(parsedDoc, metadata, content);

    // 3. Render and Trigger Download
    await renderPresentationPptx(presentationModel);
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Terjadi kendala saat menyusun slide presentasi PowerPoint.");
  }
}
