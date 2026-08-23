import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockAiContentProvider } from "../providers/mock.provider";
import { getAiContentProvider, setAiContentProviderForTest } from "../providers/ai-provider.factory";

describe("Stage 06 AI Provider Abstraction & Error Handling", () => {
  let mockProvider: MockAiContentProvider;

  beforeEach(() => {
    mockProvider = new MockAiContentProvider();
  });

  afterEach(() => {
    setAiContentProviderForTest(null);
  });

  it("generates deterministic draft for LESSON_PLAN", async () => {
    const res = await mockProvider.generate({
      contentType: "LESSON_PLAN",
      topic: "Fotosintesis",
      contextPack: {
        subjectName: "Biologi",
        className: "VII A",
        gradeLevel: "7",
        academicPeriod: { year: "2026/2027", semester: "1" },
      },
    });

    expect(res.title).toContain("Rencana Pembelajaran: Fotosintesis");
    expect(res.content).toContain("# Rencana Aktivitas Pembelajaran: Fotosintesis");
    expect(res.content).toContain("Biologi / VII A");
    expect(res.modelUsed).toBe("mock-model-v1");
  });

  it("generates deterministic draft for LEARNING_MATERIAL", async () => {
    const res = await mockProvider.generate({
      contentType: "LEARNING_MATERIAL",
      topic: "Aljabar",
    });

    expect(res.title).toContain("Ringkasan Materi: Aljabar");
    expect(res.content).toContain("# Materi & Ringkasan Pembelajaran: Aljabar");
  });

  it("generates deterministic draft for TASK_INSTRUCTION", async () => {
    const res = await mockProvider.generate({
      contentType: "TASK_INSTRUCTION",
      topic: "Menulis Cerpen",
    });

    expect(res.title).toContain("Instruksi Tugas: Menulis Cerpen");
    expect(res.content).toContain("# Lembar Instruksi Tugas: Menulis Cerpen");
  });

  it("generates deterministic draft for RUBRIC", async () => {
    const res = await mockProvider.generate({
      contentType: "RUBRIC",
      topic: "Presentasi Kelompok",
    });

    expect(res.title).toContain("Rubrik Kriteria Penilaian: Presentasi Kelompok");
    expect(res.content).toContain("Kriteria Deskriptif Kualitatif");
  });

  it("refines existing draft iteratively", async () => {
    const res = await mockProvider.refine({
      contentType: "LESSON_PLAN",
      currentTitle: "Rencana Pembelajaran Awal",
      currentContent: "Konten awal pembelajaran...",
      refinementInstruction: "Buat lebih interaktif",
    });

    expect(res.title).toBe("Rencana Pembelajaran Awal (Disesuaikan)");
    expect(res.content).toContain("Konten awal pembelajaran...");
    expect(res.content).toContain("Buat lebih interaktif");
  });

  it("handles provider timeout error gracefully", async () => {
    mockProvider.setOptions({ shouldTimeout: true });

    await expect(
      mockProvider.generate({
        contentType: "LESSON_PLAN",
        topic: "Geometri",
      })
    ).rejects.toThrow("Provider timeout");
  });

  it("handles provider rate limit (429) error gracefully", async () => {
    mockProvider.setOptions({ shouldRateLimit: true });

    await expect(
      mockProvider.generate({
        contentType: "LESSON_PLAN",
        topic: "Geometri",
      })
    ).rejects.toThrow("429");
  });

  it("factory returns mock provider when test environment is active", () => {
    const provider = getAiContentProvider();
    expect(provider.name).toBe("mock");
  });

  it("factory allows custom provider injection for integration testing", () => {
    const custom = new MockAiContentProvider({ delayMs: 10 });
    setAiContentProviderForTest(custom);

    const active = getAiContentProvider();
    expect(active).toBe(custom);
  });
});
