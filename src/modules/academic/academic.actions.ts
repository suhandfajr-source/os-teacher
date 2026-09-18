"use server";

import { prisma } from "@/lib/auth";
import {
  verifyTeachingContextAccess,
  verifyTeachingSessionAccess,
  verifyAssessmentAccess,
  verifyLearningObjectiveAccess,
  verifyAcademicPlanItemAccess,
} from "@/lib/authorization";
import { EntityStatus, Prisma } from "@prisma/client";
import { PlanItemCategory } from "./academic.types";
import {
  saveAcademicProfileSchema,
  createLearningObjectiveSchema,
  updateLearningObjectiveSchema,
  reorderLearningObjectivesSchema,
  createAcademicPlanItemSchema,
  updateAcademicPlanItemSchema,
  bulkSaveAcademicPlanSchema,
  reorderAcademicPlanItemsSchema,
  linkSessionObjectivesSchema,
  linkAssessmentObjectivesSchema,
  assertActiveObjective,
} from "./academic.service";
import {
  SaveAcademicProfileInput,
  CreateLearningObjectiveInput,
  UpdateLearningObjectiveInput,
  ReorderLearningObjectivesInput,
  CreateAcademicPlanItemInput,
  UpdateAcademicPlanItemInput,
  BulkSaveAcademicPlanInput,
  ReorderAcademicPlanItemsInput,
  LinkSessionObjectivesInput,
  LinkAssessmentObjectivesInput,
  WeeklyDistributionSlot,
} from "./academic.types";

/**
 * Retrieves full academic context data for an authorized TeachingContext.
 */
export async function getAcademicContext(teachingContextId: string) {
  const { context } = await verifyTeachingContextAccess(teachingContextId);

  const [profile, objectives, planItems] = await Promise.all([
    prisma.academicContextProfile.findUnique({
      where: { teachingContextId: context.id },
    }),
    prisma.learningObjective.findMany({
      where: { teachingContextId: context.id },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      include: {
        _count: {
          select: {
            sessionLinks: true,
            assessmentLinks: true,
          },
        },
      },
    }),
    prisma.academicPlanItem.findMany({
      where: { teachingContextId: context.id },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      include: {
        learningObjective: {
          select: {
            id: true,
            code: true,
            description: true,
          },
        },
      },
    }),
  ]);

  const formattedPlanItems = planItems.map((item) => ({
    ...item,
    weeklyDistribution: (item.weeklyDistribution as unknown as WeeklyDistributionSlot[]) || null,
  }));

  return {
    context,
    profile,
    objectives,
    planItems: formattedPlanItems,
  };
}

/**
 * Creates or updates the AcademicContextProfile metadata (Curriculum, Phase, CP, Note, Hours).
 */
export async function saveAcademicProfile(input: SaveAcademicProfileInput) {
  const validated = saveAcademicProfileSchema.parse(input);
  const { context } = await verifyTeachingContextAccess(validated.teachingContextId);

  const profile = await prisma.academicContextProfile.upsert({
    where: { teachingContextId: context.id },
    create: {
      teachingContextId: context.id,
      curriculumName: validated.curriculumName || null,
      phase: validated.phase || null,
      academicNote: validated.academicNote || null,
      cpText: validated.cpText || null,
      hoursPerWeek: validated.hoursPerWeek ?? 3,
      effectiveWeeksSem1: validated.effectiveWeeksSem1 ?? 18,
      effectiveWeeksSem2: validated.effectiveWeeksSem2 ?? 16,
    },
    update: {
      curriculumName: validated.curriculumName || null,
      phase: validated.phase || null,
      academicNote: validated.academicNote || null,
      cpText: validated.cpText || null,
      ...(validated.hoursPerWeek !== undefined && { hoursPerWeek: validated.hoursPerWeek }),
      ...(validated.effectiveWeeksSem1 !== undefined && { effectiveWeeksSem1: validated.effectiveWeeksSem1 }),
      ...(validated.effectiveWeeksSem2 !== undefined && { effectiveWeeksSem2: validated.effectiveWeeksSem2 }),
    },
  });

  return { success: true, profile };
}

/**
 * Creates a new LearningObjective (TP) in the TeachingContext.
 */
export async function createLearningObjective(input: CreateLearningObjectiveInput) {
  const validated = createLearningObjectiveSchema.parse(input);
  const { context } = await verifyTeachingContextAccess(validated.teachingContextId);

  // Compute next orderIndex if not explicitly given
  let orderIndex = validated.orderIndex;
  if (orderIndex === undefined) {
    const highest = await prisma.learningObjective.findFirst({
      where: { teachingContextId: context.id },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    orderIndex = highest ? highest.orderIndex + 1 : 0;
  }

  const objective = await prisma.learningObjective.create({
    data: {
      teachingContextId: context.id,
      code: validated.code || null,
      description: validated.description,
      orderIndex,
      targetSemester: validated.targetSemester ?? 1,
      allocatedHours: validated.allocatedHours ?? 6,
      status: EntityStatus.ACTIVE,
    },
  });

  return { success: true, objective };
}

/**
 * Updates an active LearningObjective (TP). Historical link snapshots remain unchanged.
 */
export async function updateLearningObjective(input: UpdateLearningObjectiveInput) {
  const validated = updateLearningObjectiveSchema.parse(input);
  const { objective } = await verifyLearningObjectiveAccess(validated.objectiveId);

  assertActiveObjective(objective.status);

  const updated = await prisma.learningObjective.update({
    where: { id: objective.id },
    data: {
      code: validated.code || null,
      description: validated.description,
      ...(validated.targetSemester !== undefined && { targetSemester: validated.targetSemester }),
      ...(validated.allocatedHours !== undefined && { allocatedHours: validated.allocatedHours }),
    },
  });

  return { success: true, objective: updated };
}

/**
 * Archives a LearningObjective (TP). Historical links and snapshots remain valid.
 */
export async function archiveLearningObjective(objectiveId: string) {
  const { objective } = await verifyLearningObjectiveAccess(objectiveId);

  const archived = await prisma.learningObjective.update({
    where: { id: objective.id },
    data: {
      status: EntityStatus.ARCHIVED,
    },
  });

  return { success: true, objective: archived };
}

/**
 * Transactionally reorders LearningObjectives (ATP sequence).
 */
export async function reorderLearningObjectives(input: ReorderLearningObjectivesInput) {
  const validated = reorderLearningObjectivesSchema.parse(input);
  const { context } = await verifyTeachingContextAccess(validated.teachingContextId);

  await prisma.$transaction(
    validated.orderedObjectiveIds.map((id, index) =>
      prisma.learningObjective.updateMany({
        where: {
          id,
          teachingContextId: context.id,
        },
        data: {
          orderIndex: index,
        },
      })
    )
  );

  return { success: true };
}

/**
 * Creates an AcademicPlanItem (PROTA / PROSEM).
 */
export async function createAcademicPlanItem(input: CreateAcademicPlanItemInput) {
  const validated = createAcademicPlanItemSchema.parse(input);
  const { context } = await verifyTeachingContextAccess(validated.teachingContextId);

  let orderIndex = validated.orderIndex;
  if (orderIndex === undefined) {
    const highest = await prisma.academicPlanItem.findFirst({
      where: {
        teachingContextId: context.id,
        planType: validated.planType,
      },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    orderIndex = highest ? highest.orderIndex + 1 : 0;
  }

  const planItem = await prisma.academicPlanItem.create({
    data: {
      teachingContextId: context.id,
      learningObjectiveId: validated.learningObjectiveId || null,
      planType: validated.planType,
      category: validated.category || PlanItemCategory.REGULAR_MATERIAL,
      title: validated.title,
      targetMonth: validated.targetMonth || null,
      targetSemester: validated.targetSemester ?? 1,
      allocatedHours: validated.allocatedHours || null,
      notes: validated.notes || null,
      weeklyDistribution: validated.weeklyDistribution
        ? (validated.weeklyDistribution as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      orderIndex,
      status: EntityStatus.ACTIVE,
    },
  });

  return { success: true, planItem };
}

/**
 * Updates an active AcademicPlanItem.
 */
export async function updateAcademicPlanItem(input: UpdateAcademicPlanItemInput) {
  const validated = updateAcademicPlanItemSchema.parse(input);
  const { planItem } = await verifyAcademicPlanItemAccess(validated.planItemId);

  if (planItem.status !== EntityStatus.ACTIVE) {
    throw new Error("Program akademik yang diarsipkan tidak dapat diubah");
  }

  const updated = await prisma.academicPlanItem.update({
    where: { id: planItem.id },
    data: {
      learningObjectiveId: validated.learningObjectiveId !== undefined ? validated.learningObjectiveId : planItem.learningObjectiveId,
      planType: validated.planType || planItem.planType,
      category: validated.category || planItem.category,
      title: validated.title,
      targetMonth: validated.targetMonth !== undefined ? validated.targetMonth : planItem.targetMonth,
      targetSemester: validated.targetSemester !== undefined ? validated.targetSemester : planItem.targetSemester,
      allocatedHours: validated.allocatedHours !== undefined ? validated.allocatedHours : planItem.allocatedHours,
      notes: validated.notes !== undefined ? validated.notes : planItem.notes,
      weeklyDistribution:
        validated.weeklyDistribution !== undefined
          ? validated.weeklyDistribution
            ? (validated.weeklyDistribution as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull
          : (planItem.weeklyDistribution as unknown as Prisma.InputJsonValue),
    },
  });

  return { success: true, planItem: updated };
}

/**
 * Bulk saves or updates an entire semester of AcademicPlanItems transactionally.
 */
export async function bulkSaveAcademicPlan(input: BulkSaveAcademicPlanInput) {
  const validated = bulkSaveAcademicPlanSchema.parse(input);
  const { context } = await verifyTeachingContextAccess(validated.teachingContextId);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Soft-archive / mark inactive existing items for this context + planType + semester that are not in the new payload
    const existingItems = await tx.academicPlanItem.findMany({
      where: {
        teachingContextId: context.id,
        planType: validated.planType,
        targetSemester: validated.targetSemester,
        status: EntityStatus.ACTIVE,
      },
    });

    const incomingIds = new Set(validated.items.filter((it) => it.id).map((it) => it.id!));
    const toArchive = existingItems.filter((ex) => !incomingIds.has(ex.id));

    if (toArchive.length > 0) {
      await tx.academicPlanItem.updateMany({
        where: { id: { in: toArchive.map((t) => t.id) } },
        data: { status: EntityStatus.ARCHIVED },
      });
    }

    // 2. Upsert incoming items
    const savedItems = [];
    for (let i = 0; i < validated.items.length; i++) {
      const item = validated.items[i];
      if (item.id && incomingIds.has(item.id)) {
        const updated = await tx.academicPlanItem.update({
          where: { id: item.id },
          data: {
            learningObjectiveId: item.learningObjectiveId || null,
            category: item.category || PlanItemCategory.REGULAR_MATERIAL,
            title: item.title,
            targetSemester: validated.targetSemester,
            allocatedHours: item.allocatedHours,
            notes: item.notes || null,
            weeklyDistribution: item.weeklyDistribution
              ? (item.weeklyDistribution as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            orderIndex: i,
            status: EntityStatus.ACTIVE,
          },
        });
        savedItems.push(updated);
      } else {
        const created = await tx.academicPlanItem.create({
          data: {
            teachingContextId: context.id,
            learningObjectiveId: item.learningObjectiveId || null,
            planType: validated.planType,
            category: item.category || PlanItemCategory.REGULAR_MATERIAL,
            title: item.title,
            targetSemester: validated.targetSemester,
            allocatedHours: item.allocatedHours,
            notes: item.notes || null,
            weeklyDistribution: item.weeklyDistribution
              ? (item.weeklyDistribution as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            orderIndex: i,
            status: EntityStatus.ACTIVE,
          },
        });
        savedItems.push(created);
      }
    }

    return savedItems;
  });

  return { success: true, planItems: result };
}

/**
 * Archives an AcademicPlanItem.
 */
export async function archiveAcademicPlanItem(planItemId: string) {
  const { planItem } = await verifyAcademicPlanItemAccess(planItemId);

  const archived = await prisma.academicPlanItem.update({
    where: { id: planItem.id },
    data: {
      status: EntityStatus.ARCHIVED,
    },
  });

  return { success: true, planItem: archived };
}

/**
 * Transactionally reorders AcademicPlanItems.
 */
export async function reorderAcademicPlanItems(input: ReorderAcademicPlanItemsInput) {
  const validated = reorderAcademicPlanItemsSchema.parse(input);
  const { context } = await verifyTeachingContextAccess(validated.teachingContextId);

  await prisma.$transaction(
    validated.orderedPlanItemIds.map((id, index) =>
      prisma.academicPlanItem.updateMany({
        where: {
          id,
          teachingContextId: context.id,
          planType: validated.planType,
        },
        data: {
          orderIndex: index,
        },
      })
    )
  );

  return { success: true };
}

/**
 * Explicitly links LearningObjectives to a TeachingSession, creating immutable snapshots.
 * Enforces: authorized TeachingContext == Session TeachingContext == Objective TeachingContext.
 */
export async function linkSessionLearningObjectives(input: LinkSessionObjectivesInput) {
  const validated = linkSessionObjectivesSchema.parse(input);
  const { session, context } = await verifyTeachingSessionAccess(validated.teachingSessionId);

  // Fetch requested objectives and verify context boundary
  const requestedObjectives = await prisma.learningObjective.findMany({
    where: {
      id: { in: validated.objectiveIds },
    },
  });

  if (requestedObjectives.length !== validated.objectiveIds.length) {
    throw new Error("Satu atau lebih Tujuan Pembelajaran tidak ditemukan");
  }

  for (const obj of requestedObjectives) {
    if (obj.teachingContextId !== context.id) {
      throw new Error("Forbidden: Tujuan Pembelajaran berasal dari kelas/konteks yang berbeda");
    }
  }

  // Transaction: Fetch existing links, create new snapshot links for newly added ones, delete removed ones
  await prisma.$transaction(async (tx) => {
    const existingLinks = await tx.teachingSessionLearningObjective.findMany({
      where: { teachingSessionId: session.id },
    });

    const existingObjectiveIds = new Set(existingLinks.map((l) => l.learningObjectiveId));
    const targetObjectiveIds = new Set(validated.objectiveIds);

    // Unlink omitted ones
    const toDeleteIds = existingLinks
      .filter((l) => !targetObjectiveIds.has(l.learningObjectiveId))
      .map((l) => l.id);

    if (toDeleteIds.length > 0) {
      await tx.teachingSessionLearningObjective.deleteMany({
        where: { id: { in: toDeleteIds } },
      });
    }

    // Add new ones with current snapshot
    for (const obj of requestedObjectives) {
      if (!existingObjectiveIds.has(obj.id)) {
        assertActiveObjective(obj.status);
        await tx.teachingSessionLearningObjective.create({
          data: {
            teachingSessionId: session.id,
            learningObjectiveId: obj.id,
            snapshotCode: obj.code || null,
            snapshotDescription: obj.description,
          },
        });
      }
    }
  });

  return { success: true };
}

/**
 * Explicitly links LearningObjectives to an Assessment, creating immutable snapshots.
 * Enforces: authorized TeachingContext == Assessment TeachingContext == Objective TeachingContext.
 */
export async function linkAssessmentLearningObjectives(input: LinkAssessmentObjectivesInput) {
  const validated = linkAssessmentObjectivesSchema.parse(input);
  const { assessment, context } = await verifyAssessmentAccess(validated.assessmentId);

  // Fetch requested objectives and verify context boundary
  const requestedObjectives = await prisma.learningObjective.findMany({
    where: {
      id: { in: validated.objectiveIds },
    },
  });

  if (requestedObjectives.length !== validated.objectiveIds.length) {
    throw new Error("Satu atau lebih Tujuan Pembelajaran tidak ditemukan");
  }

  for (const obj of requestedObjectives) {
    if (obj.teachingContextId !== context.id) {
      throw new Error("Forbidden: Tujuan Pembelajaran berasal dari kelas/konteks yang berbeda");
    }
  }

  // Transaction: Fetch existing links, create new snapshot links for newly added ones, delete removed ones
  await prisma.$transaction(async (tx) => {
    const existingLinks = await tx.assessmentLearningObjective.findMany({
      where: { assessmentId: assessment.id },
    });

    const existingObjectiveIds = new Set(existingLinks.map((l) => l.learningObjectiveId));
    const targetObjectiveIds = new Set(validated.objectiveIds);

    // Unlink omitted ones
    const toDeleteIds = existingLinks
      .filter((l) => !targetObjectiveIds.has(l.learningObjectiveId))
      .map((l) => l.id);

    if (toDeleteIds.length > 0) {
      await tx.assessmentLearningObjective.deleteMany({
        where: { id: { in: toDeleteIds } },
      });
    }

    // Add new ones with current snapshot
    for (const obj of requestedObjectives) {
      if (!existingObjectiveIds.has(obj.id)) {
        assertActiveObjective(obj.status);
        await tx.assessmentLearningObjective.create({
          data: {
            assessmentId: assessment.id,
            learningObjectiveId: obj.id,
            snapshotCode: obj.code || null,
            snapshotDescription: obj.description,
          },
        });
      }
    }
  });

  return { success: true };
}
