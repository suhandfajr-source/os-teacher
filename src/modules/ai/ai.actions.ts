"use server";

import { prisma } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  verifyActiveSchoolMembership,
  verifyAiDraftAccess,
  verifyTeachingContextAccess,
} from "@/lib/authorization";
import {
  aiDraftFilterSchema,
  archiveAiDraftSchema,
  generateAiContentSchema,
  refineAiContentSchema,
  saveAiDraftSchema,
  AiDraftFilterInput,
  ArchiveAiDraftInput,
  GenerateAiContentInput,
  RefineAiContentInput,
  SaveAiDraftInput,
  TransientAiPreview,
} from "./ai.types";
import { buildSafeContextPack, formatContextSummary } from "./ai.service";
import { getAiContentProvider } from "./providers/ai-provider.factory";

// ============================================================================
// 1. GENERATION & REFINEMENT ACTIONS (TRANSIENT - NEVER PERSISTS TO DB)
// ============================================================================

export async function generateAiContentAction(
  rawInput: GenerateAiContentInput
): Promise<{ success: boolean; data?: TransientAiPreview; error?: string }> {
  try {
    const input = generateAiContentSchema.parse(rawInput);
    await verifyActiveSchoolMembership();

    let safeContextPack = undefined;

    if (input.teachingContextId) {
      const { context } = await verifyTeachingContextAccess(input.teachingContextId);

      const [fullContext, recentSessions, recentAssignments] = await Promise.all([
        prisma.teachingContext.findUnique({
          where: { id: context.id },
          include: {
            class: true,
            subject: true,
            academicPeriod: true,
          },
        }),
        input.includeHistoricalTopics
          ? prisma.teachingSession.findMany({
              where: { teachingContextId: context.id },
              select: { plannedTopic: true, actualTopic: true },
              orderBy: { date: "desc" },
              take: 5,
            })
          : Promise.resolve([]),
        input.includeHistoricalTopics
          ? prisma.assignment.findMany({
              where: { teachingContextId: context.id },
              select: { title: true },
              orderBy: { createdAt: "desc" },
              take: 5,
            })
          : Promise.resolve([]),
      ]);

      if (fullContext) {
        safeContextPack = buildSafeContextPack(
          {
            subject: fullContext.subject,
            class: fullContext.class,
            academicPeriod: fullContext.academicPeriod,
            recentSessions,
            recentAssignments,
          },
          input.includeHistoricalTopics
        );
      }
    }

    const provider = getAiContentProvider();
    const result = await provider.generate({
      contentType: input.contentType,
      topic: input.topic,
      instruction: input.instruction,
      tone: input.tone,
      contextPack: safeContextPack,
    });

    const contextSummary = formatContextSummary(safeContextPack);

    const preview: TransientAiPreview = {
      title: result.title,
      content: result.content,
      contentType: input.contentType,
      topic: input.topic,
      instruction: input.instruction,
      teachingContextId: input.teachingContextId,
      contextSummary,
      modelUsed: result.modelUsed,
      generatedAt: new Date().toISOString(),
    };

    return { success: true, data: preview };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal membuat konten AI";
    return { success: false, error: message };
  }
}

export async function refineAiContentAction(
  rawInput: RefineAiContentInput
): Promise<{ success: boolean; data?: TransientAiPreview; error?: string }> {
  try {
    const input = refineAiContentSchema.parse(rawInput);
    await verifyActiveSchoolMembership();

    let safeContextPack = undefined;

    if (input.teachingContextId) {
      const { context } = await verifyTeachingContextAccess(input.teachingContextId);
      const fullContext = await prisma.teachingContext.findUnique({
        where: { id: context.id },
        include: {
          class: true,
          subject: true,
          academicPeriod: true,
        },
      });

      if (fullContext) {
        safeContextPack = buildSafeContextPack({
          subject: fullContext.subject,
          class: fullContext.class,
          academicPeriod: fullContext.academicPeriod,
        });
      }
    }

    const provider = getAiContentProvider();
    const result = await provider.refine({
      contentType: input.contentType,
      currentTitle: input.currentTitle,
      currentContent: input.currentContent,
      refinementInstruction: input.refinementInstruction,
      contextPack: safeContextPack,
    });

    const contextSummary = formatContextSummary(safeContextPack);

    const preview: TransientAiPreview = {
      title: result.title,
      content: result.content,
      contentType: input.contentType,
      topic: input.currentTitle,
      teachingContextId: input.teachingContextId,
      contextSummary,
      modelUsed: result.modelUsed,
      generatedAt: new Date().toISOString(),
    };

    return { success: true, data: preview };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menyesuaikan konten AI";
    return { success: false, error: message };
  }
}

// ============================================================================
// 2. EXPLICIT PERSISTENCE ACTIONS (SAVE / EDIT / ARCHIVE)
// ============================================================================

export async function saveAiDraftAction(
  rawInput: SaveAiDraftInput
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  try {
    const input = saveAiDraftSchema.parse(rawInput);
    const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

    // Verify teaching context if specified
    if (input.teachingContextId) {
      await verifyTeachingContextAccess(input.teachingContextId);
    }

    // Updating an existing draft
    if (input.draftId) {
      const { draft } = await verifyAiDraftAccess(input.draftId);

      if (draft.status === "ARCHIVED") {
        return {
          success: false,
          error: "Draf yang telah diarsipkan bersifat hanya-baca dan tidak dapat diubah.",
        };
      }

      const updated = await prisma.aiContentDraft.update({
        where: { id: draft.id },
        data: {
          title: input.title,
          topic: input.topic,
          instruction: input.instruction ?? null,
          content: input.content,
          updatedAt: new Date(),
        },
      });

      revalidatePath("/ai-studio");
      return { success: true, data: { id: updated.id } };
    }

    // Creating a new saved draft - Stage 06 V1 keeps modelUsed NULL to avoid misleading provenance
    const newDraft = await prisma.aiContentDraft.create({
      data: {
        schoolId: activeSchoolId,
        teacherProfileId: profile.id,
        teachingContextId: input.teachingContextId ?? null,
        contentType: input.contentType,
        title: input.title,
        topic: input.topic,
        instruction: input.instruction ?? null,
        content: input.content,
        status: "ACTIVE",
        modelUsed: null,
      },
    });

    revalidatePath("/ai-studio");
    return { success: true, data: { id: newDraft.id } };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan draf AI";
    return { success: false, error: message };
  }
}

export async function archiveAiDraftAction(
  rawInput: ArchiveAiDraftInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const input = archiveAiDraftSchema.parse(rawInput);
    const { draft } = await verifyAiDraftAccess(input.draftId);

    if (draft.status === "ARCHIVED") {
      return { success: true };
    }

    await prisma.aiContentDraft.update({
      where: { id: draft.id },
      data: {
        status: "ARCHIVED",
        updatedAt: new Date(),
      },
    });

    revalidatePath("/ai-studio");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengarsipkan draf AI";
    return { success: false, error: message };
  }
}

// ============================================================================
// 3. READ QUERIES (DRAFTS LIST & DETAIL & TEACHER CONTEXTS)
// ============================================================================

export async function getAiDraftsAction(rawFilter?: AiDraftFilterInput) {
  const filter = aiDraftFilterSchema.parse(rawFilter || {});
  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

  const whereClause: Prisma.AiContentDraftWhereInput = {
    teacherProfileId: profile.id,
    schoolId: activeSchoolId,
    status: filter.status,
  };

  if (filter.contentType) {
    whereClause.contentType = filter.contentType;
  }

  if (filter.teachingContextId) {
    whereClause.teachingContextId = filter.teachingContextId;
  }

  if (filter.search && filter.search.trim()) {
    whereClause.OR = [
      { title: { contains: filter.search.trim(), mode: "insensitive" } },
      { topic: { contains: filter.search.trim(), mode: "insensitive" } },
    ];
  }

  const drafts = await prisma.aiContentDraft.findMany({
    where: whereClause,
    include: {
      teachingContext: {
        include: {
          class: true,
          subject: true,
          academicPeriod: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return drafts;
}

export async function getAiDraftDetailAction(draftId: string) {
  const { draft } = await verifyAiDraftAccess(draftId);
  return draft;
}

export async function getTeacherTeachingContextsAction() {
  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

  const contexts = await prisma.teachingContext.findMany({
    where: {
      teacherProfileId: profile.id,
      schoolId: activeSchoolId,
    },
    include: {
      class: true,
      subject: true,
      academicPeriod: true,
    },
    orderBy: [
      { class: { name: "asc" } },
      { subject: { name: "asc" } },
    ],
  });

  return contexts.map((ctx) => ({
    id: ctx.id,
    label: `${ctx.subject.name} - Kelas ${ctx.class.name} (${ctx.academicPeriod.year} Sem ${ctx.academicPeriod.semester})`,
    subjectName: ctx.subject.name,
    className: ctx.class.name,
    gradeLevel: ctx.class.gradeLevel,
    academicPeriod: `${ctx.academicPeriod.year} / ${ctx.academicPeriod.semester}`,
  }));
}
