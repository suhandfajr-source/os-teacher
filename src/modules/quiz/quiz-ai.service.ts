/**
 * QUIZ ONLINE MODULE — Pure AI Prompt Builders & Parser Logic
 * (Non-server file, can export sync helpers and be tested in Vitest)
 */

import { quizQuestionSchema } from "./quiz.types";

export interface ExtractedQuestion {
  text: string;
  options: string[];
  correctIndex: number;
  points: number;
  explanation?: string;
}

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
