import { describe, it, expect } from "vitest";
import {
  getSemesterCalendarSlots,
  deterministicDistributePlan,
  parseJsonFromAi,
} from "../academic-ai.service";
import { PlanItemCategory } from "@prisma/client";
import { ExtractedChapter } from "../academic-ai.types";

describe("Academic AI Service Unit Tests", () => {
  describe("getSemesterCalendarSlots", () => {
    it("returns correct slots for Semester 1 (Ganjil - Juli s.d. Des)", () => {
      const slots = getSemesterCalendarSlots(1);
      expect(slots.length).toBeGreaterThan(15);
      expect(slots.some((s) => s.month === 7)).toBe(true);
      expect(slots.some((s) => s.month === 12)).toBe(true);
      expect(slots.some((s) => s.isSpecialEvent === "STS")).toBe(true);
      expect(slots.some((s) => s.isSpecialEvent === "SAS")).toBe(true);
    });

    it("returns correct slots for Semester 2 (Genap - Jan s.d. Juni)", () => {
      const slots = getSemesterCalendarSlots(2);
      expect(slots.length).toBeGreaterThan(15);
      expect(slots.some((s) => s.month === 1)).toBe(true);
      expect(slots.some((s) => s.month === 6)).toBe(true);
      expect(slots.some((s) => s.isSpecialEvent === "STS")).toBe(true);
      expect(slots.some((s) => s.isSpecialEvent === "SAS")).toBe(true);
    });
  });

  describe("deterministicDistributePlan", () => {
    const mockChapters: ExtractedChapter[] = [
      {
        chapterNumber: 1,
        title: "Bab 1: Eksponen & Logaritma",
        subTopics: ["Sifat Eksponen", "Bentuk Akar"],
        suggestedHours: 12,
        suggestedSemester: 1,
      },
      {
        chapterNumber: 2,
        title: "Bab 2: Barisan & Deret",
        subTopics: ["Barisan Aritmatika", "Deret Geometri"],
        suggestedHours: 15,
        suggestedSemester: 1,
      },
      {
        chapterNumber: 3,
        title: "Bab 3: Vektor & Trigonometri",
        subTopics: ["Operasi Vektor", "Perbandingan Trigonometri"],
        suggestedHours: 15,
        suggestedSemester: 1,
      },
    ];

    it("generates perfectly balanced PROSEM plan (54 JP for 18 weeks x 3 JP)", () => {
      const plan = deterministicDistributePlan(mockChapters, 1, 3, 18);
      expect(plan.targetSemester).toBe(1);
      expect(plan.hoursPerWeek).toBe(3);
      expect(plan.effectiveWeeks).toBe(18);
      expect(plan.totalAvailableHours).toBe(54);
      expect(plan.totalScheduledHours).toBe(54);
      expect(plan.isBalanced).toBe(true);

      // Verify STS and SAS are present
      const stsItem = plan.items.find((it) => it.category === PlanItemCategory.STS);
      const sasItem = plan.items.find((it) => it.category === PlanItemCategory.SAS);
      expect(stsItem).toBeDefined();
      expect(sasItem).toBeDefined();

      // Verify regular materials have weekly distribution
      const regularItems = plan.items.filter((it) => it.category === PlanItemCategory.REGULAR_MATERIAL);
      expect(regularItems.length).toBe(3);
      for (const item of regularItems) {
        expect(item.weeklyDistribution.length).toBeGreaterThan(0);
        expect(item.allocatedHours).toBeGreaterThan(0);
      }
    });

    it("handles 2 JP/week load accurately (32 JP for 16 weeks x 2 JP in Sem 2)", () => {
      const plan = deterministicDistributePlan(mockChapters, 2, 2, 16);
      expect(plan.totalAvailableHours).toBe(32);
      expect(plan.totalScheduledHours).toBe(32);
      expect(plan.isBalanced).toBe(true);
    });
  });

  describe("parseJsonFromAi", () => {
    it("parses raw JSON string", () => {
      const input = `{"title": "Bab 1", "hours": 12}`;
      const result = parseJsonFromAi<{ title: string; hours: number }>(input);
      expect(result.title).toBe("Bab 1");
      expect(result.hours).toBe(12);
    });

    it("strips markdown codeblocks (```json ... ```)", () => {
      const input = `\`\`\`json\n{"status": "ok", "items": [1, 2, 3]}\n\`\`\``;
      const result = parseJsonFromAi<{ status: string; items: number[] }>(input);
      expect(result.status).toBe("ok");
      expect(result.items).toEqual([1, 2, 3]);
    });

    it("handles trailing commas safely", () => {
      const input = `{"key": "value", }`;
      const result = parseJsonFromAi<{ key: string }>(input);
      expect(result.key).toBe("value");
    });
  });
});
