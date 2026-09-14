import { describe, it, expect } from "vitest";
import {
  buildGenerateQuestionsPrompt,
  buildConvertDocumentPrompt,
  parseAiQuestionsJson,
} from "../quiz-convert.action";

describe("quiz-convert prompt builders & parser (Sprint 1.3)", () => {
  it("buildGenerateQuestionsPrompt includes topic, count, subject, and gradeLevel", () => {
    const prompt = buildGenerateQuestionsPrompt({
      topic: "Fotosintesis",
      count: 10,
      subjectName: "IPA",
      gradeLevel: "VII",
    });

    expect(prompt).toContain("Buat 10 soal pilihan ganda");
    expect(prompt).toContain("Mata pelajaran: IPA");
    expect(prompt).toContain("Jenjang kelas: VII");
    expect(prompt).toContain("Topik/bahan: Fotosintesis");
  });

  it("buildConvertDocumentPrompt formats instructions cleanly", () => {
    const prompt = buildConvertDocumentPrompt({
      documentText: "1. Soal satu...\nA. Opsi 1\nB. Opsi 2\nKunci: A",
      expectedCount: 5,
    });

    expect(prompt).toContain("Konversikan dokumen soal pilihan ganda berikut");
    expect(prompt).toContain("Sekitar 5 soal");
    expect(prompt).toContain("1. Soal satu...");
  });

  it("parseAiQuestionsJson parses valid JSON and markdown code blocks", () => {
    const mockAiOutput = `
Berikut adalah soal yang dibuat:
\`\`\`json
[
  {
    "text": "Apa organ pemompa darah manusia?",
    "options": ["Jantung", "Paru-paru", "Ginjal", "Hati"],
    "correctIndex": 0,
    "points": 1,
    "explanation": "Jantung adalah organ pemompa darah utama."
  }
]
\`\`\`
    `;

    const res = parseAiQuestionsJson(mockAiOutput);
    expect(res.success).toBe(true);
    expect(res.data?.questions).toHaveLength(1);
    expect(res.data?.questions[0].text).toBe("Apa organ pemompa darah manusia?");
    expect(res.data?.questions[0].correctIndex).toBe(0);
  });

  it("parseAiQuestionsJson sanitizes blank or whitespace-only options", () => {
    const mockAiOutput = JSON.stringify([
      {
        text: "Soal dengan opsi kosong",
        options: ["Opsi A", "   ", "Opsi C", ""],
        correctIndex: 1, // Points to original index 1, but after cleaning options are ["Opsi A", "Opsi C"]
        points: 1,
      },
    ]);

    const res = parseAiQuestionsJson(mockAiOutput);
    expect(res.success).toBe(true);
    const q = res.data?.questions[0];
    expect(q?.options).toEqual(["Opsi A", "Opsi C"]);
  });

  it("parseAiQuestionsJson filters out questions with fewer than 2 valid options", () => {
    const mockAiOutput = JSON.stringify([
      {
        text: "Soal rusak",
        options: ["Hanya satu opsi valid", "  "],
        correctIndex: 0,
      },
    ]);

    const res = parseAiQuestionsJson(mockAiOutput);
    expect(res.success).toBe(false);
  });

  it("parseAiQuestionsJson handles invalid JSON gracefully", () => {
    const mockAiOutput = "Maaf, saya tidak bisa membuat soal.";
    const res = parseAiQuestionsJson(mockAiOutput);
    expect(res.success).toBe(false);
  });
});
