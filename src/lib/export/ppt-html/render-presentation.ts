/**
 * TEACHER OS — AI STUDIO EXPORT V3
 * Presentation PPTX Builder (Subject-Adaptive Visual Renderer)
 *
 * Pipeline: PresentationModel → per-slide HTML (theme-aware) → PNG (2x)
 *           → PPTX with full-bleed slide images + real speaker notes.
 */

import { PresentationModel, PresentationSlide } from "../ppt/ppt-types";
import { resolveSubjectTheme } from "./theme";
import { renderSlideToHtml } from "./slide-html";
import { renderHtmlToPngDataUrl } from "./html-to-image";

/**
 * Resolves a slide's visual prompt into a PNG data URL (or empty string when
 * image generation is disabled/unavailable). Wired from the client via a
 * server action so this library stays environment-agnostic.
 */
export type IllustrationResolver = (
  visualPrompt: string,
  subjectName?: string
) => Promise<string | null>;

/** Only key slide types are worth an AI illustration (cost & latency control). */
const KEY_VISUAL_SLIDE_TYPES = new Set<PresentationSlide["type"]>([
  "CONTENT",
  "STORY_CONCEPT",
]);

/** Renders the full presentation and triggers a .pptx download. */
export async function renderPresentationPptxVisual(
  model: PresentationModel,
  outputFilename?: string,
  illustrationResolver?: IllustrationResolver
): Promise<void> {
  const theme = resolveSubjectTheme(model.metadata.subjectName);

  // Dynamic import to prevent bundle pollution on initial route load
  const pptxgenModule = await import("pptxgenjs");
  const PptxGenJSClass = pptxgenModule.default;

  const pres = new PptxGenJSClass();
  pres.layout = "LAYOUT_16x9";
  pres.author = model.metadata.teacherName || "Guru Pengampu";
  pres.company = model.metadata.schoolName || "Teacher OS";
  pres.title = model.metadata.title;

  // Cache illustrations by prompt to avoid duplicate generations.
  const illustrationCache = new Map<string, string>();

  for (const slide of model.slides) {
    let visualImage: string | undefined;
    if (
      illustrationResolver &&
      slide.visualPrompt &&
      KEY_VISUAL_SLIDE_TYPES.has(slide.type)
    ) {
      const cacheKey = slide.visualPrompt;
      let image = illustrationCache.get(cacheKey);
      if (image === undefined) {
        try {
          image = (await illustrationResolver(slide.visualPrompt, model.metadata.subjectName)) ?? "";
        } catch {
          image = "";
        }
        illustrationCache.set(cacheKey, image);
      }
      visualImage = image || undefined;
    }

    const slideHtml = renderSlideToHtml(slide, theme, model.metadata, visualImage);
    const pngDataUrl = await renderHtmlToPngDataUrl(slideHtml);

    const s = pres.addSlide();
    s.background = { color: theme.bg1 };
    s.addImage({ data: pngDataUrl, x: 0, y: 0, w: 10, h: 5.625 });

    if (slide.speakerNotes && slide.speakerNotes.trim()) {
      s.addNotes(slide.speakerNotes.trim());
    }
  }

  const safeFilename =
    outputFilename ||
    `${model.metadata.title.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F]/g, "_")}.pptx`;

  await pres.writeFile({ fileName: safeFilename });
}
