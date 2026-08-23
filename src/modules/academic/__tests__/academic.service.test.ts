import { describe, it, expect } from "vitest";
import {
  saveAcademicProfileSchema,
  createLearningObjectiveSchema,
  updateLearningObjectiveSchema,
  createAcademicPlanItemSchema,
  assertActiveObjective,
  getMonthNameIndonesian,
} from "../academic.service";
import { AcademicPlanType, EntityStatus } from "@prisma/client";

describe("Stage 07 Academic Service Unit Tests", () => {
  describe("saveAcademicProfileSchema", () => {
    it("validates valid academic profile input", () => {
      const input = {
        teachingContextId: "ctx_123",
        curriculumName: "Kurikulum Merdeka",
        phase: "Fase E",
        academicNote: "Fokus literasi",
        cpText: "Peserta didik mampu menganalisis teks.",
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
    it("accepts valid TP creation", () => {
      const input = {
        teachingContextId: "ctx_123",
        code: "TP 1.1",
        description: "Menjelaskan konsep eksponen",
        orderIndex: 0,
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
      };
      const result = updateLearningObjectiveSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("createAcademicPlanItemSchema (Prota / Prosem)", () => {
    it("accepts valid PROSEM item with targetMonth 1..12 and positive allocatedHours", () => {
      const input = {
        teachingContextId: "ctx_123",
        planType: AcademicPlanType.PROSEM,
        title: "Eksponen dan Logaritma",
        targetMonth: 7,
        allocatedHours: 6,
        notes: "Asesmen formatif 1",
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
        title: "Materi X",
        targetMonth: 0,
      };
      expect(createAcademicPlanItemSchema.safeParse(inputBelow).success).toBe(false);

      const inputAbove = {
        teachingContextId: "ctx_123",
        planType: AcademicPlanType.PROSEM,
        title: "Materi X",
        targetMonth: 13,
      };
      expect(createAcademicPlanItemSchema.safeParse(inputAbove).success).toBe(false);
    });

    it("rejects allocatedHours <= 0", () => {
      const inputZero = {
        teachingContextId: "ctx_123",
        planType: AcademicPlanType.PROSEM,
        title: "Materi X",
        allocatedHours: 0,
      };
      expect(createAcademicPlanItemSchema.safeParse(inputZero).success).toBe(false);

      const inputNeg = {
        teachingContextId: "ctx_123",
        planType: AcademicPlanType.PROSEM,
        title: "Materi X",
        allocatedHours: -2,
      };
      expect(createAcademicPlanItemSchema.safeParse(inputNeg).success).toBe(false);
    });
  });

  describe("assertActiveObjective lifecycle rule", () => {
    it("passes for ACTIVE status", () => {
      expect(() => assertActiveObjective(EntityStatus.ACTIVE)).not.toThrow();
    });

    it("throws for ARCHIVED status", () => {
      expect(() => assertActiveObjective(EntityStatus.ARCHIVED)).toThrow(
        /Tujuan Pembelajaran yang diarsipkan bersifat historis/
      );
    });
  });

  describe("getMonthNameIndonesian helper", () => {
    it("returns correct Indonesian month names for 1..12", () => {
      expect(getMonthNameIndonesian(1)).toBe("Januari");
      expect(getMonthNameIndonesian(7)).toBe("Juli");
      expect(getMonthNameIndonesian(12)).toBe("Desember");
    });

    it("returns null for out of range or null values", () => {
      expect(getMonthNameIndonesian(null)).toBe(null);
      expect(getMonthNameIndonesian(undefined)).toBe(null);
      expect(getMonthNameIndonesian(0)).toBe(null);
      expect(getMonthNameIndonesian(13)).toBe(null);
    });
  });
});
