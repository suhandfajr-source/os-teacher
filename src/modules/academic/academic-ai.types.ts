import { PlanItemCategory } from "@prisma/client";
import { WeeklyDistributionSlot } from "./academic.types";

export type CurriculumSourceMode = "CP" | "TOC_IMAGE" | "CUSTOM_TEXT";

export interface ExtractedChapter {
  chapterNumber: number;
  title: string;
  subTopics: string[];
  suggestedHours: number;
  suggestedSemester: 1 | 2;
  learningObjectiveCode?: string;
  learningObjectiveDescription?: string;
}

export interface ExtractedCurriculumStructure {
  bookTitle?: string;
  subjectName?: string;
  phaseOrGrade?: string;
  totalSuggestedHours: number;
  chapters: ExtractedChapter[];
}

export interface ExtractCurriculumMaterialInput {
  teachingContextId: string;
  sourceMode: CurriculumSourceMode;
  textContent?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface GeneratedPlanItemPreview {
  id?: string;
  learningObjectiveId?: string | null;
  learningObjectiveCode?: string | null;
  learningObjectiveDescription?: string | null;
  category: PlanItemCategory;
  title: string;
  targetSemester: number;
  allocatedHours: number;
  notes?: string | null;
  weeklyDistribution: WeeklyDistributionSlot[];
}

export interface GeneratedAcademicPlanPreview {
  targetSemester: number;
  effectiveWeeks: number;
  hoursPerWeek: number;
  totalAvailableHours: number;
  totalScheduledHours: number;
  isBalanced: boolean;
  items: GeneratedPlanItemPreview[];
}

export interface GenerateAcademicPlanInput {
  teachingContextId: string;
  targetSemester: number; // 1 or 2
  chapters?: ExtractedChapter[];
  hoursPerWeek?: number;
  effectiveWeeks?: number;
}

export interface RefineAcademicPlanInput {
  teachingContextId: string;
  targetSemester: number;
  instructions: string;
  currentPlanItems: GeneratedPlanItemPreview[];
}
