/**
 * TEACHER OS — AI STUDIO EXPORT V2 (PHASE A)
 * Deterministic Presentation Layout Resolver
 * 
 * Maps parsed document sections into typed presentation slides with strict overflow safety.
 */

import {
  PresentationMetadata,
  PresentationModel,
  PresentationSlide,
  CoverSlide,
  ObjectivesSlide,
  ContentSlide,
  TakeawaySlide,
  ReflectionOrQuizSlide,
  BulletItem,
  LayoutConstraints,
  DEFAULT_LAYOUT_CONSTRAINTS,
} from "./ppt-types";
import { ParsedPresentationDoc } from "./ppt-parser";

/**
 * Splits a long text string into sentences or chunks that fit within maxChunkLength
 */
function splitLongText(text: string, maxChunkLength: number = 220): string[] {
  if (text.length <= maxChunkLength) {
    return [text];
  }

  // Try splitting by sentence delimiters
  const sentenceMatches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (sentenceMatches && sentenceMatches.length > 1) {
    const chunks: string[] = [];
    let currentChunk = "";

    for (const s of sentenceMatches) {
      const trimmed = s.trim();
      if (!trimmed) continue;

      if ((currentChunk + " " + trimmed).trim().length <= maxChunkLength) {
        currentChunk = (currentChunk + " " + trimmed).trim();
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = trimmed;
      }
    }
    if (currentChunk) chunks.push(currentChunk);
    if (chunks.length > 0) return chunks;
  }

  // Fallback: split by word boundaries
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let cur = "";

  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxChunkLength) {
      cur = (cur + " " + w).trim();
    } else {
      if (cur) chunks.push(cur);
      cur = w;
    }
  }
  if (cur) chunks.push(cur);

  return chunks.length > 0 ? chunks : [text];
}

/**
 * Estimates the rendered vertical lines for a bullet item
 */
function estimateItemLines(item: BulletItem, charsPerLine: number): number {
  let lines = Math.max(1, Math.ceil(item.text.length / charsPerLine));
  if (item.subpoints && item.subpoints.length > 0) {
    for (const sub of item.subpoints) {
      lines += Math.max(1, Math.ceil(sub.length / (charsPerLine - 6))) + 0.5;
    }
  }
  return lines;
}

/**
 * Splits bullet items into slide-sized chunks based on line budget and item count
 */
function chunkBulletItems(
  items: BulletItem[],
  constraints: LayoutConstraints
): BulletItem[][] {
  if (items.length === 0) return [];

  // 1. First unpack any long bullets (>280 chars) into sub-chunks to prevent overflow
  const normalizedItems: BulletItem[] = [];
  for (const item of items) {
    if (item.text.length > 280) {
      const parts = splitLongText(item.text, 220);
      parts.forEach((p, idx) => {
        normalizedItems.push({
          text: idx === 0 ? p : `... ${p}`,
          subpoints: idx === parts.length - 1 ? item.subpoints : undefined,
        });
      });
    } else {
      normalizedItems.push(item);
    }
  }

  const chunks: BulletItem[][] = [];
  let currentChunk: BulletItem[] = [];
  let currentLineCount = 0;

  for (const item of normalizedItems) {
    const itemLines = estimateItemLines(item, constraints.charsPerLine);

    const willExceedLines = currentLineCount + itemLines > constraints.maxLinesPerSlide;
    const willExceedItems = currentChunk.length >= constraints.maxItemsPerSlide;

    if (currentChunk.length > 0 && (willExceedLines || willExceedItems)) {
      chunks.push(currentChunk);
      currentChunk = [item];
      currentLineCount = itemLines;
    } else {
      currentChunk.push(item);
      currentLineCount += itemLines;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Resolves a parsed document into a structured presentation model
 */
export function resolvePresentationLayout(
  parsedDoc: ParsedPresentationDoc,
  metadata: PresentationMetadata,
  rawSourceText?: string,
  customConstraints?: Partial<LayoutConstraints>
): PresentationModel {
  const constraints: LayoutConstraints = {
    ...DEFAULT_LAYOUT_CONSTRAINTS,
    ...customConstraints,
  };

  // 1. Defensive Check: Source text character length
  const totalChars =
    (rawSourceText ? rawSourceText.length : 0) ||
    parsedDoc.sections.reduce((acc, s) => {
      let len = s.heading.length;
      for (const it of s.items) {
        len += it.text.length;
        if (it.subpoints) len += it.subpoints.join("").length;
      }
      for (const p of s.rawParagraphs) len += p.length;
      return acc + len;
    }, 0);

  if (totalChars > constraints.maxSourceCharacters) {
    throw new Error(
      `Panjang teks sumber (${totalChars.toLocaleString("id-ID")} karakter) melebihi batas maksimum (${constraints.maxSourceCharacters.toLocaleString("id-ID")} karakter).`
    );
  }

  const slides: PresentationSlide[] = [];

  // 2. Add Cover Slide
  const coverSlide: CoverSlide = {
    id: "slide-cover",
    type: "COVER",
    title: metadata.title || parsedDoc.documentTitle || "Materi Pembelajaran",
    topic: metadata.title !== parsedDoc.documentTitle ? parsedDoc.documentTitle : undefined,
    schoolName: metadata.schoolName,
    subjectName: metadata.subjectName,
    teacherName: metadata.teacherName,
    className: metadata.className,
    dateFormatted: metadata.dateFormatted,
    slideNumber: 1,
    totalSlides: 1,
  };
  slides.push(coverSlide);

  // 3. Process Sections
  for (let sIdx = 0; sIdx < parsedDoc.sections.length; sIdx++) {
    const sec = parsedDoc.sections[sIdx];

    // Combine raw paragraphs into items if items are empty
    const bulletItems = [...sec.items];
    if (bulletItems.length === 0 && sec.rawParagraphs.length > 0) {
      for (const para of sec.rawParagraphs) {
        const parts = splitLongText(para, 220);
        for (const p of parts) {
          bulletItems.push({ text: p });
        }
      }
    }

    if (bulletItems.length === 0) {
      // Empty section, skip
      continue;
    }

    // Handle by section type
    if (sec.type === "OBJECTIVES") {
      const textList = bulletItems.map((b) => b.text);
      const chunks = splitArray(textList, constraints.maxItemsPerSlide);

      chunks.forEach((chunk, cIdx) => {
        const totalParts = chunks.length;
        const headingSuffix = totalParts > 1 ? ` (${cIdx + 1}/${totalParts})` : "";
        const objSlide: ObjectivesSlide = {
          id: `slide-obj-${sIdx}-${cIdx + 1}`,
          type: "OBJECTIVES",
          title: `${sec.heading}${headingSuffix}`,
          categoryLabel: "Capaian & Tujuan Pembelajaran",
          objectives: chunk,
          slideNumber: slides.length + 1,
          totalSlides: slides.length + 1,
        };
        slides.push(objSlide);
      });
    } else if (sec.type === "QUIZ" || sec.type === "REFLECTION") {
      const textList = bulletItems.map((b) => b.text);
      const chunks = splitArray(textList, constraints.maxItemsPerSlide);

      chunks.forEach((chunk, cIdx) => {
        const totalParts = chunks.length;
        const headingSuffix = totalParts > 1 ? ` (${cIdx + 1}/${totalParts})` : "";
        const quizSlide: ReflectionOrQuizSlide = {
          id: `slide-quiz-${sIdx}-${cIdx + 1}`,
          type: "REFLECTION_OR_QUIZ",
          title: `${sec.heading}${headingSuffix}`,
          sectionTitle: sec.heading,
          isQuiz: sec.type === "QUIZ",
          questions: chunk,
          slideNumber: slides.length + 1,
          totalSlides: slides.length + 1,
        };
        slides.push(quizSlide);
      });
    } else if (sec.type === "TAKEAWAY") {
      const textList = bulletItems.map((b) => b.text);
      const chunks = splitArray(textList, constraints.maxItemsPerSlide);

      chunks.forEach((chunk, cIdx) => {
        const totalParts = chunks.length;
        const headingSuffix = totalParts > 1 ? ` (${cIdx + 1}/${totalParts})` : "";
        const takeawaySlide: TakeawaySlide = {
          id: `slide-takeaway-${sIdx}-${cIdx + 1}`,
          type: "TAKEAWAY",
          title: `${sec.heading}${headingSuffix}`,
          sectionTitle: sec.heading,
          takeaways: chunk,
          slideNumber: slides.length + 1,
          totalSlides: slides.length + 1,
        };
        slides.push(takeawaySlide);
      });
    } else {
      // Standard CONTENT Section
      const itemChunks = chunkBulletItems(bulletItems, constraints);
      const totalParts = itemChunks.length;

      itemChunks.forEach((chunk, cIdx) => {
        const partIndex = cIdx + 1;
        const headingSuffix = totalParts > 1 ? ` (${partIndex}/${totalParts})` : "";
        const contentSlide: ContentSlide = {
          id: `slide-content-${sIdx}-${partIndex}`,
          type: "CONTENT",
          title: `${sec.heading}${headingSuffix}`,
          sectionTitle: sec.heading,
          partIndex: totalParts > 1 ? partIndex : undefined,
          totalParts: totalParts > 1 ? totalParts : undefined,
          items: chunk,
          slideNumber: slides.length + 1,
          totalSlides: slides.length + 1,
        };
        slides.push(contentSlide);
      });
    }
  }

  // 4. Defensive Check: Slide count limitation
  if (slides.length > constraints.maxPresentationSlides) {
    throw new Error(
      `Jumlah slide (${slides.length} slide) melebihi batas maksimum presentasi (${constraints.maxPresentationSlides} slide). Harap ringkas materi.`
    );
  }

  // 5. Finalize slide total counter on all slides
  const totalSlides = slides.length;
  slides.forEach((s, idx) => {
    s.slideNumber = idx + 1;
    s.totalSlides = totalSlides;
  });

  return {
    metadata,
    slides,
  };
}

function splitArray<T>(arr: T[], chunkSize: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    res.push(arr.slice(i, i + chunkSize));
  }
  return res.length > 0 ? res : [[]];
}
