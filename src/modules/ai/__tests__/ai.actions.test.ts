import { describe, it, expect } from "vitest";
import {
  generateAiContentSchema,
  refineAiContentSchema,
  saveAiDraftSchema,
  archiveAiDraftSchema,
  aiDraftFilterSchema,
} from "../ai.types";

describe("Stage 06 AI Actions & Input Validation Tests", () => {
  describe("Zod Validation Schemas", () => {
    it("validates generateAiContentSchema correctly without context", () => {
      const valid = {
        contentType: "LESSON_PLAN" as const,
        topic: "Fotosintesis",
        instruction: "Sertakan aktivitas luar kelas",
        tone: "STANDARD" as const,
      };
      const parsed = generateAiContentSchema.parse(valid);
      expect(parsed.contentType).toBe("LESSON_PLAN");
      expect(parsed.topic).toBe("Fotosintesis");
      expect(parsed.includeHistoricalTopics).toBe(false);
    });

    it("validates generateAiContentSchema with teaching context & historical opt-in", () => {
      const valid = {
        contentType: "RUBRIC" as const,
        topic: "Keterampilan Berbicara",
        teachingContextId: "ctx-123",
        includeHistoricalTopics: true,
        tone: "DETAILED" as const,
      };
      const parsed = generateAiContentSchema.parse(valid);
      expect(parsed.teachingContextId).toBe("ctx-123");
      expect(parsed.includeHistoricalTopics).toBe(true);
      expect(parsed.tone).toBe("DETAILED");
    });

    it("rejects invalid/empty topic in generateAiContentSchema", () => {
      const invalid = {
        contentType: "LESSON_PLAN" as const,
        topic: "a", // Less than 2 chars
      };
      expect(() => generateAiContentSchema.parse(invalid)).toThrow("Topik pembelajaran minimal 2 karakter");
    });

    it("rejects invalid content type", () => {
      const invalid = {
        contentType: "UNKNOWN_TYPE" as unknown as "LESSON_PLAN",
        topic: "Matematika",
      };
      expect(() => generateAiContentSchema.parse(invalid)).toThrow();
    });

    it("validates refineAiContentSchema correctly", () => {
      const valid = {
        contentType: "TASK_INSTRUCTION" as const,
        currentTitle: "Instruksi Tugas Menulis",
        currentContent: "Tulis cerita pendek minimal 500 kata.",
        refinementInstruction: "Buat lebih menantang untuk siswa berprestasi",
      };
      const parsed = refineAiContentSchema.parse(valid);
      expect(parsed.refinementInstruction).toBe("Buat lebih menantang untuk siswa berprestasi");
    });

    it("rejects empty refinement instruction", () => {
      const invalid = {
        contentType: "TASK_INSTRUCTION" as const,
        currentTitle: "Judul",
        currentContent: "Isi konten...",
        refinementInstruction: "",
      };
      expect(() => refineAiContentSchema.parse(invalid)).toThrow();
    });

    it("validates saveAiDraftSchema correctly for new draft", () => {
      const valid = {
        contentType: "LEARNING_MATERIAL" as const,
        title: "Ringkasan Ekosistem",
        topic: "Ekosistem",
        content: "# Ekosistem\n\nEkosistem adalah interaksi...",
        teachingContextId: "ctx-456",
      };
      const parsed = saveAiDraftSchema.parse(valid);
      expect(parsed.title).toBe("Ringkasan Ekosistem");
      expect(parsed.teachingContextId).toBe("ctx-456");
    });

    it("validates saveAiDraftSchema for updating existing draft", () => {
      const valid = {
        draftId: "draft-789",
        contentType: "LESSON_PLAN" as const,
        title: "Rencana Pembelajaran Terupdate",
        topic: "Listrik Dinamis",
        content: "# Rencana Pembelajaran Baru...",
      };
      const parsed = saveAiDraftSchema.parse(valid);
      expect(parsed.draftId).toBe("draft-789");
    });

    it("validates archiveAiDraftSchema", () => {
      const valid = { draftId: "draft-101" };
      const parsed = archiveAiDraftSchema.parse(valid);
      expect(parsed.draftId).toBe("draft-101");

      expect(() => archiveAiDraftSchema.parse({ draftId: "" })).toThrow();
    });

    it("validates aiDraftFilterSchema with defaults", () => {
      const parsed = aiDraftFilterSchema.parse({});
      expect(parsed.status).toBe("ACTIVE");
      expect(parsed.contentType).toBeUndefined();
    });

    it("validates aiDraftFilterSchema for archived filter", () => {
      const parsed = aiDraftFilterSchema.parse({
        status: "ARCHIVED",
        contentType: "RUBRIC",
        search: "penilaian",
      });
      expect(parsed.status).toBe("ARCHIVED");
      expect(parsed.contentType).toBe("RUBRIC");
      expect(parsed.search).toBe("penilaian");
    });
  });
});
