/**
 * TEACHER OS — AI STUDIO EXPORT V2 (PHASE A)
 * Presentation Model & Layout Constraints Definition
 */

export interface PresentationMetadata {
  title: string;
  schoolName?: string;
  subjectName?: string;
  teacherName?: string;
  className?: string;
  dateFormatted?: string;
}

export type SlideType =
  | "COVER"
  | "OBJECTIVES"
  | "CONTENT"
  | "TAKEAWAY"
  | "REFLECTION_OR_QUIZ";

export interface BulletItem {
  text: string;
  subpoints?: string[];
}

export interface BaseSlide {
  id: string;
  type: SlideType;
  title: string;
  slideNumber: number;
  totalSlides: number;
}

export interface CoverSlide extends BaseSlide {
  type: "COVER";
  topic?: string;
  schoolName?: string;
  subjectName?: string;
  teacherName?: string;
  className?: string;
  dateFormatted?: string;
}

export interface ObjectivesSlide extends BaseSlide {
  type: "OBJECTIVES";
  categoryLabel?: string;
  objectives: string[];
}

export interface ContentSlide extends BaseSlide {
  type: "CONTENT";
  sectionTitle?: string;
  partIndex?: number;
  totalParts?: number;
  items: BulletItem[];
  paragraphText?: string;
}

export interface TakeawaySlide extends BaseSlide {
  type: "TAKEAWAY";
  sectionTitle?: string;
  takeaways: string[];
}

export interface ReflectionOrQuizSlide extends BaseSlide {
  type: "REFLECTION_OR_QUIZ";
  sectionTitle?: string;
  isQuiz: boolean;
  questions: string[];
}

export type PresentationSlide =
  | CoverSlide
  | ObjectivesSlide
  | ContentSlide
  | TakeawaySlide
  | ReflectionOrQuizSlide;

export interface PresentationModel {
  metadata: PresentationMetadata;
  slides: PresentationSlide[];
}

// ----------------------------------------------------------------------------
// Deterministic Layout Constants
// ----------------------------------------------------------------------------

export const PPT_LAYOUT_CONSTANTS = {
  MAX_SOURCE_CHARACTERS: 50_000,
  MAX_PRESENTATION_SLIDES: 30,
  MIN_BODY_FONT_PT: 14,
  MAX_BODY_FONT_PT: 16,
  TITLE_FONT_PT: 22,
  COVER_TITLE_FONT_PT: 32,
  SUBPOINT_FONT_PT: 14,
  
  // Widescreen 16:9 dimensions in inches (standard PptxGenJS LAYOUT_16x9 = 10 x 5.625)
  SLIDE_WIDTH_INCHES: 10.0,
  SLIDE_HEIGHT_INCHES: 5.625,
  
  // Usable content area
  CONTENT_X_INCHES: 0.6,
  CONTENT_Y_INCHES: 1.15,
  CONTENT_WIDTH_INCHES: 8.8,
  CONTENT_HEIGHT_INCHES: 3.9,
  
  // Capacity estimation parameters
  MAX_LINES_PER_SLIDE: 8,
  CHARS_PER_LINE: 70,
  MAX_ITEMS_PER_SLIDE: 5,
} as const;

export interface LayoutConstraints {
  maxSourceCharacters: number;
  maxPresentationSlides: number;
  minBodyFontPt: number;
  maxBodyFontPt: number;
  titleFontPt: number;
  coverTitleFontPt: number;
  maxItemsPerSlide: number;
  maxLinesPerSlide: number;
  charsPerLine: number;
}

export const DEFAULT_LAYOUT_CONSTRAINTS: LayoutConstraints = {
  maxSourceCharacters: PPT_LAYOUT_CONSTANTS.MAX_SOURCE_CHARACTERS,
  maxPresentationSlides: PPT_LAYOUT_CONSTANTS.MAX_PRESENTATION_SLIDES,
  minBodyFontPt: PPT_LAYOUT_CONSTANTS.MIN_BODY_FONT_PT,
  maxBodyFontPt: PPT_LAYOUT_CONSTANTS.MAX_BODY_FONT_PT,
  titleFontPt: PPT_LAYOUT_CONSTANTS.TITLE_FONT_PT,
  coverTitleFontPt: PPT_LAYOUT_CONSTANTS.COVER_TITLE_FONT_PT,
  maxItemsPerSlide: PPT_LAYOUT_CONSTANTS.MAX_ITEMS_PER_SLIDE,
  maxLinesPerSlide: PPT_LAYOUT_CONSTANTS.MAX_LINES_PER_SLIDE,
  charsPerLine: PPT_LAYOUT_CONSTANTS.CHARS_PER_LINE,
};
