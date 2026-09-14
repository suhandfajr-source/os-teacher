"use server";

/**
 * QUIZ ONLINE MODULE — AI Question Generation & Conversion Server Actions
 */

import { z } from "zod";
import { verifyActiveSchoolMembership } from "@/lib/authorization";
import { getAiContentProvider } from "@/modules/ai/providers/ai-provider.factory";
import {
  ExtractedQuestion,
  buildGenerateQuestionsPrompt,
  buildConvertDocumentPrompt,
  parseAiQuestionsJson,
} from "./quiz-ai.service";

export type { ExtractedQuestion };

const generateInputSchema = z.object({
  topic: z.string().min(3, "Topik terlalu pendek").max(300),
  count: z.number().int().min(1).max(30).default(10),
  subjectName: z.string().max(120).optional(),
  gradeLevel: z.string().max(20).optional(),
});

const convertInputSchema = z.object({
  documentText: z.string().min(50, "Dokumen soal terlalu pendek").max(50_000),
  expectedCount: z.number().int().min(1).max(50).optional(),
});

/**
 * Generates brand-new MCQ questions directly from a topic — no document
 * roundtrip needed. The AI returns structured JSON that we validate.
 */
export async function generateQuizQuestionsAction(input: unknown): Promise<{
  success: boolean;
  data?: { questions: ExtractedQuestion[] };
  error?: string;
}> {
  try {
    const params = generateInputSchema.parse(input);
    await verifyActiveSchoolMembership();

    const provider = getAiContentProvider();
    const prompt = buildGenerateQuestionsPrompt(params);

    const result = await provider.generate({
      contentType: "TASK_INSTRUCTION",
      topic: `Generate ${params.count} soal PG: ${params.topic}`,
      instruction: prompt,
      tone: "CONCISE",
    });

    return parseAiQuestionsJson(result.content, "Tidak ada soal valid yang dihasilkan. Coba lagi.");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal generate soal";
    return { success: false, error: message };
  }
}

/**
 * Converts a teacher's pasted question document into structured MCQs.
 */
export async function convertDocumentToQuizAction(input: unknown): Promise<{
  success: boolean;
  data?: { questions: ExtractedQuestion[] };
  error?: string;
}> {
  try {
    const params = convertInputSchema.parse(input);
    await verifyActiveSchoolMembership();

    const provider = getAiContentProvider();
    const prompt = buildConvertDocumentPrompt(params);

    const result = await provider.generate({
      contentType: "TASK_INSTRUCTION",
      topic: "Konversi soal pilihan ganda ke JSON",
      instruction: prompt,
      tone: "CONCISE",
    });

    return parseAiQuestionsJson(
      result.content,
      "Tidak ditemukan soal pilihan ganda yang valid di dokumen ini."
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengonversi dokumen";
    return { success: false, error: message };
  }
}
