/**
 * TEACHER OS — AI STUDIO EXPORT V2 (PHASE A)
 * PowerPoint PPTX Renderer using PptxGenJS (Dynamic Import)
 * 
 * Generates 16:9 widescreen presentations with calm teacher-first styling.
 */

import type PptxGenJS from "pptxgenjs";
import {
  PresentationModel,
  CoverSlide,
  ObjectivesSlide,
  ContentSlide,
  TakeawaySlide,
  ReflectionOrQuizSlide,
  PPT_LAYOUT_CONSTANTS,
} from "./ppt-types";

// Design Palette
const PALETTE = {
  bgSlide: "F8FAFC",       // Soft Slate 50
  cardBg: "FFFFFF",        // Pure White
  cardBorder: "E2E8F0",    // Slate 200
  
  textPrimary: "0F172A",   // Slate 900
  textSecondary: "475569", // Slate 600
  textMuted: "94A3B8",     // Slate 400
  textWhite: "FFFFFF",
  
  primaryBrand: "2563EB",  // Blue 600
  primaryDark: "1E293B",   // Slate 800
  emeraldAccent: "059669", // Emerald 600
  amberAccent: "D97706",   // Amber 600
  indigoAccent: "4F46E5",  // Indigo 600
};

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
  pres.author = model.metadata.teacherName || "Guru";
  pres.company = model.metadata.schoolName || "Sekolah";
  pres.title = model.metadata.title;

  for (const slideData of model.slides) {
    switch (slideData.type) {
      case "COVER":
        renderCoverSlide(pres, slideData);
        break;
      case "OBJECTIVES":
        renderObjectivesSlide(pres, slideData, model);
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
// SLIDE RENDERERS
// ----------------------------------------------------------------------------

function renderCoverSlide(pres: PptxGenJS, slide: CoverSlide) {
  const s = pres.addSlide();
  s.background = { color: PALETTE.primaryDark };

  // Decorative Accent bar on left
  s.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.35,
    h: PPT_LAYOUT_CONSTANTS.SLIDE_HEIGHT_INCHES,
    fill: { color: PALETTE.primaryBrand },
  });

  // Badge / Tag
  s.addText("MODUL AJAR & MATERI PRESENTASI", {
    x: 0.9,
    y: 1.0,
    w: 8.2,
    h: 0.35,
    fontSize: 11,
    bold: true,
    color: "93C5FD", // Light Blue
    fontFace: "Arial",
  });

  // Main Title
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
    fontFace: "Arial",
    wrap: true,
  });

  // Optional Topic Subtitle
  if (slide.topic && slide.topic !== slide.title) {
    s.addText(slide.topic, {
      x: 0.9,
      y: 3.2,
      w: 8.4,
      h: 0.6,
      fontSize: 16,
      color: "CBD5E1",
      fontFace: "Arial",
      wrap: true,
    });
  }

  // Metadata Footer
  const metaParts: string[] = [];
  if (slide.schoolName) metaParts.push(slide.schoolName);
  if (slide.subjectName) metaParts.push(`Mata Pelajaran: ${slide.subjectName}`);
  if (slide.className) metaParts.push(`Kelas: ${slide.className}`);
  if (slide.teacherName) metaParts.push(`Pendidik: ${slide.teacherName}`);
  if (slide.dateFormatted) metaParts.push(slide.dateFormatted);

  if (metaParts.length > 0) {
    // Divider line
    s.addShape(pres.ShapeType.line, {
      x: 0.9,
      y: 4.3,
      w: 8.2,
      h: 0,
      line: { color: "334155", width: 1 },
    });

    s.addText(metaParts.join("   •   "), {
      x: 0.9,
      y: 4.45,
      w: 8.2,
      h: 0.5,
      fontSize: 11,
      color: PALETTE.textMuted,
      fontFace: "Arial",
    });
  }
}

function renderHeaderBanner(
  pres: PptxGenJS,
  slideObj: PptxGenJS.Slide,
  title: string,
  accentColor: string
) {
  // Top Banner Rect
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
    y: 0.15,
    w: 8.8,
    h: 0.6,
    fontSize: PPT_LAYOUT_CONSTANTS.TITLE_FONT_PT,
    bold: true,
    color: PALETTE.textWhite,
    fontFace: "Arial",
    valign: "middle",
  });
}

function renderSlideFooter(
  pres: PptxGenJS,
  slideObj: PptxGenJS.Slide,
  slide: { slideNumber: number; totalSlides: number },
  model: PresentationModel
) {
  const school = model.metadata.schoolName || model.metadata.subjectName || "AI Teacher Assistant";
  slideObj.addText(school, {
    x: 0.6,
    y: 5.15,
    w: 6.0,
    h: 0.35,
    fontSize: 9,
    color: PALETTE.textMuted,
    fontFace: "Arial",
  });

  slideObj.addText(`${slide.slideNumber} / ${slide.totalSlides}`, {
    x: 7.0,
    y: 5.15,
    w: 2.4,
    h: 0.35,
    fontSize: 9,
    color: PALETTE.textMuted,
    align: "right",
    fontFace: "Arial",
  });
}

function renderObjectivesSlide(
  pres: PptxGenJS,
  slide: ObjectivesSlide,
  model: PresentationModel
) {
  const s = pres.addSlide();
  s.background = { color: PALETTE.bgSlide };

  renderHeaderBanner(pres, s, slide.title, PALETTE.emeraldAccent);

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

  const textObjects: PptxGenJS.TextProps[] = [];
  slide.objectives.forEach((objText) => {
    textObjects.push({
      text: `🎯  ${objText}`,
      options: {
        fontSize: 15,
        color: PALETTE.textPrimary,
        fontFace: "Arial",
        bold: false,
        breakLine: true,
        paraSpaceAfter: 14,
      },
    });
  });

  s.addText(textObjects, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES + 0.35,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES + 0.3,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES - 0.7,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES - 0.6,
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

  renderHeaderBanner(pres, s, slide.title, PALETTE.primaryBrand);

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

  const textObjects: PptxGenJS.TextProps[] = [];

  for (const item of slide.items) {
    textObjects.push({
      text: item.text,
      options: {
        fontSize: PPT_LAYOUT_CONSTANTS.MIN_BODY_FONT_PT,
        color: PALETTE.textPrimary,
        fontFace: "Arial",
        bullet: true,
        breakLine: true,
        paraSpaceAfter: item.subpoints && item.subpoints.length > 0 ? 6 : 10,
      },
    });

    if (item.subpoints && item.subpoints.length > 0) {
      for (const sub of item.subpoints) {
        textObjects.push({
          text: sub,
          options: {
            fontSize: PPT_LAYOUT_CONSTANTS.SUBPOINT_FONT_PT,
            color: PALETTE.textSecondary,
            fontFace: "Arial",
            indentLevel: 1,
            bullet: { code: "2013" }, // En-dash bullet for subpoints
            breakLine: true,
            paraSpaceAfter: 6,
          },
        });
      }
    }
  }

  s.addText(textObjects, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES + 0.35,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES + 0.25,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES - 0.7,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES - 0.5,
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

  renderHeaderBanner(pres, s, slide.title, PALETTE.amberAccent);

  s.addShape(pres.ShapeType.roundRect, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES,
    fill: { color: PALETTE.cardBg },
    line: { color: PALETTE.cardBorder, width: 1 },
    rectRadius: 0.08,
  });

  const textObjects: PptxGenJS.TextProps[] = [];
  slide.takeaways.forEach((point) => {
    textObjects.push({
      text: `💡  ${point}`,
      options: {
        fontSize: 15,
        color: PALETTE.textPrimary,
        fontFace: "Arial",
        breakLine: true,
        paraSpaceAfter: 12,
      },
    });
  });

  s.addText(textObjects, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES + 0.35,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES + 0.3,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES - 0.7,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES - 0.6,
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

  renderHeaderBanner(pres, s, slide.title, PALETTE.indigoAccent);

  s.addShape(pres.ShapeType.roundRect, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES,
    fill: { color: PALETTE.cardBg },
    line: { color: PALETTE.cardBorder, width: 1 },
    rectRadius: 0.08,
  });

  const textObjects: PptxGenJS.TextProps[] = [];
  const icon = slide.isQuiz ? "📝" : "🤔";

  slide.questions.forEach((q, idx) => {
    textObjects.push({
      text: `${icon}  ${idx + 1}. ${q}`,
      options: {
        fontSize: 15,
        color: PALETTE.textPrimary,
        fontFace: "Arial",
        breakLine: true,
        paraSpaceAfter: 12,
      },
    });
  });

  s.addText(textObjects, {
    x: PPT_LAYOUT_CONSTANTS.CONTENT_X_INCHES + 0.35,
    y: PPT_LAYOUT_CONSTANTS.CONTENT_Y_INCHES + 0.3,
    w: PPT_LAYOUT_CONSTANTS.CONTENT_WIDTH_INCHES - 0.7,
    h: PPT_LAYOUT_CONSTANTS.CONTENT_HEIGHT_INCHES - 0.6,
    valign: "top",
    wrap: true,
  });

  renderSlideFooter(pres, s, slide, model);
}
