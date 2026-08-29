/**
 * TEACHER OS — AI STUDIO EXPORT V2 (PHASE A)
 * PPT Markdown Parser
 * 
 * Deterministically parses AI Markdown drafts into semantic presentation sections.
 */

import { BulletItem } from "./ppt-types";

export type ParsedSectionType =
  | "OBJECTIVES"
  | "CONTENT"
  | "TAKEAWAY"
  | "QUIZ"
  | "REFLECTION";

export interface ParsedSection {
  id: string;
  type: ParsedSectionType;
  heading: string;
  items: BulletItem[];
  rawParagraphs: string[];
}

export interface ParsedPresentationDoc {
  documentTitle: string;
  sections: ParsedSection[];
}

// Explicit heading triggers for Quiz & Reflection
const EXPLICIT_QUIZ_HEADINGS = [
  "kuis",
  "quiz",
  "cek pemahaman",
  "quick check",
];

const EXPLICIT_REFLECTION_HEADINGS = [
  "refleksi",
  "pertanyaan refleksi",
  "pertanyaan diskusi",
  "refleksi pembelajaran",
  "diskusi refleksi",
];

const OBJECTIVES_HEADINGS = [
  "tujuan",
  "tujuan pembelajaran",
  "capaian pembelajaran",
  "indikator",
  "learning objectives",
  "kompetensi",
];

const TAKEAWAY_HEADINGS = [
  "kesimpulan",
  "rangkuman",
  "penutup",
  "ringkasan",
  "takeaway",
  "summary",
  "poin penting",
];

/**
 * Normalizes heading text for pattern matching
 */
function normalizeHeading(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/^#+\s*/, "")
    .replace(/[*_~`]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim();
}

/**
 * Determines section semantic type based strictly on explicit heading text
 */
function classifySectionHeading(heading: string): ParsedSectionType {
  const norm = normalizeHeading(heading);

  // Check explicit quiz patterns first
  for (const q of EXPLICIT_QUIZ_HEADINGS) {
    if (norm === q || norm.startsWith(`${q} `) || norm.endsWith(` ${q}`)) {
      return "QUIZ";
    }
  }

  // Check explicit reflection patterns
  for (const r of EXPLICIT_REFLECTION_HEADINGS) {
    if (norm === r || norm.startsWith(`${r} `) || norm.endsWith(` ${r}`)) {
      return "REFLECTION";
    }
  }

  // Check objectives
  for (const obj of OBJECTIVES_HEADINGS) {
    if (norm === obj || norm.includes(obj)) {
      return "OBJECTIVES";
    }
  }

  // Check takeaways
  for (const t of TAKEAWAY_HEADINGS) {
    if (norm === t || norm.includes(t)) {
      return "TAKEAWAY";
    }
  }

  return "CONTENT";
}

/**
 * Clean markdown styling from inline text
 */
export function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold **
    .replace(/__(.*?)__/g, "$1")     // bold __
    .replace(/\*(.*?)\*/g, "$1")     // italic *
    .replace(/_(.*?)_/g, "$1")       // italic _
    .replace(/`([^`]+)`/g, "$1")     // inline code
    .replace(/\[(.*?)\]\(.*?\)/g, "$1") // link text
    .trim();
}

/**
 * Parses raw Markdown text into a structured presentation document
 */
export function parseMarkdownForPpt(
  rawContent: string,
  fallbackTitle: string = "Materi Pembelajaran"
): ParsedPresentationDoc {
  if (!rawContent || !rawContent.trim()) {
    return {
      documentTitle: fallbackTitle,
      sections: [],
    };
  }

  const lines = rawContent.split(/\r?\n/);
  const sections: ParsedSection[] = [];

  let detectedDocTitle: string | null = null;
  let currentSection: ParsedSection | null = null;
  let currentBulletItem: BulletItem | null = null;

  const ensureCurrentSection = (heading: string = "Pokok Pembahasan"): ParsedSection => {
    if (!currentSection) {
      const type = classifySectionHeading(heading);
      currentSection = {
        id: `sec-${sections.length + 1}`,
        type,
        heading,
        items: [],
        rawParagraphs: [],
      };
    }
    return currentSection;
  };

  const flushCurrentSection = () => {
    if (currentBulletItem && currentSection) {
      currentSection.items.push(currentBulletItem);
      currentBulletItem = null;
    }
    if (currentSection && (currentSection.items.length > 0 || currentSection.rawParagraphs.length > 0)) {
      sections.push(currentSection);
    }
    currentSection = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      // Empty line -> finalize active bullet item if any
      if (currentBulletItem && currentSection) {
        currentSection.items.push(currentBulletItem);
        currentBulletItem = null;
      }
      continue;
    }

    // 1. Heading (#, ##, ###, ####)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = cleanInlineMarkdown(headingMatch[2]);

      // If document title hasn't been set and this is H1, capture as document title
      if (level === 1 && !detectedDocTitle) {
        detectedDocTitle = headingText;
      }

      flushCurrentSection();
      const type = classifySectionHeading(headingText);
      currentSection = {
        id: `sec-${sections.length + 1}`,
        type,
        heading: headingText,
        items: [],
        rawParagraphs: [],
      };
      continue;
    }

    // 2. Nested Bullet check (indented by 2+ spaces or tab)
    const isIndented = /^(\s{2,}|\t+)[-*•+]/.test(rawLine);
    if (isIndented && currentBulletItem) {
      const subpointText = cleanInlineMarkdown(
        rawLine.replace(/^\s*[-*•+]\s*/, "")
      );
      if (subpointText) {
        if (!currentBulletItem.subpoints) {
          currentBulletItem.subpoints = [];
        }
        currentBulletItem.subpoints.push(subpointText);
      }
      continue;
    }

    // 3. Top-level Bullet or Numbered List Item
    const bulletMatch = trimmed.match(/^[-*•+]\s+(.+)$/);
    const numberedMatch = trimmed.match(/^\d+[\.\)]\s+(.+)$/);

    if (bulletMatch || numberedMatch) {
      const targetText = cleanInlineMarkdown(
        bulletMatch ? bulletMatch[1] : numberedMatch![1]
      );

      const sec = ensureCurrentSection();

      if (currentBulletItem) {
        sec.items.push(currentBulletItem);
      }

      currentBulletItem = {
        text: targetText,
      };
      continue;
    }

    // 4. Normal paragraph text
    const cleanParagraph = cleanInlineMarkdown(trimmed);
    if (cleanParagraph) {
      const sec = ensureCurrentSection();

      // If there is an active bullet item, this might be a multi-line continuation of the bullet
      if (currentBulletItem && !rawLine.startsWith("#")) {
        currentBulletItem.text += ` ${cleanParagraph}`;
      } else {
        sec.rawParagraphs.push(cleanParagraph);
      }
    }
  }

  flushCurrentSection();

  return {
    documentTitle: detectedDocTitle || fallbackTitle,
    sections,
  };
}
