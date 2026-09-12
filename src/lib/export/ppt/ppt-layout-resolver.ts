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
  HookStatementSlide,
  SplitColumnSlide,
  CardsGridSlide,
  StoryConceptSlide,
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
 * Resolves a parsed document into a structured presentation model with role-based layouts
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

  let lastSlideType: string = "COVER";

  // 3. Process Sections
  for (let sIdx = 0; sIdx < parsedDoc.sections.length; sIdx++) {
    const sec = parsedDoc.sections[sIdx];

    // Carry speaker notes from the parsed section into every slide it produces.
    const sectionNotes = sec.speakerNotes?.trim() || undefined;
    const pushSlide = (slide: PresentationSlide) => {
      if (sectionNotes) {
        slide.speakerNotes = sectionNotes;
      }
      slides.push(slide);
    };

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

    if (bulletItems.length === 0 && sec.rawParagraphs.length === 0) {
      continue;
    }

    // Defensive Check: If section 0 is an intro heading ("Judul Materi & Pembuka" / "Pembuka")
    // and contains "Tujuan Pembelajaran", convert it to an Objectives slide instead of duplicate content card
    const normH = sec.heading.toLowerCase();
    const isRedundantCoverIntro =
      sIdx === 0 &&
      (normH.includes("judul materi") ||
        normH.includes("pembuka") ||
        normH === "cover" ||
        normH.includes("pengantar"));

    if (isRedundantCoverIntro) {
      const objItem = bulletItems.find((b) =>
        b.text.toLowerCase().includes("tujuan pembelajaran:")
      );
      const otherItems = bulletItems
        .filter((b) => !b.text.toLowerCase().includes("tujuan pembelajaran:"))
        .map((b) => b.text.replace(/^(materi utama|gelar utama|topik utama):\s*/i, ""));

      if (objItem) {
        const cleanObj = objItem.text.replace(/^tujuan pembelajaran:\s*/i, "");
        const objSlide: ObjectivesSlide = {
          id: `slide-obj-intro`,
          type: "OBJECTIVES",
          title: "Tujuan Pembelajaran",
          categoryLabel: "🎯 CAPAIAN PEMBELAJARAN",
          objectives: [cleanObj, ...otherItems.slice(0, 2)],
          slideNumber: slides.length + 1,
          totalSlides: slides.length + 1,
        };
        slides.push(objSlide);
        objSlide.speakerNotes = sectionNotes;
        lastSlideType = "OBJECTIVES";
        continue;
      }
    }

    // Role: HOOK
    if (sec.type === "HOOK") {
      const primaryStatement =
        sec.rawParagraphs[0] ||
        (bulletItems.length > 0 ? bulletItems[0].text : sec.heading);
      const supporting =
        sec.rawParagraphs.length > 1
          ? sec.rawParagraphs.slice(1).join(" ")
          : bulletItems.length > 1
          ? bulletItems.slice(1).map((b) => b.text).join(" • ")
          : undefined;

      const hookSlide: HookStatementSlide = {
        id: `slide-hook-${sIdx}`,
        type: "HOOK_STATEMENT",
        title: sec.heading,
        statement: primaryStatement,
        supportingText: supporting,
        categoryLabel: "💡 PERTANYAAN PEMANTIK",
        slideNumber: slides.length + 1,
        totalSlides: slides.length + 1,
      };
      pushSlide(hookSlide);
      lastSlideType = "HOOK_STATEMENT";
      continue;
    }

    // Role: SPLIT / COMPARISON
    if (sec.type === "SPLIT") {
      const half = Math.ceil(bulletItems.length / 2);
      const leftItems = bulletItems.slice(0, half).map((b) => b.text);
      const rightItems = bulletItems.slice(half).map((b) => b.text);

      const splitSlide: SplitColumnSlide = {
        id: `slide-split-${sIdx}`,
        type: "SPLIT_COLUMN",
        title: sec.heading,
        leftColumnTitle: "Karakteristik & Poin A",
        leftColumnItems: leftItems.length > 0 ? leftItems : ["Analisis Aspek 1"],
        rightColumnTitle: "Karakteristik & Poin B",
        rightColumnItems: rightItems.length > 0 ? rightItems : ["Analisis Aspek 2"],
        categoryLabel: "⚖️ PERBANDINGAN & ANALISIS",
        slideNumber: slides.length + 1,
        totalSlides: slides.length + 1,
      };
      pushSlide(splitSlide);
      lastSlideType = "SPLIT_COLUMN";
      continue;
    }

    // Role: CARDS
    if (sec.type === "CARDS") {
      const cardList = bulletItems.map((b) => {
        // Check if text has title prefix like "Pilar 1: Deskripsi"
        const parts = b.text.split(/:\s*(.+)/);
        if (parts.length > 1) {
          return { title: parts[0].trim(), text: parts[1].trim() };
        }
        return { text: b.text };
      });

      const cardsSlide: CardsGridSlide = {
        id: `slide-cards-${sIdx}`,
        type: "CARDS_GRID",
        title: sec.heading,
        cards: cardList.slice(0, 4),
        categoryLabel: "🏛️ PILAR & ASPEK UTAMA",
        slideNumber: slides.length + 1,
        totalSlides: slides.length + 1,
      };
      pushSlide(cardsSlide);
      lastSlideType = "CARDS_GRID";
      continue;
    }

    // Role: STORY / CONCEPT
    if (sec.type === "STORY") {
      const core =
        sec.rawParagraphs[0] ||
        (bulletItems.length > 0 ? bulletItems[0].text : "Kisah & Pembelajaran Utama");
      const points =
        bulletItems.length > 1
          ? bulletItems.slice(1).map((b) => b.text)
          : sec.rawParagraphs.slice(1);

      const storySlide: StoryConceptSlide = {
        id: `slide-story-${sIdx}`,
        type: "STORY_CONCEPT",
        title: sec.heading,
        coreMessage: core,
        supportingPoints: points.length > 0 ? points : [core],
        categoryLabel: "📖 KISAH & HIKMAH",
        slideNumber: slides.length + 1,
        totalSlides: slides.length + 1,
      };
      pushSlide(storySlide);
      lastSlideType = "STORY_CONCEPT";
      continue;
    }

    // Role: OBJECTIVES
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
          categoryLabel: "🎯 CAPAIAN PEMBELAJARAN",
          objectives: chunk,
          slideNumber: slides.length + 1,
          totalSlides: slides.length + 1,
        };
        pushSlide(objSlide);
      });
      lastSlideType = "OBJECTIVES";
      continue;
    }

    // Role: QUIZ or REFLECTION
    if (sec.type === "QUIZ" || sec.type === "REFLECTION") {
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
        pushSlide(quizSlide);
      });
      lastSlideType = "REFLECTION_OR_QUIZ";
      continue;
    }

    // Role: TAKEAWAY
    if (sec.type === "TAKEAWAY") {
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
        pushSlide(takeawaySlide);
      });
      lastSlideType = "TAKEAWAY";
      continue;
    }

    // Default CONTENT Section
    // If consecutive slides were standard CONTENT and items clearly have title headers ("Pilar 1: ..."), adapt into Cards
    const allHaveTitleColons = bulletItems.length === 3 && bulletItems.every((b) => b.text.includes(":"));
    if (lastSlideType === "CONTENT" && allHaveTitleColons) {
      const cardList = bulletItems.map((b) => {
        const parts = b.text.split(/:\s*(.+)/);
        return { title: parts[0].trim(), text: parts[1].trim() };
      });

      const cardsSlide: CardsGridSlide = {
        id: `slide-cards-${sIdx}`,
        type: "CARDS_GRID",
        title: sec.heading,
        cards: cardList,
        categoryLabel: "📌 POKOK BAHASAN",
        slideNumber: slides.length + 1,
        totalSlides: slides.length + 1,
      };
      pushSlide(cardsSlide);
      lastSlideType = "CARDS_GRID";
      continue;
    }

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
      pushSlide(contentSlide);
    });
    lastSlideType = "CONTENT";
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
