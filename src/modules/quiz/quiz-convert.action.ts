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
  parseMarkdownOrTextQuestions,
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

    let rawOutput: string;
    if (typeof provider.generateStructured === "function") {
      rawOutput = await provider.generateStructured(
        prompt,
        "Anda adalah asisten AI pembuat soal ujian profesional untuk KLASSA di Indonesia. " +
        "Tugas Anda adalah menghasilkan soal pilihan ganda sekolah dalam format array JSON murni."
      );
    } else {
      const result = await provider.generate({
        contentType: "TASK_INSTRUCTION",
        topic: `Generate ${params.count} soal PG: ${params.topic}`,
        instruction: prompt,
        tone: "CONCISE",
      });
      rawOutput = result.content;
    }

    return parseAiQuestionsJson(rawOutput, "Tidak ada soal valid yang dihasilkan. Coba lagi.");
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

    // Fast path: if the pasted document is already structured text (e.g. 1. Soal... A. B. C. D. Kunci: A),
    // parse it directly without waiting for an AI roundtrip.
    const preParsed = parseMarkdownOrTextQuestions(params.documentText);
    if (preParsed.length >= 2) {
      return { success: true, data: { questions: preParsed } };
    }

    const provider = getAiContentProvider();
    const prompt = buildConvertDocumentPrompt(params);

    let rawOutput: string;
    if (typeof provider.generateStructured === "function") {
      rawOutput = await provider.generateStructured(
        prompt,
        "Anda adalah asisten AI konversi soal untuk KLASSA. Ekstrak soal pilihan ganda menjadi array JSON murni."
      );
    } else {
      const result = await provider.generate({
        contentType: "TASK_INSTRUCTION",
        topic: "Konversi soal pilihan ganda ke JSON",
        instruction: prompt,
        tone: "CONCISE",
      });
      rawOutput = result.content;
    }

    return parseAiQuestionsJson(
      rawOutput,
      "Tidak ditemukan soal pilihan ganda yang valid di dokumen ini."
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengonversi dokumen";
    return { success: false, error: message };
  }
}
