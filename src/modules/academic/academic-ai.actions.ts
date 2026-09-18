"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";
import {
  verifyActiveSchoolMembership,
  verifyTeachingContextAccess,
} from "@/lib/authorization";
import { EntityStatus, Prisma } from "@prisma/client";
import { PlanItemCategory } from "./academic.types";
import {
  ExtractCurriculumMaterialInput,
  ExtractedChapter,
  ExtractedCurriculumStructure,
  GenerateAcademicPlanInput,
  GeneratedAcademicPlanPreview,
  RefineAcademicPlanInput,
} from "./academic-ai.types";
import {
  deterministicDistributePlan,
  parseJsonFromAi,
} from "./academic-ai.service";
import { PlanItemCategoryEnum } from "./academic.service";
import { AcademicPlanType } from "./academic.types";

const extractMaterialSchema = z.object({
  teachingContextId: z.string().min(1),
  sourceMode: z.enum(["CP", "TOC_IMAGE", "CUSTOM_TEXT"]),
  textContent: z.string().optional(),
  imageBase64: z.string().optional(),
  imageMimeType: z.string().optional(),
});

const generatePlanSchema = z.object({
  teachingContextId: z.string().min(1),
  targetSemester: z.number().int().min(1).max(2),
  chapters: z
    .array(
      z.object({
        chapterNumber: z.number().int(),
        title: z.string().min(1),
        subTopics: z.array(z.string()).default([]),
        suggestedHours: z.number().int().positive().default(6),
        suggestedSemester: z.union([z.literal(1), z.literal(2)]).default(1),
        learningObjectiveCode: z.string().optional(),
        learningObjectiveDescription: z.string().optional(),
      })
    )
    .optional(),
  hoursPerWeek: z.number().int().min(1).max(10).optional(),
  effectiveWeeks: z.number().int().min(1).max(25).optional(),
});

const refinePlanSchema = z.object({
  teachingContextId: z.string().min(1),
  targetSemester: z.number().int().min(1).max(2),
  instructions: z.string().trim().min(1, "Instruksi penyesuaian wajib diisi"),
  currentPlanItems: z.array(
    z.object({
      id: z.string().optional(),
      learningObjectiveId: z.string().nullable().optional(),
      learningObjectiveCode: z.string().nullable().optional(),
      learningObjectiveDescription: z.string().nullable().optional(),
      category: PlanItemCategoryEnum,
      title: z.string().min(1),
      targetSemester: z.number().int().min(1).max(2),
      allocatedHours: z.number().int().positive(),
      notes: z.string().nullable().optional(),
      weeklyDistribution: z.array(
        z.object({
          month: z.number().int().min(1).max(12),
          week: z.number().int().min(1).max(5),
          hours: z.number().int().positive(),
        })
      ),
    })
  ),
});

/**
 * 1. Action: Ekstraksi Materi Pembelajaran dari CP, Foto Daftar Isi Buku (Vision), atau Teks Bebas.
 */
export async function extractCurriculumMaterialAction(
  rawInput: ExtractCurriculumMaterialInput
): Promise<{ success: boolean; data?: ExtractedCurriculumStructure; error?: string }> {
  try {
    const input = extractMaterialSchema.parse(rawInput);
    await verifyActiveSchoolMembership();
    const { context } = await verifyTeachingContextAccess(input.teachingContextId);

    const fullContext = await prisma.teachingContext.findUnique({
      where: { id: context.id },
      include: { class: true, subject: true, academicPeriod: true },
    });

    const apiKey = process.env.GEMINI_API_KEY;
    const isTestOrMock = !apiKey || process.env.NODE_ENV === "test" || process.env.AI_PROVIDER === "mock";

    if (isTestOrMock) {
      // Deterministic fallback for test/mock
      return {
        success: true,
        data: {
          bookTitle: input.sourceMode === "TOC_IMAGE" ? "Buku Paket Terdeteksi (Simulasi)" : "Kurikulum Standar",
          subjectName: fullContext?.subject.name || "Mata Pelajaran",
          phaseOrGrade: fullContext?.class.gradeLevel || "Kelas 10",
          totalSuggestedHours: 48,
          chapters: [
            {
              chapterNumber: 1,
              title: "Bab 1: Konsep Dasar & Pengantar",
              subTopics: ["Pengertian & Definisi", "Ruang Lingkup"],
              suggestedHours: 12,
              suggestedSemester: 1,
              learningObjectiveCode: "TP-1.1",
              learningObjectiveDescription: "Memahami konsep dasar dan ruang lingkup materi",
            },
            {
              chapterNumber: 2,
              title: "Bab 2: Analisis & Penerapan",
              subTopics: ["Metode Penerapan", "Studi Kasus"],
              suggestedHours: 15,
              suggestedSemester: 1,
              learningObjectiveCode: "TP-1.2",
              learningObjectiveDescription: "Menganalisis dan menerapkan materi dalam pemecahan masalah",
            },
            {
              chapterNumber: 3,
              title: "Bab 3: Evaluasi & Sintesis",
              subTopics: ["Teknik Evaluasi", "Penyusunan Laporan"],
              suggestedHours: 15,
              suggestedSemester: 1,
              learningObjectiveCode: "TP-1.3",
              learningObjectiveDescription: "Mengevaluasi hasil dan menyusun laporan sintesis",
            },
          ],
        },
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";

    const systemInstruction =
      "Anda adalah asisten kurikulum ahli di Indonesia. " +
      "Tugas Anda adalah menganalisis teks Capaian Pembelajaran (CP), daftar bab teks, atau foto Daftar Isi buku pelajaran " +
      "lalu menghasilkan JSON murni berisi struktur bab, sub-bab, alokasi jam (suggestedHours), dan Tujuan Pembelajaran (TP). " +
      "HANYA keluarkan format JSON valid tanpa format markdown atau salam pembuka.";

    let promptContents: unknown[] = [];

    if (input.sourceMode === "TOC_IMAGE" && input.imageBase64) {
      const cleanBase64 = input.imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
      const mimeType = input.imageMimeType || "image/jpeg";

      promptContents = [
        {
          inlineData: {
            mimeType,
            data: cleanBase64,
          },
        },
        {
          text: `Analisis foto Daftar Isi buku cetak berikut untuk mata pelajaran: ${fullContext?.subject.name || "Umum"}, kelas: ${
            fullContext?.class.name || "Kelas Siswa"
          }. Ekstrak seluruh bab dan sub-bab secara berurutan. Format JSON: { "bookTitle": string, "subjectName": string, "chapters": [ { "chapterNumber": number, "title": string, "subTopics": string[], "suggestedHours": number, "suggestedSemester": 1 | 2, "learningObjectiveCode": string, "learningObjectiveDescription": string } ] }`,
        },
      ];
    } else {
      promptContents = [
        {
          text: `Analisis konten kurikulum berikut:\n\n${
            input.textContent || "Capaian Pembelajaran standar"
          }\n\nMata Pelajaran: ${fullContext?.subject.name}, Kelas: ${
            fullContext?.class.name
          }.\nFormat JSON: { "bookTitle": string, "subjectName": string, "chapters": [ { "chapterNumber": number, "title": string, "subTopics": string[], "suggestedHours": number, "suggestedSemester": 1 | 2, "learningObjectiveCode": string, "learningObjectiveDescription": string } ] }`,
        },
      ];
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: promptContents as unknown as string,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const rawOutput = response.text || "{}";
    const parsed = parseJsonFromAi<ExtractedCurriculumStructure>(rawOutput);

    // Compute total suggested hours
    const totalSuggestedHours = (parsed.chapters || []).reduce(
      (acc, c) => acc + (c.suggestedHours || 6),
      0
    );

    return {
      success: true,
      data: {
        bookTitle: parsed.bookTitle || "Buku / Silabus Kurikulum",
        subjectName: parsed.subjectName || fullContext?.subject.name,
        phaseOrGrade: fullContext?.class.gradeLevel || undefined,
        totalSuggestedHours,
        chapters: parsed.chapters || [],
      },
    };
  } catch (error: unknown) {
    console.error("[extractCurriculumMaterialAction Error]:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mengekstrak materi kurikulum.",
    };
  }
}

/**
 * 2. Action: Generate Rencana Pembelajaran (PROTA & PROSEM Matriks Mingguan).
 */
export async function generateAcademicPlanAction(
  rawInput: GenerateAcademicPlanInput
): Promise<{ success: boolean; data?: GeneratedAcademicPlanPreview; error?: string }> {
  try {
    const input = generatePlanSchema.parse(rawInput);
    await verifyActiveSchoolMembership();
    const { context } = await verifyTeachingContextAccess(input.teachingContextId);

    // Get current profile config or fallbacks
    const profile = await prisma.academicContextProfile.findUnique({
      where: { teachingContextId: context.id },
    });

    const hoursPerWeek = input.hoursPerWeek || profile?.hoursPerWeek || 3;
    const effectiveWeeks =
      input.effectiveWeeks ||
      (input.targetSemester === 1
        ? profile?.effectiveWeeksSem1 || 18
        : profile?.effectiveWeeksSem2 || 16);

    let chapters = input.chapters;

    // If chapters not provided, fetch existing LearningObjectives or create default structure
    if (!chapters || chapters.length === 0) {
      const existingObjs = await prisma.learningObjective.findMany({
        where: {
          teachingContextId: context.id,
          status: EntityStatus.ACTIVE,
          targetSemester: input.targetSemester,
        },
        orderBy: { orderIndex: "asc" },
      });

      if (existingObjs.length > 0) {
        chapters = existingObjs.map((obj, i) => ({
          chapterNumber: i + 1,
          title: obj.description,
          subTopics: [],
          suggestedHours: obj.allocatedHours || 6,
          suggestedSemester: (obj.targetSemester as 1 | 2) || (input.targetSemester as 1 | 2),
          learningObjectiveCode: obj.code || undefined,
          learningObjectiveDescription: obj.description,
        }));
      } else {
        // Default standard chapters for the context
        chapters = [
          {
            chapterNumber: 1,
            title: "Bab 1: Pengenalan & Konsep Pokok",
            subTopics: ["Konsep Dasar", "Prinsip Utama"],
            suggestedHours: 12,
            suggestedSemester: input.targetSemester as 1 | 2,
            learningObjectiveCode: `TP-${input.targetSemester}.1`,
            learningObjectiveDescription: "Mengidentifikasi konsep pokok dan prinsip utama",
          },
          {
            chapterNumber: 2,
            title: "Bab 2: Pendalaman & Analisis Materi",
            subTopics: ["Analisis Kasus", "Eksplorasi"],
            suggestedHours: 15,
            suggestedSemester: input.targetSemester as 1 | 2,
            learningObjectiveCode: `TP-${input.targetSemester}.2`,
            learningObjectiveDescription: "Mendalami materi dan menganalisis penerapan praktis",
          },
          {
            chapterNumber: 3,
            title: "Bab 3: Penerapan & Proyek Pembelajaran",
            subTopics: ["Proyek Kelompok", "Presentasi Hasil"],
            suggestedHours: 15,
            suggestedSemester: input.targetSemester as 1 | 2,
            learningObjectiveCode: `TP-${input.targetSemester}.3`,
            learningObjectiveDescription: "Menerapkan pembelajaran dalam proyek kontekstual",
          },
        ];
      }
    }

    const planPreview = deterministicDistributePlan(
      chapters,
      input.targetSemester,
      hoursPerWeek,
      effectiveWeeks
    );

    return {
      success: true,
      data: planPreview,
    };
  } catch (error: unknown) {
    console.error("[generateAcademicPlanAction Error]:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal meng-generate rencana akademik.",
    };
  }
}

/**
 * 3. Action: Refine Rencana Akademik dengan Instruksi Bahasa Alami Guru.
 */
export async function refineAcademicPlanAction(
  rawInput: RefineAcademicPlanInput
): Promise<{ success: boolean; data?: GeneratedAcademicPlanPreview; error?: string }> {
  try {
    const input = refinePlanSchema.parse(rawInput);
    await verifyActiveSchoolMembership();
    const { context } = await verifyTeachingContextAccess(input.teachingContextId);

    const profile = await prisma.academicContextProfile.findUnique({
      where: { teachingContextId: context.id },
    });

    const hoursPerWeek = profile?.hoursPerWeek || 3;
    const effectiveWeeks =
      input.targetSemester === 1
        ? profile?.effectiveWeeksSem1 || 18
        : profile?.effectiveWeeksSem2 || 16;

    const apiKey = process.env.GEMINI_API_KEY;
    const isTestOrMock = !apiKey || process.env.NODE_ENV === "test" || process.env.AI_PROVIDER === "mock";

    if (isTestOrMock) {
      // Return updated preview with simulated adjustment
      const updatedItems = input.currentPlanItems.map((item, idx) => {
        if (idx === 0) {
          return {
            ...item,
            notes: `${item.notes || ""}; Disesuaikan: ${input.instructions}`.trim(),
          };
        }
        return item;
      });

      const totalScheduledHours = updatedItems.reduce((acc, it) => acc + it.allocatedHours, 0);
      const totalAvailableHours = effectiveWeeks * hoursPerWeek;

      return {
        success: true,
        data: {
          targetSemester: input.targetSemester,
          effectiveWeeks,
          hoursPerWeek,
          totalAvailableHours,
          totalScheduledHours,
          isBalanced: totalScheduledHours === totalAvailableHours,
          items: updatedItems,
        },
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";

    const prompt = `Sesuaikan tabel matriks Program Semester (PROSEM) berikut berdasarkan instruksi guru:
Instruksi: "${input.instructions}"
Beban Jam: ${hoursPerWeek} JP/minggu, Total Pekan Efektif: ${effectiveWeeks} pekan. Target Total JP: ${effectiveWeeks * hoursPerWeek} JP.

Tabel saat ini:
${JSON.stringify(input.currentPlanItems, null, 2)}

Hasilkan JSON array terstruktur dengan format yang sama persis seperti tabel saat ini dengan field weeklyDistribution [{ month, week, hours }]. Total jam semua item harus seimbang dengan target total JP.`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction:
          "Anda adalah asisten kurikulum ahli. HANYA hasilkan JSON array yang valid tanpa teks pembuka atau markdown formatting.",
        responseMimeType: "application/json",
      },
    });

    const rawOutput = response.text || "[]";
    const adjustedItems = parseJsonFromAi<GeneratedAcademicPlanPreview["items"]>(rawOutput);

    const totalScheduledHours = adjustedItems.reduce((acc, it) => acc + it.allocatedHours, 0);
    const totalAvailableHours = effectiveWeeks * hoursPerWeek;

    return {
      success: true,
      data: {
        targetSemester: input.targetSemester,
        effectiveWeeks,
        hoursPerWeek,
        totalAvailableHours,
        totalScheduledHours,
        isBalanced: totalScheduledHours === totalAvailableHours,
        items: adjustedItems,
      },
    };
  } catch (error: unknown) {
    console.error("[refineAcademicPlanAction Error]:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal menyesuaikan rencana akademik.",
    };
  }
}

/**
 * 4. Action: Menerapkan & Menyimpan Matriks Preview ke Database (Auto-Sync TP & Prosem).
 */
export async function applyAcademicPlanPreviewAction(input: {
  teachingContextId: string;
  planPreview: GeneratedAcademicPlanPreview;
}) {
  const { context } = await verifyTeachingContextAccess(input.teachingContextId);
  const { planPreview } = input;

  await prisma.$transaction(async (tx) => {
    // 1. Soft-archive existing active plan items for this context and semester
    const existingItems = await tx.academicPlanItem.findMany({
      where: {
        teachingContextId: context.id,
        status: EntityStatus.ACTIVE,
      },
      select: {
        id: true,
        targetSemester: true,
      },
    });

    const idsToArchive = existingItems
      .filter((it) => (it as { id: string; targetSemester?: number }).targetSemester === undefined || it.targetSemester === planPreview.targetSemester)
      .map((it) => it.id);

    if (idsToArchive.length > 0) {
      await tx.academicPlanItem.updateMany({
        where: {
          id: { in: idsToArchive },
        },
        data: { status: EntityStatus.ARCHIVED },
      });
    }

    // 2. Iterate through preview items
    for (let i = 0; i < planPreview.items.length; i++) {
      const item = planPreview.items[i];
      let objectiveId = item.learningObjectiveId || null;

      // If it is regular material and has TP description, upsert LearningObjective
      if (item.category === PlanItemCategory.REGULAR_MATERIAL) {
        if (!objectiveId && item.learningObjectiveDescription) {
          const newObjective = await tx.learningObjective.create({
            data: {
              teachingContextId: context.id,
              code: item.learningObjectiveCode || `TP-${planPreview.targetSemester}.${i + 1}`,
              description: item.learningObjectiveDescription || item.title,
              targetSemester: planPreview.targetSemester,
              allocatedHours: item.allocatedHours,
              orderIndex: i,
              status: EntityStatus.ACTIVE,
            },
          });
          objectiveId = newObjective.id;
        }
      }

      // Create AcademicPlanItem (PROSEM)
      await tx.academicPlanItem.create({
        data: {
          teachingContextId: context.id,
          learningObjectiveId: objectiveId,
          planType: AcademicPlanType.PROSEM,
          category: item.category,
          title: item.title,
          targetSemester: planPreview.targetSemester,
          allocatedHours: item.allocatedHours,
          notes: item.notes || null,
          weeklyDistribution: item.weeklyDistribution
            ? (item.weeklyDistribution as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          orderIndex: i,
          status: EntityStatus.ACTIVE,
        },
      });

      // Also create/update corresponding PROTA item for the material
      await tx.academicPlanItem.create({
        data: {
          teachingContextId: context.id,
          learningObjectiveId: objectiveId,
          planType: AcademicPlanType.PROTA,
          category: item.category,
          title: item.title,
          targetSemester: planPreview.targetSemester,
          allocatedHours: item.allocatedHours,
          notes: item.notes || null,
          orderIndex: i,
          status: EntityStatus.ACTIVE,
        },
      });
    }
  });

  revalidatePath(`/akademik`);
  revalidatePath(`/kelas/${context.id}`);
  revalidatePath(`/kelas/${context.id}/akademik`);

  return { success: true };
}
