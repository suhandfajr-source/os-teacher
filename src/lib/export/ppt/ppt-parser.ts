/**
 * TEACHER OS — AI STUDIO EXPORT V2 (PHASE A)
 * PPT Markdown Parser
 * 
 * Deterministically parses AI Markdown drafts into semantic presentation sections
 * with role classification, machine prefix sanitation, and structured note extraction.
 */

import { BulletItem } from "./ppt-types";

export type ParsedSectionType =
  | "OBJECTIVES"
  | "CONTENT"
  | "TAKEAWAY"
  | "QUIZ"
  | "REFLECTION"
  | "HOOK"
  | "SPLIT"
  | "CARDS"
  | "STORY";

export interface ParsedSection {
  id: string;
  type: ParsedSectionType;
  heading: string;
  roleTag?: string;
  items: BulletItem[];
  rawParagraphs: string[];
  speakerNotes?: string;
  visualPrompt?: string;
}

export interface ParsedPresentationDoc {
  documentTitle: string;
  sections: ParsedSection[];
}

// Explicit heading triggers
const EXPLICIT_QUIZ_HEADINGS = [
  "kuis",
  "quiz",
  "cek pemahaman",
  "quick check",
  "uji pemahaman",
  "soal latihan",
  "uji kompetensi",
];

const EXPLICIT_REFLECTION_HEADINGS = [
  "refleksi",
  "pertanyaan refleksi",
  "pertanyaan diskusi",
  "refleksi pembelajaran",
  "diskusi refleksi",
  "renungan",
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
  "inti sari",
  "pesan utama",
];

const HOOK_HEADINGS = [
  "pemantik",
  "pertanyaan pemantik",
  "hook",
  "tahukah kamu",
  "fakta menarik",
  "mengapa",
  "tantangan pembuka",
];

const SPLIT_HEADINGS = [
  "vs",
  "versus",
  "perbandingan",
  "komparasi",
  "perbedaan",
  "dua sisi",
];

const CARDS_HEADINGS = [
  "tiga pilar",
  "3 pilar",
  "4 pilar",
  "empat pilar",
  "pilar utama",
  "aspek utama",
  "dimensi utama",
];

const STORY_HEADINGS = [
  "kisah",
  "sejarah",
  "perjalanan",
  "biografi",
  "kronologi",
  "meneladani",
];

/**
 * Strips machine artifact prefixes like "Slide 1:", "Slide 2 -", and pagination "(1/3)"
 */
export function sanitizeSlideHeading(heading: string): string {
  return heading
    // Remove "Slide 1:", "Slide 02 -", "Bagian 1:" at start
    .replace(/^(slide|bagian|bab)\s*\d+[\s:.-]*/i, "")
    // Remove pagination suffix like "(1/2)", "(1 of 3)", "[1/3]"
    .replace(/[\(\[]\s*\d+\s*[\/\-]\s*\d+\s*[\)\]]$/i, "")
    .trim();
}

/**
 * Normalizes heading text for pattern matching
 */
function normalizeHeading(heading: string): string {
  return sanitizeSlideHeading(heading)
    .toLowerCase()
    .replace(/^#+\s*/, "")
    .replace(/[*_~`]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim();
}

/**
 * Determines section semantic type based on explicit role tags and heading text
 */
function classifySectionHeading(heading: string, explicitRole?: string): ParsedSectionType {
  if (explicitRole) {
    const normRole = explicitRole.toLowerCase().trim();
    if (normRole.includes("hook") || normRole.includes("pemantik")) return "HOOK";
    if (normRole.includes("obj") || normRole.includes("tujuan")) return "OBJECTIVES";
    if (normRole.includes("split") || normRole.includes("banding")) return "SPLIT";
    if (normRole.includes("card") || normRole.includes("pilar")) return "CARDS";
    if (normRole.includes("story") || normRole.includes("kisah") || normRole.includes("concept") || normRole.includes("konsep")) return "STORY";
    if (normRole.includes("quiz") || normRole.includes("kuis")) return "QUIZ";
    if (normRole.includes("reflec") || normRole.includes("renung")) return "REFLECTION";
    if (normRole.includes("sum") || normRole.includes("rangkum") || normRole.includes("takeaway")) return "TAKEAWAY";
  }

  const norm = normalizeHeading(heading);

  // Check explicit quiz patterns
  for (const q of EXPLICIT_QUIZ_HEADINGS) {
    if (norm === q || norm.includes(q)) return "QUIZ";
  }

  // Check explicit reflection patterns
  for (const r of EXPLICIT_REFLECTION_HEADINGS) {
    if (norm === r || norm.includes(r)) return "REFLECTION";
  }

  // Check hook patterns
  for (const h of HOOK_HEADINGS) {
    if (norm === h || norm.includes(h)) return "HOOK";
  }

  // Check split / comparison patterns
  for (const s of SPLIT_HEADINGS) {
    if (norm.includes(` ${s} `) || norm.startsWith(`${s} `) || norm.endsWith(` ${s}`)) return "SPLIT";
  }

  // Check cards patterns
  for (const c of CARDS_HEADINGS) {
    if (norm.includes(c)) return "CARDS";
  }

  // Check story patterns
  for (const st of STORY_HEADINGS) {
    if (norm.includes(st)) return "STORY";
  }

  // Check objectives
  for (const obj of OBJECTIVES_HEADINGS) {
    if (norm === obj || norm.includes(obj)) return "OBJECTIVES";
  }

  // Check takeaways
  for (const t of TAKEAWAY_HEADINGS) {
    if (norm === t || norm.includes(t)) return "TAKEAWAY";
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
      const cleanHeading = sanitizeSlideHeading(heading) || heading;
      const type = classifySectionHeading(cleanHeading);
      currentSection = {
        id: `sec-${sections.length + 1}`,
        type,
        heading: cleanHeading,
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
      if (currentBulletItem && currentSection) {
        currentSection.items.push(currentBulletItem);
        currentBulletItem = null;
      }
      continue;
    }

    // Check for explicit role tag: [Role: ...]
    const roleMatch = trimmed.match(/^\[(?:Role|Peran):\s*([^\]]+)\]/i);
    if (roleMatch && currentSection) {
      const explicitRole = roleMatch[1].trim();
      currentSection.roleTag = explicitRole;
      currentSection.type = classifySectionHeading(currentSection.heading, explicitRole);
      continue;
    }

    // Check for Speaker Notes or Visual suggestions (extract without polluting content)
    const speakerMatch = trimmed.match(/^>?\s*\[?(?:Speaker Notes|Catatan Guru)\]?:\s*(.+)$/i);
    if (speakerMatch && currentSection) {
      currentSection.speakerNotes = speakerMatch[1].trim();
      continue;
    }

    const visualMatch = trimmed.match(/^>?\s*\[?(?:Visual|Ilustrasi|Saran Visual)\]?:\s*(.+)$/i);
    if (visualMatch && currentSection) {
      currentSection.visualPrompt = visualMatch[1].trim();
      continue;
    }

    // 1. Heading (#, ##, ###, ####)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const rawHeadingText = cleanInlineMarkdown(headingMatch[2]);
      const headingText = sanitizeSlideHeading(rawHeadingText) || rawHeadingText;

      // If document title hasn't been set and this is H1, capture as document title
      if (level === 1 && !detectedDocTitle) {
        detectedDocTitle = headingText;
        continue;
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

    // 4. Normal paragraph text / blockquote
    const cleanParagraph = cleanInlineMarkdown(trimmed.replace(/^>\s*/, ""));
    if (cleanParagraph) {
      const sec = ensureCurrentSection();

      // If there is an active bullet item and not a new sentence block
      if (currentBulletItem && !rawLine.startsWith("#") && !rawLine.startsWith(">")) {
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
