import { describe, it, expect } from "vitest";
import {
  saveAcademicProfileSchema,
  createLearningObjectiveSchema,
  updateLearningObjectiveSchema,
  createAcademicPlanItemSchema,
  bulkSaveAcademicPlanSchema,
  assertActiveObjective,
  getMonthNameIndonesian,
  calculateSemesterTargetHours,
} from "../academic.service";
import { AcademicPlanType, PlanItemCategory, EntityStatus } from "@prisma/client";

describe("Stage 07 Academic Service Unit Tests", () => {
  describe("saveAcademicProfileSchema", () => {
    it("validates valid academic profile input with config", () => {
      const input = {
        teachingContextId: "ctx_123",
        curriculumName: "Kurikulum Merdeka",
        phase: "Fase E",
        academicNote: "Fokus literasi",
        cpText: "Peserta didik mampu menganalisis teks.",
        hoursPerWeek: 3,
        effectiveWeeksSem1: 18,
        effectiveWeeksSem2: 16,
      };
      const result = saveAcademicProfileSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("allows optional/null fields", () => {
      const input = {
        teachingContextId: "ctx_123",
      };
      const result = saveAcademicProfileSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects missing teachingContextId", () => {
      const result = saveAcademicProfileSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("createLearningObjectiveSchema & updateLearningObjectiveSchema", () => {
    it("accepts valid TP creation with targetSemester and allocatedHours", () => {
      const input = {
        teachingContextId: "ctx_123",
        code: "TP 1.1",
        description: "Menjelaskan konsep eksponen",
        orderIndex: 0,
        targetSemester: 1,
        allocatedHours: 6,
      };
      const result = createLearningObjectiveSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects empty description in TP creation", () => {
      const input = {
        teachingContextId: "ctx_123",
        description: "   ",
      };
      const result = createLearningObjectiveSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects negative orderIndex", () => {
      const input = {
        teachingContextId: "ctx_123",
        description: "Valid TP",
        orderIndex: -1,
      };
      const result = createLearningObjectiveSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("accepts valid TP update", () => {
      const input = {
        objectiveId: "obj_123",
        code: "TP 1.2",
        description: "Mengoperasikan bilangan berpangkat",
        targetSemester: 2,
        allocatedHours: 9,
      };
      const result = updateLearningObjectiveSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("createAcademicPlanItemSchema (Prota / Prosem)", () => {
    it("accepts valid PROSEM item with weeklyDistribution array", () => {
      const input = {
        teachingContextId: "ctx_123",
        planType: AcademicPlanType.PROSEM,
        category: PlanItemCategory.REGULAR_MATERIAL,
        title: "Eksponen dan Logaritma",
        targetMonth: 7,
        targetSemester: 1,
        allocatedHours: 6,
        notes: "Asesmen formatif 1",
        weeklyDistribution: [
          { month: 7, week: 3, hours: 3 },
          { month: 7, week: 4, hours: 3 },
        ],
      };
      const result = createAcademicPlanItemSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts valid PROTA item without targetMonth", () => {
      const input = {
        teachingContextId: "ctx_123",
        planType: AcademicPlanType.PROTA,
        title: "Semester Gasal - Aljabar",
        allocatedHours: 24,
      };
      const result = createAcademicPlanItemSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects invalid planType", () => {
      const input = {
        teachingContextId: "ctx_123",
        planType: "INVALID_TYPE",
        title: "Materi X",
      };
      const result = createAcademicPlanItemSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects invalid targetMonth (< 1 or > 12)", () => {
      const inputBelow = {
        teachingContextId: "ctx_123",
        planType: AcademicPlanType.PROSEM,
        title: "Materi A",
        targetMonth: 0,
      };
      const inputAbove = {
        teachingContextId: "ctx_123",
        planType: AcademicPlanType.PROSEM,
        title: "Materi B",
        targetMonth: 13,
      };
      expect(createAcademicPlanItemSchema.safeParse(inputBelow).success).toBe(false);
      expect(createAcademicPlanItemSchema.safeParse(inputAbove).success).toBe(false);
    });

    it("rejects non-positive allocatedHours", () => {
      const inputZero = {
        teachingContextId: "ctx_123",
        planType: AcademicPlanType.PROSEM,
        title: "Materi A",
        allocatedHours: 0,
      };
      const inputNeg = {
        teachingContextId: "ctx_123",
        planType: AcademicPlanType.PROSEM,
        title: "Materi B",
        allocatedHours: -4,
      };
      expect(createAcademicPlanItemSchema.safeParse(inputZero).success).toBe(false);
      expect(createAcademicPlanItemSchema.safeParse(inputNeg).success).toBe(false);
    });
  });

  describe("bulkSaveAcademicPlanSchema", () => {
    it("accepts valid bulk plan items payload", () => {
      const input = {
        teachingContextId: "ctx_123",
        planType: AcademicPlanType.PROSEM,
        targetSemester: 1,
        items: [
          {
            title: "Bab 1: Eksponen",
            allocatedHours: 12,
            category: PlanItemCategory.REGULAR_MATERIAL,
            weeklyDistribution: [{ month: 7, week: 3, hours: 3 }],
          },
          {
            title: "Sumatif Tengah Semester",
            allocatedHours: 3,
            category: PlanItemCategory.STS,
            weeklyDistribution: [{ month: 9, week: 3, hours: 3 }],
          },
        ],
      };
      const result = bulkSaveAcademicPlanSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("assertActiveObjective helper", () => {
    it("does not throw on ACTIVE status", () => {
      expect(() => assertActiveObjective(EntityStatus.ACTIVE)).not.toThrow();
    });

    it("throws on ARCHIVED status", () => {
      expect(() => assertActiveObjective(EntityStatus.ARCHIVED)).toThrow(
        "Tujuan Pembelajaran yang diarsipkan bersifat historis dan tidak dapat diubah atau ditautkan baru"
      );
    });
  });

  describe("getMonthNameIndonesian helper", () => {
    it("returns correct Indonesian month names for 1..12", () => {
      expect(getMonthNameIndonesian(1)).toBe("Januari");
      expect(getMonthNameIndonesian(7)).toBe("Juli");
      expect(getMonthNameIndonesian(12)).toBe("Desember");
    });

    it("returns null for out-of-range or missing numbers", () => {
      expect(getMonthNameIndonesian(null)).toBeNull();
      expect(getMonthNameIndonesian(undefined)).toBeNull();
      expect(getMonthNameIndonesian(0)).toBeNull();
      expect(getMonthNameIndonesian(13)).toBeNull();
    });
  });

  describe("calculateSemesterTargetHours helper", () => {
    it("computes total target hours correctly", () => {
      expect(calculateSemesterTargetHours(18, 3)).toBe(54);
      expect(calculateSemesterTargetHours(16, 2)).toBe(32);
      expect(calculateSemesterTargetHours(0, 3)).toBe(0);
    });
  });
});
