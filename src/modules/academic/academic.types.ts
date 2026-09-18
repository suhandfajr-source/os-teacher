import type { EntityStatus } from "@prisma/client";

export const AcademicPlanType = {
  PROTA: "PROTA",
  PROSEM: "PROSEM",
} as const;
export type AcademicPlanType = (typeof AcademicPlanType)[keyof typeof AcademicPlanType];

export const PlanItemCategory = {
  REGULAR_MATERIAL: "REGULAR_MATERIAL",
  STS: "STS",
  SAS: "SAS",
  RESERVE: "RESERVE",
} as const;
export type PlanItemCategory = (typeof PlanItemCategory)[keyof typeof PlanItemCategory];

export interface WeeklyDistributionSlot {
  month: number; // 1-12
  week: number;  // 1-5
  hours: number; // e.g. 2, 3, 4
}

export interface AcademicContextProfileData {
  id: string;
  teachingContextId: string;
  curriculumName: string | null;
  phase: string | null;
  academicNote: string | null;
  cpText: string | null;
  hoursPerWeek: number;
  effectiveWeeksSem1: number;
  effectiveWeeksSem2: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningObjectiveData {
  id: string;
  teachingContextId: string;
  code: string | null;
  description: string;
  orderIndex: number;
  targetSemester: number | null;
  allocatedHours: number | null;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    sessionLinks: number;
    assessmentLinks: number;
  };
}

export interface AcademicPlanItemData {
  id: string;
  teachingContextId: string;
  learningObjectiveId: string | null;
  planType: AcademicPlanType;
  category: PlanItemCategory;
  title: string;
  targetMonth: number | null;
  targetSemester: number;
  allocatedHours: number | null;
  notes: string | null;
  weeklyDistribution: WeeklyDistributionSlot[] | null;
  orderIndex: number;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
  learningObjective?: {
    id: string;
    code: string | null;
    description: string;
  } | null;
}

export interface TeachingSessionLearningObjectiveLinkData {
  id: string;
  teachingSessionId: string;
  learningObjectiveId: string;
  snapshotCode: string | null;
  snapshotDescription: string;
  createdAt: Date;
}

export interface AssessmentLearningObjectiveLinkData {
  id: string;
  assessmentId: string;
  learningObjectiveId: string;
  snapshotCode: string | null;
  snapshotDescription: string;
  createdAt: Date;
}

export interface SaveAcademicProfileInput {
  teachingContextId: string;
  curriculumName?: string | null;
  phase?: string | null;
  academicNote?: string | null;
  cpText?: string | null;
  hoursPerWeek?: number;
  effectiveWeeksSem1?: number;
  effectiveWeeksSem2?: number;
}

export interface CreateLearningObjectiveInput {
  teachingContextId: string;
  code?: string | null;
  description: string;
  orderIndex?: number;
  targetSemester?: number | null;
  allocatedHours?: number | null;
}

export interface UpdateLearningObjectiveInput {
  objectiveId: string;
  code?: string | null;
  description: string;
  targetSemester?: number | null;
  allocatedHours?: number | null;
}

export interface ReorderLearningObjectivesInput {
  teachingContextId: string;
  orderedObjectiveIds: string[];
}

export interface CreateAcademicPlanItemInput {
  teachingContextId: string;
  learningObjectiveId?: string | null;
  planType: AcademicPlanType;
  category?: PlanItemCategory;
  title: string;
  targetMonth?: number | null;
  targetSemester?: number;
  allocatedHours?: number | null;
  notes?: string | null;
  weeklyDistribution?: WeeklyDistributionSlot[] | null;
  orderIndex?: number;
}

export interface UpdateAcademicPlanItemInput {
  planItemId: string;
  learningObjectiveId?: string | null;
  planType?: AcademicPlanType;
  category?: PlanItemCategory;
  title: string;
  targetMonth?: number | null;
  targetSemester?: number;
  allocatedHours?: number | null;
  notes?: string | null;
  weeklyDistribution?: WeeklyDistributionSlot[] | null;
}

export interface ReorderAcademicPlanItemsInput {
  teachingContextId: string;
  planType: AcademicPlanType;
  orderedPlanItemIds: string[];
}

export interface BulkSaveAcademicPlanInput {
  teachingContextId: string;
  planType: AcademicPlanType;
  targetSemester: number;
  items: Array<{
    id?: string;
    learningObjectiveId?: string | null;
    category?: PlanItemCategory;
    title: string;
    allocatedHours: number;
    notes?: string | null;
    weeklyDistribution?: WeeklyDistributionSlot[] | null;
  }>;
}

export interface LinkSessionObjectivesInput {
  teachingSessionId: string;
  objectiveIds: string[];
}

export interface LinkAssessmentObjectivesInput {
  assessmentId: string;
  objectiveIds: string[];
}
