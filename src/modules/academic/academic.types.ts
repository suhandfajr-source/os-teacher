import { EntityStatus, AcademicPlanType } from "@prisma/client";

export interface AcademicContextProfileData {
  id: string;
  teachingContextId: string;
  curriculumName: string | null;
  phase: string | null;
  academicNote: string | null;
  cpText: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningObjectiveData {
  id: string;
  teachingContextId: string;
  code: string | null;
  description: string;
  orderIndex: number;
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
  planType: AcademicPlanType;
  title: string;
  targetMonth: number | null;
  allocatedHours: number | null;
  notes: string | null;
  orderIndex: number;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
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
}

export interface CreateLearningObjectiveInput {
  teachingContextId: string;
  code?: string | null;
  description: string;
  orderIndex?: number;
}

export interface UpdateLearningObjectiveInput {
  objectiveId: string;
  code?: string | null;
  description: string;
}

export interface ReorderLearningObjectivesInput {
  teachingContextId: string;
  orderedObjectiveIds: string[];
}

export interface CreateAcademicPlanItemInput {
  teachingContextId: string;
  planType: AcademicPlanType;
  title: string;
  targetMonth?: number | null;
  allocatedHours?: number | null;
  notes?: string | null;
  orderIndex?: number;
}

export interface UpdateAcademicPlanItemInput {
  planItemId: string;
  planType: AcademicPlanType;
  title: string;
  targetMonth?: number | null;
  allocatedHours?: number | null;
  notes?: string | null;
}

export interface ReorderAcademicPlanItemsInput {
  teachingContextId: string;
  planType: AcademicPlanType;
  orderedPlanItemIds: string[];
}

export interface LinkSessionObjectivesInput {
  teachingSessionId: string;
  objectiveIds: string[];
}

export interface LinkAssessmentObjectivesInput {
  assessmentId: string;
  objectiveIds: string[];
}
