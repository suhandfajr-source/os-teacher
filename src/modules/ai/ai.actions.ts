"use server";

import { z } from "zod";
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

function formatActionError(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) {
    return error.issues?.[0]?.message || "Input parameter tidak valid";
  }
  return error instanceof Error ? error.message : fallback;
}

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
    return { success: false, error: formatActionError(error, "Gagal membuat konten AI") };
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
    return { success: false, error: formatActionError(error, "Gagal menyesuaikan konten AI") };
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
    return { success: false, error: formatActionError(error, "Gagal menyimpan draf AI") };
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

// ============================================================================
// 4. SLIDE ILLUSTRATION (AI IMAGE GENERATION — OPTIONAL, GRACEFUL FALLBACK)
// ============================================================================

const slideIllustrationSchema = z.object({
  visualPrompt: z.string().min(3).max(500),
  subjectName: z.string().max(120).optional(),
});

/**
 * Generates an educational illustration for a key presentation slide using the
 * Gemini image model. Requires GEMINI_IMAGE_MODEL to be configured (paid tier);
 * when unset or unavailable it returns an empty data URL so the export pipeline
 * falls back to the themed illustration panel without failing.
 */
export async function generateSlideIllustrationAction(
  rawInput: z.input<typeof slideIllustrationSchema>
): Promise<{ success: boolean; data?: { imageDataUrl: string }; error?: string }> {
  try {
    const { visualPrompt, subjectName } = slideIllustrationSchema.parse(rawInput);
    await verifyActiveSchoolMembership();

    const model = process.env.GEMINI_IMAGE_MODEL?.trim();
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!model || !apiKey) {
      // Feature disabled — caller falls back to the themed illustration panel.
      return { success: true, data: { imageDataUrl: "" } };
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const styledPrompt = [
      "Buat satu ilustrasi edukatif untuk slide presentasi sekolah (rasio 1:1).",
      subjectName ? `Konteks mata pelajaran: ${subjectName}.` : "",
      `Subjek ilustrasi: ${visualPrompt}`,
      "Gaya: ilustrasi flat modern yang bersih dan menarik untuk siswa, komposisi terpusat, warna harmonis.",
      "PENTING: tanpa teks, tulisan, atau label apapun di dalam gambar.",
    ]
      .filter(Boolean)
      .join(" ");

    const timeoutMs = 45000;
    const generatePromise = ai.models.generateContent({
      model,
      contents: styledPrompt,
      config: { responseModalities: ["IMAGE"] },
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Image generation timeout")), timeoutMs)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      return { success: true, data: { imageDataUrl: "" } };
    }

    const mimeType = imagePart.inlineData.mimeType || "image/png";
    return {
      success: true,
      data: { imageDataUrl: `data:${mimeType};base64,${imagePart.inlineData.data}` },
    };
  } catch (error: unknown) {
    // Any failure (quota, auth, timeout) must never break the export.
    console.warn(
      "[Slide Illustration] Image generation unavailable, using fallback panel:",
      error instanceof Error ? error.message : error
    );
    return { success: true, data: { imageDataUrl: "" } };
  }
}
