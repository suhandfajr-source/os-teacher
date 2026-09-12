/**
 * TEACHER OS — AI STUDIO EXPORT V2 (PHASE A)
 * PPT Exporter Bridge
 * 
 * Orchestrates:
 * AI Draft Markdown → Parser → PresentationModel → Layout Resolver → PPTX Renderer
 */

import { parseMarkdownForPpt } from "./ppt/ppt-parser";
import { resolvePresentationLayout } from "./ppt/ppt-layout-resolver";
import {
  renderPresentationPptxVisual,
  IllustrationResolver,
} from "./ppt-html/render-presentation";
import { PresentationMetadata } from "./ppt/ppt-types";

export interface ExportPptOptions {
  title: string;
  content: string;
  schoolName?: string;
  subjectName?: string;
  teacherName?: string;
  className?: string;
  dateStr?: string;
  /** Optional AI illustration resolver (server action) for key slides. */
  illustrationResolver?: IllustrationResolver;
}

/**
 * Converts structured AI output into clean PowerPoint (.pptx) presentation slides
 */
export async function exportToPowerPoint(options: ExportPptOptions): Promise<void> {
  const { title, content, schoolName, subjectName, teacherName, className, dateStr, illustrationResolver } = options;

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

    // 3. Subject-adaptive visual render (HTML → PNG → PPTX with speaker notes)
    await renderPresentationPptxVisual(presentationModel, undefined, illustrationResolver);
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Terjadi kendala saat menyusun slide presentasi PowerPoint.");
  }
}
