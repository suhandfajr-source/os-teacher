"use server";

/**
 * QUIZ ONLINE MODULE — AI Question Generation & Conversion
 *
 * Centralized prompt building and robust JSON output validation for:
 * 1. generateQuizQuestionsAction — AI generates fresh questions from a topic
 * 2. convertDocumentToQuizAction — AI extracts MCQs from a pasted document
 */

import { z } from "zod";
import { verifyActiveSchoolMembership } from "@/lib/authorization";
import { getAiContentProvider } from "@/modules/ai/providers/ai-provider.factory";
import { quizQuestionSchema } from "./quiz.types";

export interface ExtractedQuestion {
  text: string;
  options: string[];
  correctIndex: number;
  points: number;
  explanation?: string;
}

export const generateInputSchema = z.object({
  topic: z.string().min(3, "Topik terlalu pendek").max(300),
  count: z.number().int().min(1).max(30).default(10),
  subjectName: z.string().max(120).optional(),
  gradeLevel: z.string().max(20).optional(),
});

export const convertInputSchema = z.object({
  documentText: z.string().min(50, "Dokumen soal terlalu pendek").max(50_000),
  expectedCount: z.number().int().min(1).max(50).optional(),
});

/** Pure helper: constructs the prompt for generating new MCQ questions from topic. */
export function buildGenerateQuestionsPrompt(params: {
  topic: string;
  count: number;
  subjectName?: string;
  gradeLevel?: string;
}): string {
  return [
    `Buat ${params.count} soal pilihan ganda untuk quiz sekolah.`,
    `Mata pelajaran: ${params.subjectName ?? "umum"}.`,
    params.gradeLevel ? `Jenjang kelas: ${params.gradeLevel}.` : "",
    `Topik/bahan: ${params.topic}`,
    "",
    "FORMAT OUTPUT — array JSON murni (tanpa pembungkus markdown):",
    '[{"text": "teks soal", "options": ["opsi1", "opsi2", "opsi3", "opsi4"], "correctIndex": 0, "points": 1, "explanation": "alasan singkat"}]',
    "",
    "ATURAN:",
    "1. Soal berstandar kurikulum, bahasa Indonesia yang baik, sesuai jenjang.",
    "2. 4 opsi jawaban per soal, hanya satu benar, distraktor yang masuk akal.",
    "3. correctIndex = indeks jawaban benar (mulai dari 0), variasikan posisinya.",
    "4. explanation = penjelasan singkat mengapa jawaban itu benar.",
    "5. Output HANYA array JSON, tanpa teks lain.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Pure helper: constructs the prompt for converting a text document into MCQs. */
export function buildConvertDocumentPrompt(params: {
  documentText: string;
  expectedCount?: number;
}): string {
  const target = params.expectedCount
    ? `Sekitar ${params.expectedCount} soal.`
    : "Sebanyak mungkin soal valid.";
  return [
    "Konversikan dokumen soal pilihan ganda berikut menjadi JSON murni (tanpa pembungkus markdown).",
    target,
    "",
    "FORMAT OUTPUT — array JSON dengan elemen:",
    '{"text": "teks soal", "options": ["A", "B", "C", "D"], "correctIndex": 0, "points": 1, "explanation": "alasan singkat"}',
    "",
    "ATURAN:",
    "1. Hanya soal pilihan ganda yang jelas jawabannya. Abaikan soal essay/isian.",
    "2. correctIndex = indeks opsi jawaban benar (mulai dari 0).",
    "3. Hilangkan prefiks huruf (A., B., dst) dari isi opsi.",
    "4. Jika ada kunci jawaban di bagian akhir dokumen, gunakan itu.",
    "5. Jika ada pembahasan, masukkan ke explanation.",
    "6. Output HANYA array JSON, tanpa teks lain.",
    "",
    "DOKUMEN SOAL:",
    params.documentText,
  ].join("\n");
}

/**
 * Shared: extracts & validates a JSON question array from raw AI output.
 * Tolerates markdown code blocks (```json ... ```) and sanitizes blank options.
 */
export function parseAiQuestionsJson(
  content: string,
  emptyMessage: string = "Tidak ada soal valid yang dihasilkan."
): {
  success: boolean;
  data?: { questions: ExtractedQuestion[] };
  error?: string;
} {
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return { success: false, error: "AI tidak menghasilkan format soal yang valid. Coba lagi." };
  }

  let rawQuestions: unknown[];
  try {
    rawQuestions = JSON.parse(jsonMatch[0]) as unknown[];
  } catch {
    return { success: false, error: "Gagal membaca format JSON dari AI. Silakan coba lagi." };
  }

  const questions: ExtractedQuestion[] = [];

  for (const raw of rawQuestions) {
    if (typeof raw !== "object" || raw === null) continue;
    const rawRecord = raw as Record<string, unknown>;
    const rawOptions = Array.isArray(rawRecord.options) ? (rawRecord.options as unknown[]) : [];

    // Filter out blank or whitespace-only options
    const cleanedOptions = rawOptions
      .map((o) => String(o ?? "").trim())
      .filter((o) => o.length > 0);

    if (cleanedOptions.length < 2) continue;

    const candidate = {
      text: String(rawRecord.text ?? "").trim(),
      options: cleanedOptions,
      correctIndex: Number(rawRecord.correctIndex ?? 0),
      points: Number(rawRecord.points ?? 1) || 1,
      explanation: rawRecord.explanation ? String(rawRecord.explanation as string).trim() : undefined,
    };

    const validated = quizQuestionSchema.safeParse(candidate);
    if (
      validated.success &&
      validated.data.text.length > 0 &&
      validated.data.correctIndex < validated.data.options.length
    ) {
      questions.push(validated.data);
    }
  }

  if (questions.length === 0) {
    return { success: false, error: emptyMessage };
  }

  return { success: true, data: { questions } };
}

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
