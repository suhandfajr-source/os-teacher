"use server";

/**
 * QUIZ ONLINE MODULE — AI Question Generation & Conversion
 *
 * Two paths into structured MCQs:
 * 1. generateQuizQuestionsAction — AI generates fresh questions from a topic
 * 2. convertDocumentToQuizAction — AI extracts MCQs from a pasted document
 *
 * Both return validated ExtractedQuestion[] ready for the quiz builder.
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

/** Shared: extracts & validates a JSON question array from AI output. */
function parseAiQuestionsJson(content: string, emptyMessage: string): {
  success: boolean;
  data?: { questions: ExtractedQuestion[] };
  error?: string;
} {
  // Extract the JSON array from the response (tolerate markdown fences)
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return { success: false, error: "AI tidak menghasilkan format soal yang valid. Coba lagi." };
  }

  let rawQuestions: unknown[];
  try {
    rawQuestions = JSON.parse(jsonMatch[0]) as unknown[];
  } catch {
    return { success: false, error: "Gagal membaca hasil AI. Silakan coba lagi." };
  }

  const questions: ExtractedQuestion[] = [];

  for (const raw of rawQuestions) {
    const rawRecord = raw as Record<string, unknown>;
    const rawOptions = Array.isArray(rawRecord.options) ? (rawRecord.options as unknown[]) : [];
    const candidate = {
      text: String(rawRecord.text ?? ""),
      options: rawOptions.map((o) => String(o)),
      correctIndex: Number(rawRecord.correctIndex ?? 0),
      points: Number(rawRecord.points ?? 1) || 1,
      explanation: rawRecord.explanation ? String(rawRecord.explanation as string) : undefined,
    };

    const validated = quizQuestionSchema.safeParse(candidate);
    if (validated.success && validated.data.correctIndex < validated.data.options.length) {
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
    const { topic, count, subjectName, gradeLevel } = generateInputSchema.parse(input);
    await verifyActiveSchoolMembership();

    const provider = getAiContentProvider();

    const prompt = [
      `Buat ${count} soal pilihan ganda untuk quiz sekolah.`,
      `Mata pelajaran: ${subjectName ?? "umum"}.`,
      gradeLevel ? `Jenjang kelas: ${gradeLevel}.` : "",
      `Topik/bahan: ${topic}`,
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

    const result = await provider.generate({
      contentType: "TASK_INSTRUCTION",
      topic: `Generate ${count} soal PG: ${topic}`,
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
    const { documentText, expectedCount } = convertInputSchema.parse(input);
    await verifyActiveSchoolMembership();

    const provider = getAiContentProvider();

    const target = expectedCount ? `Sekitar ${expectedCount} soal.` : "Sebanyak mungkin soal valid.";
    const prompt = [
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
      documentText,
    ].join("\n");

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
