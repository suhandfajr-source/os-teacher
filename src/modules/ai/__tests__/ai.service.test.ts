import { describe, it, expect } from "vitest";
import {
  buildSafeContextPack,
  formatContextSummary,
  constructGenerationPrompt,
  constructRefinementPrompt,
  validateAiOutput,
} from "../ai.service";
import { SafeContextPack } from "../ai.types";

describe("Stage 06 AI Service — Context Packing, Prompts & Output Validation", () => {
  describe("buildSafeContextPack", () => {
    it("builds structural context only when historical opt-in is false", () => {
      const pack = buildSafeContextPack(
        {
          subject: { name: "Matematika" },
          class: { name: "VIII A", gradeLevel: "8" },
          academicPeriod: { year: "2026/2027", semester: "1" },
          recentSessions: [
            { plannedTopic: "Aljabar Dasar", actualTopic: "Operasi Aljabar" },
          ],
          recentAssignments: [{ title: "Latihan Aljabar 1" }],
        },
        false // Do NOT include historical topics
      );

      expect(pack.subjectName).toBe("Matematika");
      expect(pack.className).toBe("VIII A");
      expect(pack.gradeLevel).toBe("8");
      expect(pack.academicPeriod).toEqual({ year: "2026/2027", semester: "1" });
      expect(pack.recentTopics).toBeUndefined();
    });

    it("includes recent session and assignment topics only when explicitly opted in", () => {
      const pack = buildSafeContextPack(
        {
          subject: { name: "IPA Terpadu" },
          class: { name: "VII B", gradeLevel: "7" },
          academicPeriod: { year: "2026/2027", semester: "1" },
          recentSessions: [
            { plannedTopic: "Sistem Organ", actualTopic: "Sistem Pencernaan" },
            { plannedTopic: "Zat Aditif", actualTopic: null },
          ],
          recentAssignments: [{ title: "Laporan Praktikum Pencernaan" }],
        },
        true // Explicit opt-in
      );

      expect(pack.recentTopics).toBeDefined();
      expect(pack.recentTopics).toHaveLength(3);
      expect(pack.recentTopics![0]).toEqual({
        type: "SESSION",
        topic: "Sistem Pencernaan",
      });
      expect(pack.recentTopics![1]).toEqual({
        type: "SESSION",
        topic: "Zat Aditif",
      });
      expect(pack.recentTopics![2]).toEqual({
        type: "ASSIGNMENT",
        topic: "Laporan Praktikum Pencernaan",
      });
    });

    it("STRICT PRIVACY GUARANTEE: Never includes student PII, scores, attendance or monitoring data", () => {
      const sampleContextInput = {
        subject: { name: "Bahasa Indonesia" },
        class: { name: "IX C", gradeLevel: "9" },
        academicPeriod: { year: "2026/2027", semester: "1" },
      };

      const pack = buildSafeContextPack(sampleContextInput, false);
      const json = JSON.stringify(pack);

      // Verify absence of sensitive student fields
      expect(json).not.toContain("fullName");
      expect(json).not.toContain("nis");
      expect(json).not.toContain("finalScore");
      expect(json).not.toContain("rawScore");
      expect(json).not.toContain("normalizedScore");
      expect(json).not.toContain("remedial");
      expect(json).not.toContain("monitoringNote");
      expect(json).not.toContain("requiresFollowUp");
      expect(json).not.toContain("attendance");
    });
  });

  describe("formatContextSummary", () => {
    it("returns isContextAware=false when no context pack is provided", () => {
      const summary = formatContextSummary(undefined);
      expect(summary.isContextAware).toBe(false);
      expect(summary.subjectName).toBeUndefined();
    });

    it("matches exactly the packaged context sent to AI", () => {
      const pack: SafeContextPack = {
        subjectName: "Fisika",
        className: "X IPA 1",
        gradeLevel: "10",
        academicPeriod: { year: "2026/2027", semester: "Ganjil" },
        recentTopics: [
          { type: "SESSION", topic: "Vektor Posisi" },
          { type: "ASSIGNMENT", topic: "Tugas Gerak Lurus" },
        ],
      };

      const summary = formatContextSummary(pack);
      expect(summary.isContextAware).toBe(true);
      expect(summary.subjectName).toBe("Fisika");
      expect(summary.className).toBe("X IPA 1");
      expect(summary.gradeLevel).toBe("10");
      expect(summary.academicPeriod).toBe("T.A. 2026/2027 - Sem. Ganjil");
      expect(summary.includedHistoricalTopics).toEqual([
        "Pertemuan: Vektor Posisi",
        "Tugas: Tugas Gerak Lurus",
      ]);
    });
  });

  describe("constructGenerationPrompt", () => {
    it("constructs full generation prompt with tone and context", () => {
      const prompt = constructGenerationPrompt({
        contentType: "LESSON_PLAN",
        topic: "Hukum Newton",
        instruction: "Sertakan eksperimen sederhana dengan balon",
        tone: "CONCISE",
        contextPack: {
          subjectName: "IPA",
          className: "VIII A",
          gradeLevel: "8",
          academicPeriod: { year: "2026/2027", semester: "1" },
        },
      });

      expect(prompt).toContain("JENIS KONTEN: Rencana Aktivitas Pembelajaran (LESSON_PLAN)");
      expect(prompt).toContain("TOPIK / POKOK BAHASAN: Hukum Newton");
      expect(prompt).toContain("GAYA PENYAMPAIAN: Ringkas dan langsung pada inti");
      expect(prompt).toContain("INSTRUKSI TAMBAHAN GURU:\nSertakan eksperimen sederhana dengan balon");
      expect(prompt).toContain("Mata Pelajaran: IPA");
      expect(prompt).toContain("Kelas: VIII A (Tingkat 8)");
    });
  });

  describe("constructRefinementPrompt", () => {
    it("constructs refinement prompt containing current draft and teacher modification instruction", () => {
      const prompt = constructRefinementPrompt({
        contentType: "TASK_INSTRUCTION",
        currentTitle: "Tugas Mengamati Cuaca",
        currentContent: "Amati cuaca selama 7 hari.",
        refinementInstruction: "Tambahkan tabel pengamatan suhu dan kelembapan",
      });

      expect(prompt).toContain("JENIS KONTEN: Draft Instruksi Tugas");
      expect(prompt).toContain("Judul: Tugas Mengamati Cuaca");
      expect(prompt).toContain("Amati cuaca selama 7 hari.");
      expect(prompt).toContain('Instruksi Perubahan: "Tambahkan tabel pengamatan suhu dan kelembapan"');
    });
  });

  describe("validateAiOutput", () => {
    it("successfully parses valid markdown output with header", () => {
      const rawText = `# Rencana Pembelajaran Fisika\n\n## 1. Pendahuluan\nGuru menyapa siswa.`;
      const result = validateAiOutput(rawText);

      expect(result.title).toBe("Rencana Pembelajaran Fisika");
      expect(result.content).toBe(rawText);
    });

    it("extracts clean title from non-header first line", () => {
      const rawText = `**Materi Fotosintesis Lengkap**\n\nFotosintesis adalah proses...`;
      const result = validateAiOutput(rawText);

      expect(result.title).toBe("Materi Fotosintesis Lengkap");
    });

    it("throws an error on empty or whitespace response", () => {
      expect(() => validateAiOutput("")).toThrow("Output AI kosong atau tidak valid.");
      expect(() => validateAiOutput("   \n  ")).toThrow("Output AI kosong atau tidak valid.");
    });

    it("throws an error on malformed or overly short response", () => {
      expect(() => validateAiOutput("#\nKonten pembelajaran lengkap tapi judul kosong")).toThrow(
        "Output AI tidak memiliki judul yang valid."
      );
      expect(() => validateAiOutput("No")).toThrow("Output AI terlalu pendek atau tidak lengkap.");
      expect(() => validateAiOutput("Judul\n1")).toThrow("Output AI terlalu pendek atau tidak lengkap.");
    });
  });
});
