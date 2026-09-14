import { describe, it, expect } from "vitest";
import {
  buildGenerateQuestionsPrompt,
  buildConvertDocumentPrompt,
  parseAiQuestionsJson,
  parseMarkdownOrTextQuestions,
} from "../quiz-ai.service";

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

  describe("parseMarkdownOrTextQuestions fallback parser", () => {
    it("parses numbered questions with inline answer keys", () => {
      const doc = `
# Soal Ulangan Pendidikan Agama Islam: Kisah Nabi Ibrahim

1. Nabi Ibrahim a.s. merupakan rasul yang bergelar Ulul Azmi karena...
A. Memiliki mukjizat membelah lautan
B. Memiliki ketabahan luar biasa menghadapi ujian
C. Menguasai angin dan bahasa hewan
D. Memiliki kitab suci tertebal
Kunci: B

2. Raja yang berkuasa pada zaman Nabi Ibrahim a.s. bernama...
A. Raja Fir'aun
B. Raja Namrud
C. Raja Jalut
D. Raja Abrahah
Jawaban: B
Pembahasan: Raja Namrud adalah penguasa tiran di Babilonia.
      `;

      const questions = parseMarkdownOrTextQuestions(doc);
      expect(questions).toHaveLength(2);
      expect(questions[0].text).toContain("Nabi Ibrahim a.s. merupakan rasul");
      expect(questions[0].options).toHaveLength(4);
      expect(questions[0].correctIndex).toBe(1); // 'B' => 1
      expect(questions[1].correctIndex).toBe(1); // 'B' => 1
      expect(questions[1].explanation).toContain("Raja Namrud");
    });

    it("parses questions with global answer key section at the bottom", () => {
      const doc = `
1. Siapakah bapak para nabi?
A. Nabi Adam
B. Nabi Nuh
C. Nabi Ibrahim
D. Nabi Muhammad

2. Siapakah putra Nabi Ibrahim yang diperintahkan untuk disembelih?
A. Nabi Ishaq
B. Nabi Ismail
C. Nabi Ya'qub
D. Nabi Yusuf

Kunci Jawaban:
1. C
2. B
      `;

      const questions = parseMarkdownOrTextQuestions(doc);
      expect(questions).toHaveLength(2);
      expect(questions[0].correctIndex).toBe(2); // C => 2
      expect(questions[1].correctIndex).toBe(1); // B => 1
    });

    it("parseAiQuestionsJson falls back to markdown parser when AI returns markdown document instead of JSON array", () => {
      const doc = `
# Bank Soal Ulangan

1. Organ respirasi utama manusia adalah...
A. Jantung
B. Paru-paru
C. Lambung
D. Ginjal
Kunci: B

2. Fungsi leukosit dalam darah adalah...
A. Mengangkut oksigen
B. Membekukan darah
C. Melawan infeksi penyakit
D. Mengedarkan sari makanan
Kunci: C
      `;

      const res = parseAiQuestionsJson(doc);
      expect(res.success).toBe(true);
      expect(res.data?.questions).toHaveLength(2);
      expect(res.data?.questions[0].correctIndex).toBe(1);
      expect(res.data?.questions[1].correctIndex).toBe(2);
    });
  });
});
