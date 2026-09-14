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
 * Robust fallback parser for markdown or plain text numbered questions.
 * Handles patterns like:
 * "1. Teks soal...\nA. opsi 1\nB. opsi 2\nKunci: B" or separate answer key at the bottom.
 */
export function parseMarkdownOrTextQuestions(content: string): ExtractedQuestion[] {
  const questions: ExtractedQuestion[] = [];
  if (!content || !content.trim()) return questions;

  // 1. Check for global answer key section at the bottom (e.g. "Kunci Jawaban:\n1. A\n2. B...")
  const globalKeyMap = new Map<number, number>();
  const globalKeySectionMatch = content.match(
    /(?:kunci\s*jawaban|kunci\s*:|kunci\s*soal)[\s\S]*$/i
  );
  if (globalKeySectionMatch) {
    const keySectionText = globalKeySectionMatch[0];
    const keyPairs = keySectionText.matchAll(/(?:(?:No\.?\s*)?(\d+)[\.\):\s-]+([A-Ea-e]))/gi);
    for (const match of keyPairs) {
      const qNum = Number(match[1]);
      const letter = match[2].toUpperCase();
      const idx = letter.charCodeAt(0) - 65;
      if (idx >= 0 && idx <= 5) {
        globalKeyMap.set(qNum, idx);
      }
    }
  }

  // 2. Split into numbered question blocks: e.g. "1. ", "2. ", "1) ", "No. 1"
  const rawBlocks = content.split(/(?:^|\n)(?=(?:No\.?\s*)?\d+[\.\)]\s+)/i);

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const numMatch = trimmed.match(/^(?:No\.?\s*)?(\d+)[\.\)]\s+([\s\S]*)/i);
    if (!numMatch) continue;

    const qNum = Number(numMatch[1]);
    const body = numMatch[2].trim();

    const optionMatches = Array.from(
      body.matchAll(/(?:^|\n)\s*([A-Ea-e])[\.\)]\s*([^\n]+)/g)
    );

    if (optionMatches.length < 2) continue;

    const firstOptionIndex = optionMatches[0].index ?? body.indexOf(optionMatches[0][0]);
    const questionText = body.slice(0, firstOptionIndex).trim().replace(/^#+\s*/, "");

    if (!questionText) continue;

    const options: string[] = [];
    const optionLetters: string[] = [];
    for (const m of optionMatches) {
      const letter = m[1].toUpperCase();
      const text = m[2].trim();
      if (text) {
        options.push(text);
        optionLetters.push(letter);
      }
    }

    if (options.length < 2) continue;

    let correctIndex: number | null = null;
    const inlineKeyMatch = body.match(/(?:kunci|jawaban)[\s:]*([A-Ea-e])/i);
    if (inlineKeyMatch) {
      const letter = inlineKeyMatch[1].toUpperCase();
      const foundIdx = optionLetters.indexOf(letter);
      if (foundIdx !== -1) {
        correctIndex = foundIdx;
      }
    }

    if (correctIndex === null && globalKeyMap.has(qNum)) {
      const mappedIdx = globalKeyMap.get(qNum)!;
      if (mappedIdx < options.length) {
        correctIndex = mappedIdx;
      }
    }

    if (correctIndex === null) {
      correctIndex = 0;
    }

    const explanationMatch = body.match(/(?:pembahasan|alasan|penjelasan)[\s:]*([^\n]+)/i);
    const explanation = explanationMatch ? explanationMatch[1].trim() : undefined;

    const candidate = {
      text: questionText,
      options,
      correctIndex,
      points: 1,
      explanation,
    };

    const validated = quizQuestionSchema.safeParse(candidate);
    if (validated.success) {
      questions.push(validated.data);
    }
  }

  return questions;
}

/**
 * Shared: extracts & validates a JSON question array from raw AI output.
 * Tolerates markdown code blocks (```json ... ```), sanitizes blank options,
 * and falls back to text/markdown question parser if no JSON array is found.
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
  if (jsonMatch) {
    try {
      const rawQuestions = JSON.parse(jsonMatch[0]) as unknown[];
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

      if (questions.length > 0) {
        return { success: true, data: { questions } };
      }
    } catch {
      // JSON parse failed — fall through to text parser fallback
    }
  }

  // Fallback: parse markdown or plain text numbered questions
  const textQuestions = parseMarkdownOrTextQuestions(content);
  if (textQuestions.length > 0) {
    return { success: true, data: { questions: textQuestions } };
  }

  return { success: false, error: emptyMessage };
}
