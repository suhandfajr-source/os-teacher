/**
 * TEACHER OS — AI STUDIO EXPORT V2 (PHASE A)
 * PowerPoint PPTX Renderer using PptxGenJS (Dynamic Import)
 * 
 * Generates 16:9 widescreen presentations with premium teacher-first styling,
 * modern typography, polished cards, and native slide transition animations.
 */

import type PptxGenJS from "pptxgenjs";
import {
  PresentationModel,
  CoverSlide,
  ObjectivesSlide,
  ContentSlide,
  TakeawaySlide,
  ReflectionOrQuizSlide,
  HookStatementSlide,
  SplitColumnSlide,
  CardsGridSlide,
  StoryConceptSlide,
  PPT_LAYOUT_CONSTANTS,
} from "./ppt-types";

// Premium Adaptive PPT Design Palette
const PALETTE = {
  bgSlide: "F8FAFC",       // Soft Slate 50
  cardBg: "FFFFFF",        // Pure White
  cardBorder: "CBD5E1",    // Slate 300
  cardBorderLight: "F1F5F9",
  
  textPrimary: "0F172A",   // Slate 900 (High contrast)
  textSecondary: "334155", // Slate 700
  textMuted: "64748B",     // Slate 500
  textWhite: "FFFFFF",
  
  primaryBrand: "2563EB",  // Royal Blue 600
  primaryDark: "0F172A",   // Deep Slate 900
  primaryHeader: "1E3A8A", // Navy 900
  
  emeraldAccent: "059669", // Emerald 600
  emeraldBg: "F0FDF4",     // Emerald 50
  
  amberAccent: "D97706",   // Amber 600
  amberBg: "FFFBEB",       // Amber 50
  
  indigoAccent: "4F46E5",  // Indigo 600
  indigoBg: "EEF2FF",      // Indigo 50
  
  purpleAccent: "7C3AED",  // Purple 600
  purpleBg: "FAF5FF",      // Purple 50
};

const FONT_HEADING = "Segoe UI";
const FONT_BODY = "Segoe UI";

/**
 * Dynamically renders a PresentationModel into a .pptx file download using PptxGenJS
 */
export async function renderPresentationPptx(
  model: PresentationModel,
  outputFilename?: string
): Promise<void> {
  // Dynamically import pptxgenjs to prevent bundle pollution on initial route load
  const pptxgenModule = await import("pptxgenjs");
  const PptxGenJSClass = pptxgenModule.default;

  const pres = new PptxGenJSClass();
  pres.layout = "LAYOUT_16x9";
  pres.author = model.metadata.teacherName || "Guru Pengampu";
  pres.company = model.metadata.schoolName || "KLASSA";
  pres.title = model.metadata.title;

  for (const slideData of model.slides) {
    switch (slideData.type) {
      case "COVER":
        renderCoverSlide(pres, slideData);
        break;
      case "OBJECTIVES":
        renderObjectivesSlide(pres, slideData, model);
        break;
      case "HOOK_STATEMENT":
        renderHookStatementSlide(pres, slideData, model);
        break;
      case "SPLIT_COLUMN":
        renderSplitColumnSlide(pres, slideData, model);
        break;
      case "CARDS_GRID":
        renderCardsGridSlide(pres, slideData, model);
        break;
      case "STORY_CONCEPT":
        renderStoryConceptSlide(pres, slideData, model);
        break;
      case "CONTENT":
        renderContentSlide(pres, slideData, model);
        break;
      case "TAKEAWAY":
        renderTakeawaySlide(pres, slideData, model);
        break;
      case "REFLECTION_OR_QUIZ":
        renderReflectionOrQuizSlide(pres, slideData, model);
        break;
    }
  }

  const safeFilename =
    outputFilename ||
    `${model.metadata.title.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F]/g, "_")}.pptx`;

  await pres.writeFile({ fileName: safeFilename });
}

// ----------------------------------------------------------------------------
// ADAPTIVE PPT SLIDE RENDERERS
// ----------------------------------------------------------------------------

function renderCoverSlide(pres: PptxGenJS, slide: CoverSlide) {
  const s = pres.addSlide();
  s.background = { color: PALETTE.primaryDark };

  // Native Slide Transition (Smooth Elegant Fade)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).transition = { type: "fade", speed: "medium" };

  // Top-Right Geometric Decorative Accent Card
  s.addShape(pres.ShapeType.roundRect, {
    x: 6.8,
    y: -0.5,
    w: 4.0,
    h: 3.2,
    fill: { color: "1E293B" },
    line: { color: "334155", width: 1 },
    rectRadius: 0.15,
  });

  // Left Royal Blue Stripe
  s.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.35,
    h: PPT_LAYOUT_CONSTANTS.SLIDE_HEIGHT_INCHES,
    fill: { color: PALETTE.primaryBrand },
  });

  // Category Tag / Pill Badge
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.9,
    y: 0.85,
    w: 3.2,
    h: 0.42,
    fill: { color: "1E293B" },
    line: { color: PALETTE.primaryBrand, width: 1.5 },
    rectRadius: 0.2,
  });

  s.addText("✨  MODUL AJAR & MATERI TAYANG", {
    x: 0.95,
    y: 0.85,
    w: 3.1,
    h: 0.42,
    fontSize: 10,
    bold: true,
    color: "93C5FD",
    fontFace: FONT_HEADING,
    valign: "middle",
    align: "center",
  });

  // Main Cover Title
  s.addText(slide.title, {
    x: 0.9,
    y: 1.45,
    w: 8.4,
    h: 1.8,
    fontSize: PPT_LAYOUT_CONSTANTS.COVER_TITLE_FONT_PT,
    bold: true,
    color: PALETTE.textWhite,
    align: "left",
    valign: "top",
    fontFace: FONT_HEADING,
    wrap: true,
  });

  // Optional Topic Subtitle
  if (slide.topic && slide.topic !== slide.title) {
    s.addText(slide.topic, {
      x: 0.9,
      y: 3.25,
      w: 8.4,
      h: 0.55,
      fontSize: 16,
      color: "94A3B8",
      fontFace: FONT_BODY,
      wrap: true,
    });
  }

  // Floating Metadata Container Card at Bottom
  const metaParts: string[] = [];
  if (slide.subjectName) metaParts.push(`📚 ${slide.subjectName}`);
  if (slide.className) metaParts.push(`🏷️ Kelas ${slide.className}`);
  if (slide.teacherName) metaParts.push(`👤 ${slide.teacherName}`);
  if (slide.schoolName) metaParts.push(`🏫 ${slide.schoolName}`);
  if (slide.dateFormatted) metaParts.push(`🗓️ ${slide.dateFormatted}`);

  if (metaParts.length > 0) {
    s.addShape(pres.ShapeType.roundRect, {
      x: 0.9,
      y: 4.15,
      w: 8.4,
      h: 0.85,
      fill: { color: "1E293B" },
      line: { color: "334155", width: 1 },
      rectRadius: 0.08,
    });

    s.addText(metaParts.join("    •    "), {
      x: 1.1,
      y: 4.15,
      w: 8.0,
      h: 0.85,
      fontSize: 11,
      color: PALETTE.textWhite,
      fontFace: FONT_BODY,
      valign: "middle",
      wrap: true,
    });
  }
}

function renderHeaderBanner(
  pres: PptxGenJS,
  slideObj: PptxGenJS.Slide,
  title: string,
  accentColor: string = PALETTE.primaryBrand,
  badgeText: string = "MATERI PEMBELAJARAN"
) {
  // Top Solid Accent Banner
  slideObj.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: PPT_LAYOUT_CONSTANTS.SLIDE_WIDTH_INCHES,
    h: 0.9,
    fill: { color: accentColor },
  });

  // Slide Title
  slideObj.addText(title, {
    x: 0.6,
    y: 0.12,
    w: 6.8,
    h: 0.66,
    fontSize: PPT_LAYOUT_CONSTANTS.TITLE_FONT_PT,
    bold: true,
    color: PALETTE.textWhite,
    fontFace: FONT_HEADING,
    valign: "middle",
  });

  // Top-Right Section Pill Tag
  slideObj.addShape(pres.ShapeType.roundRect, {
    x: 7.6,
    y: 0.25,
    w: 1.8,
    h: 0.38,
    fill: { color: "000000" },
    rectRadius: 0.2,
  });

  slideObj.addText(badgeText, {
    x: 7.6,
    y: 0.25,
    w: 1.8,
    h: 0.38,
    fontSize: 9,
    bold: true,
    color: PALETTE.textWhite,
    fontFace: FONT_HEADING,
    align: "center",
    valign: "middle",
  });
}

function renderSlideFooter(
  pres: PptxGenJS,
  slideObj: PptxGenJS.Slide,
  slide: { slideNumber: number; totalSlides: number },
  model: PresentationModel
) {
  const school = model.metadata.schoolName || model.metadata.subjectName || "KLASSA Presentation Studio";
  
  // Footer divider line
  slideObj.addShape(pres.ShapeType.line, {
    x: 0.6,
    y: 5.1,
    w: 8.8,
    h: 0,
    line: { color: "E2E8F0", width: 1 },
  });

  slideObj.addText(school, {
    x: 0.6,
    y: 5.15,
    w: 6.0,
    h: 0.35,
    fontSize: 9,
    color: PALETTE.textMuted,
    fontFace: FONT_BODY,
  });

  slideObj.addText(`Slide ${slide.slideNumber} dari ${slide.totalSlides}`, {
    x: 7.0,
    y: 5.15,
    w: 2.4,
    h: 0.35,
    fontSize: 9,
    color: PALETTE.textMuted,
    align: "right",
    fontFace: FONT_BODY,
  });
}

function renderObjectivesSlide(
  pres: PptxGenJS,
  slide: ObjectivesSlide,
  model: PresentationModel
) {
  const s = pres.addSlide();
  s.background = { color: PALETTE.bgSlide };

  // Native Slide Transition (Push Left)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).transition = { type: "push", dir: "l", speed: "fast" };

  renderHeaderBanner(pres, s, slide.title, PALETTE.emeraldAccent, "🎯 TUJUAN BELAJAR");

  // Content Card Container
  s.addShape(pres.ShapeType.roundRect, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES,
    fill: { color: PALETTE.cardBg },
    line: { color: PALETTE.cardBorder, width: 1 },
    rectRadius: 0.08,
  });

  // Left vertical accent bar on card
  s.addShape(pres.ShapeType.rect, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES,
    w: 0.12,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES,
    fill: { color: PALETTE.emeraldAccent },
  });

  const textObjects: PptxGenJS.TextProps[] = [];
  slide.objectives.forEach((objText, idx) => {
    textObjects.push({
      text: `${idx + 1}.  ${objText}`,
      options: {
        fontSize: 15,
        color: PALETTE.textPrimary,
        fontFace: FONT_BODY,
        bold: false,
        breakLine: true,
        paraSpaceAfter: 14,
      },
    });
  });

  s.addText(textObjects, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES + 0.45,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES + 0.35,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES - 0.8,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES - 0.7,
    valign: "top",
    wrap: true,
  });

  renderSlideFooter(pres, s, slide, model);
}

function renderContentSlide(
  pres: PptxGenJS,
  slide: ContentSlide,
  model: PresentationModel
) {
  const s = pres.addSlide();
  s.background = { color: PALETTE.bgSlide };

  // Native Slide Transition (Push Left)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).transition = { type: "push", dir: "l", speed: "fast" };

  renderHeaderBanner(pres, s, slide.title, PALETTE.primaryBrand, "📌 POKOK BAHASAN");

  // Main Card Container
  s.addShape(pres.ShapeType.roundRect, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES,
    fill: { color: PALETTE.cardBg },
    line: { color: PALETTE.cardBorder, width: 1 },
    rectRadius: 0.08,
  });

  // Left vertical accent bar on card
  s.addShape(pres.ShapeType.rect, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES,
    w: 0.12,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES,
    fill: { color: PALETTE.primaryBrand },
  });

  const textObjects: PptxGenJS.TextProps[] = [];

  for (const item of slide.items) {
    textObjects.push({
      text: item.text,
      options: {
        fontSize: PPT_LAYOUT_CONSTANTS.MIN_BODY_FONT_PT,
        color: PALETTE.textPrimary,
        fontFace: FONT_BODY,
        bullet: true,
        breakLine: true,
        paraSpaceAfter: item.subpoints && item.subpoints.length > 0 ? 6 : 12,
      },
    });

    if (item.subpoints && item.subpoints.length > 0) {
      for (const sub of item.subpoints) {
        textObjects.push({
          text: sub,
          options: {
            fontSize: PPT_LAYOUT_CONSTANTS.SUBPOINT_FONT_PT,
            color: PALETTE.textSecondary,
            fontFace: FONT_BODY,
            indentLevel: 1,
            bullet: { code: "2013" },
            breakLine: true,
            paraSpaceAfter: 6,
          },
        });
      }
    }
  }

  s.addText(textObjects, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES + 0.45,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES + 0.3,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES - 0.8,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES - 0.6,
    valign: "top",
    wrap: true,
  });

  renderSlideFooter(pres, s, slide, model);
}

function renderTakeawaySlide(
  pres: PptxGenJS,
  slide: TakeawaySlide,
  model: PresentationModel
) {
  const s = pres.addSlide();
  s.background = { color: PALETTE.bgSlide };

  // Native Slide Transition (Wipe Effect)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).transition = { type: "wipe", speed: "medium" };

  renderHeaderBanner(pres, s, slide.title, PALETTE.indigoAccent, "✨ RANGKUMAN INTI");

  s.addShape(pres.ShapeType.roundRect, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES,
    fill: { color: PALETTE.indigoBg },
    line: { color: "C7D2FE", width: 1 },
    rectRadius: 0.08,
  });

  // Left vertical accent bar on card
  s.addShape(pres.ShapeType.rect, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES,
    w: 0.12,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES,
    fill: { color: PALETTE.indigoAccent },
  });

  const textObjects: PptxGenJS.TextProps[] = [];
  slide.takeaways.forEach((point) => {
    textObjects.push({
      text: `✨  ${point}`,
      options: {
        fontSize: 15,
        color: PALETTE.textPrimary,
        fontFace: FONT_BODY,
        breakLine: true,
        paraSpaceAfter: 14,
      },
    });
  });

  s.addText(textObjects, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES + 0.45,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES + 0.35,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES - 0.8,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES - 0.7,
    valign: "top",
    wrap: true,
  });

  renderSlideFooter(pres, s, slide, model);
}

function renderReflectionOrQuizSlide(
  pres: PptxGenJS,
  slide: ReflectionOrQuizSlide,
  model: PresentationModel
) {
  const s = pres.addSlide();
  s.background = { color: PALETTE.bgSlide };

  // Native Slide Transition (Split Effect)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).transition = { type: "split", speed: "medium" };

  const isQuiz = slide.isQuiz;
  const accentColor = isQuiz ? PALETTE.purpleAccent : PALETTE.amberAccent;
  const badgeText = isQuiz ? "📝 KUIS CEPAT" : "🤔 REFLEKSI BELAJAR";
  renderHeaderBanner(pres, s, slide.title, accentColor, badgeText);

  s.addShape(pres.ShapeType.roundRect, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES,
    fill: { color: PALETTE.cardBg },
    line: { color: PALETTE.cardBorder, width: 1 },
    rectRadius: 0.08,
  });

  // Left vertical accent bar on card
  s.addShape(pres.ShapeType.rect, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES,
    w: 0.12,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES,
    fill: { color: accentColor },
  });

  const textObjects: PptxGenJS.TextProps[] = [];
  const icon = isQuiz ? "❓" : "💡";

  slide.questions.forEach((q, idx) => {
    textObjects.push({
      text: `${icon}  ${idx + 1}. ${q}`,
      options: {
        fontSize: 15,
        color: PALETTE.textPrimary,
        fontFace: FONT_BODY,
        breakLine: true,
        paraSpaceAfter: 14,
      },
    });
  });

  s.addText(textObjects, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES + 0.45,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES + 0.35,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES - 0.8,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES - 0.7,
    valign: "top",
    wrap: true,
  });

  renderSlideFooter(pres, s, slide, model);
}

function renderHookStatementSlide(
  pres: PptxGenJS,
  slide: HookStatementSlide,
  model: PresentationModel
) {
  const s = pres.addSlide();
  s.background = { color: PALETTE.primaryDark };

  // Native Slide Transition (Fade)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).transition = { type: "fade", speed: "medium" };

  renderHeaderBanner(pres, s, slide.title, PALETTE.primaryDark, slide.categoryLabel || "💡 PEMANTIK");

  // Center Focus Card
  s.addShape(pres.ShapeType.roundRect, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES,
    fill: { color: "1E293B" },
    line: { color: "334155", width: 1 },
    rectRadius: 0.1,
  });

  // Left vertical accent bar in Amber
  s.addShape(pres.ShapeType.rect, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES,
    w: 0.15,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES,
    fill: { color: PALETTE.amberAccent },
  });

  // Big Prominent Statement
  s.addText(`“ ${slide.statement} ”`, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES + 0.6,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES + 0.5,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES - 1.2,
    h: 1.8,
    fontSize: 20,
    bold: true,
    color: PALETTE.textWhite,
    fontFace: FONT_HEADING,
    valign: "middle",
    align: "center",
    wrap: true,
  });

  // Supporting Text
  if (slide.supportingText) {
    s.addText(slide.supportingText, {
      x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES + 0.6,
      y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES + 2.4,
      w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES - 1.2,
      h: 0.9,
      fontSize: 14,
      color: "94A3B8",
      fontFace: FONT_BODY,
      valign: "top",
      align: "center",
      wrap: true,
    });
  }

  renderSlideFooter(pres, s, slide, model);
}

function renderSplitColumnSlide(
  pres: PptxGenJS,
  slide: SplitColumnSlide,
  model: PresentationModel
) {
  const s = pres.addSlide();
  s.background = { color: PALETTE.bgSlide };

  // Native Slide Transition (Push Left)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).transition = { type: "push", dir: "l", speed: "fast" };

  renderHeaderBanner(pres, s, slide.title, PALETTE.primaryBrand, slide.categoryLabel || "⚖️ PERBANDINGAN");

  const colWidth = 4.2;
  const colHeight = PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES;
  const leftX = PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES;
  const rightX = leftX + colWidth + 0.4;
  const colY = PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES;

  // Left Column Card
  s.addShape(pres.ShapeType.roundRect, {
    x: leftX,
    y: colY,
    w: colWidth,
    h: colHeight,
    fill: { color: PALETTE.cardBg },
    line: { color: "CBD5E1", width: 1 },
    rectRadius: 0.08,
  });

  // Left Column Header Stripe
  s.addShape(pres.ShapeType.roundRect, {
    x: leftX,
    y: colY,
    w: colWidth,
    h: 0.5,
    fill: { color: "EFF6FF" },
    line: { color: "CBD5E1", width: 0 },
    rectRadius: 0.08,
  });

  s.addText(slide.leftColumnTitle, {
    x: leftX + 0.2,
    y: colY + 0.05,
    w: colWidth - 0.4,
    h: 0.4,
    fontSize: 13,
    bold: true,
    color: PALETTE.primaryBrand,
    fontFace: FONT_HEADING,
    valign: "middle",
  });

  const leftTextObjects: PptxGenJS.TextProps[] = [];
  slide.leftColumnItems.forEach((it) => {
    leftTextObjects.push({
      text: it,
      options: {
        fontSize: 13,
        color: PALETTE.textPrimary,
        fontFace: FONT_BODY,
        bullet: true,
        breakLine: true,
        paraSpaceAfter: 10,
      },
    });
  });

  s.addText(leftTextObjects, {
    x: leftX + 0.3,
    y: colY + 0.65,
    w: colWidth - 0.6,
    h: colHeight - 0.8,
    valign: "top",
    wrap: true,
  });

  // Right Column Card
  s.addShape(pres.ShapeType.roundRect, {
    x: rightX,
    y: colY,
    w: colWidth,
    h: colHeight,
    fill: { color: PALETTE.cardBg },
    line: { color: "CBD5E1", width: 1 },
    rectRadius: 0.08,
  });

  // Right Column Header Stripe
  s.addShape(pres.ShapeType.roundRect, {
    x: rightX,
    y: colY,
    w: colWidth,
    h: 0.5,
    fill: { color: "F0FDF4" },
    line: { color: "CBD5E1", width: 0 },
    rectRadius: 0.08,
  });

  s.addText(slide.rightColumnTitle, {
    x: rightX + 0.2,
    y: colY + 0.05,
    w: colWidth - 0.4,
    h: 0.4,
    fontSize: 13,
    bold: true,
    color: PALETTE.emeraldAccent,
    fontFace: FONT_HEADING,
    valign: "middle",
  });

  const rightTextObjects: PptxGenJS.TextProps[] = [];
  slide.rightColumnItems.forEach((it) => {
    rightTextObjects.push({
      text: it,
      options: {
        fontSize: 13,
        color: PALETTE.textPrimary,
        fontFace: FONT_BODY,
        bullet: true,
        breakLine: true,
        paraSpaceAfter: 10,
      },
    });
  });

  s.addText(rightTextObjects, {
    x: rightX + 0.3,
    y: colY + 0.65,
    w: colWidth - 0.6,
    h: colHeight - 0.8,
    valign: "top",
    wrap: true,
  });

  renderSlideFooter(pres, s, slide, model);
}

function renderCardsGridSlide(
  pres: PptxGenJS,
  slide: CardsGridSlide,
  model: PresentationModel
) {
  const s = pres.addSlide();
  s.background = { color: PALETTE.bgSlide };

  // Native Slide Transition (Wipe)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).transition = { type: "wipe", speed: "medium" };

  renderHeaderBanner(pres, s, slide.title, PALETTE.indigoAccent, slide.categoryLabel || "🏛️ PILAR UTAMA");

  const count = Math.min(slide.cards.length, 3);
  const totalWidth = PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES;
  const gap = 0.3;
  const cardW = (totalWidth - (count - 1) * gap) / count;
  const cardH = PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES;
  const startX = PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES;
  const cardY = PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES;

  const cardColors = [
    { border: "BFDBFE", top: PALETTE.primaryBrand, bg: "EFF6FF" },
    { border: "A7F3D0", top: PALETTE.emeraldAccent, bg: "ECFDF5" },
    { border: "DDD6FE", top: PALETTE.purpleAccent, bg: "F5F3FF" },
  ];

  slide.cards.slice(0, 3).forEach((card, idx) => {
    const curX = startX + idx * (cardW + gap);
    const color = cardColors[idx % cardColors.length];

    // Card Container
    s.addShape(pres.ShapeType.roundRect, {
      x: curX,
      y: cardY,
      w: cardW,
      h: cardH,
      fill: { color: PALETTE.cardBg },
      line: { color: color.border, width: 1 },
      rectRadius: 0.08,
    });

    // Top Header Accent Stripe
    s.addShape(pres.ShapeType.roundRect, {
      x: curX,
      y: cardY,
      w: cardW,
      h: 0.45,
      fill: { color: color.bg },
      line: { color: color.border, width: 0 },
      rectRadius: 0.08,
    });

    // Card Title
    const cardTitle = card.title || `Pilar ${idx + 1}`;
    s.addText(cardTitle, {
      x: curX + 0.15,
      y: cardY + 0.05,
      w: cardW - 0.3,
      h: 0.35,
      fontSize: 12,
      bold: true,
      color: color.top,
      fontFace: FONT_HEADING,
      valign: "middle",
    });

    // Card Body Text
    s.addText(card.text, {
      x: curX + 0.2,
      y: cardY + 0.6,
      w: cardW - 0.4,
      h: cardH - 0.8,
      fontSize: 13,
      color: PALETTE.textPrimary,
      fontFace: FONT_BODY,
      valign: "top",
      wrap: true,
    });
  });

  renderSlideFooter(pres, s, slide, model);
}

function renderStoryConceptSlide(
  pres: PptxGenJS,
  slide: StoryConceptSlide,
  model: PresentationModel
) {
  const s = pres.addSlide();
  s.background = { color: PALETTE.bgSlide };

  // Native Slide Transition (Fade)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).transition = { type: "fade", speed: "medium" };

  renderHeaderBanner(pres, s, slide.title, PALETTE.primaryBrand, slide.categoryLabel || "📖 KONSEP INTI");

  // Top Callout Box in Indigo Tint
  s.addShape(pres.ShapeType.roundRect, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES,
    h: 1.2,
    fill: { color: "EEF2FF" },
    line: { color: "C7D2FE", width: 1 },
    rectRadius: 0.08,
  });

  // Accent bar on Callout Box
  s.addShape(pres.ShapeType.rect, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES,
    w: 0.12,
    h: 1.2,
    fill: { color: PALETTE.indigoAccent },
  });

  s.addText(`💡 ${slide.coreMessage}`, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES + 0.3,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES + 0.1,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES - 0.6,
    h: 1.0,
    fontSize: 14,
    bold: true,
    color: PALETTE.indigoAccent,
    fontFace: FONT_HEADING,
    valign: "middle",
    wrap: true,
  });

  // Bottom Supporting Points Container Card
  const bottomY = PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES + 1.35;
  const bottomH = PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES - 1.35;

  s.addShape(pres.ShapeType.roundRect, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES,
    y: bottomY,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES,
    h: bottomH,
    fill: { color: PALETTE.cardBg },
    line: { color: PALETTE.cardBorder, width: 1 },
    rectRadius: 0.08,
  });

  const textObjects: PptxGenJS.TextProps[] = [];
  slide.supportingPoints.forEach((pt) => {
    textObjects.push({
      text: pt,
      options: {
        fontSize: 13,
        color: PALETTE.textPrimary,
        fontFace: FONT_BODY,
        bullet: true,
        breakLine: true,
        paraSpaceAfter: 10,
      },
    });
  });

  s.addText(textObjects, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES + 0.4,
    y: bottomY + 0.2,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES - 0.8,
    h: bottomH - 0.4,
    valign: "top",
    wrap: true,
  });

  renderSlideFooter(pres, s, slide, model);
}
