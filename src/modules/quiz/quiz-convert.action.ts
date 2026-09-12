"use server";

/**
 * QUIZ ONLINE MODULE — AI Conversion
 * Converts a teacher's AI-generated (or pasted) question document into
 * structured multiple-choice questions using the existing AI provider.
 */

import { z } from "zod";
import { verifyActiveSchoolMembership } from "@/lib/authorization";
import { getAiContentProvider } from "@/modules/ai/providers/ai-provider.factory";
import { quizQuestionSchema } from "./quiz.types";

const convertInputSchema = z.object({
  documentText: z.string().min(50, "Dokumen soal terlalu pendek").max(50_000),
  expectedCount: z.number().int().min(1).max(50).optional(),
});

export interface ExtractedQuestion {
  text: string;
  options: string[];
  correctIndex: number;
  points: number;
  explanation?: string;
}

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

    // Extract the JSON array from the response (tolerate markdown fences)
    const jsonMatch = result.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { success: false, error: "AI tidak menghasilkan format soal yang valid. Coba lagi." };
    }

    const rawQuestions = JSON.parse(jsonMatch[0]) as unknown[];
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
      return { success: false, error: "Tidak ditemukan soal pilihan ganda yang valid di dokumen ini." };
    }

    return { success: true, data: { questions } };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengonversi dokumen";
    return { success: false, error: message };
  }
}
