import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  normalizeName,
  calculateNormalizedScore,
  calculateAssessmentStatistics,
  calculateStudentRunningPerformance,
} from "../assessment.service";
import {
  createAssessmentSchema,
  saveAssessmentScoresSchema,
  recordRemedialAttemptSchema,
  updateGradePolicyItemsSchema,
  createAssessmentTypeSchema,
  renameAssessmentTypeSchema,
  copyGradePolicySchema,
} from "../assessment.types";

describe("Stage 04: Assessment Service, Math, & Business Invariants", () => {
  describe("1. Canonical normalizeName", () => {
    it("should normalize string matching Stage 02 conventions", () => {
      expect(normalizeName("Ulangan Harian 1")).toBe("ulangan-harian-1");
      expect(normalizeName("  Tugas   Mandiri  ")).toBe("tugas-mandiri");
      expect(normalizeName("Penilaian Akhir Semester (PAS)")).toBe("penilaian-akhir-semester-(pas)");
    });
  });

  describe("2. Decimal-Safe Normalization & Invariants", () => {
    it("should calculate exact percentage using Prisma.Decimal", () => {
      const res1 = calculateNormalizedScore(40, 40);
      expect(res1.toString()).toBe("100");

      const res2 = calculateNormalizedScore(0, 40);
      expect(res2.toString()).toBe("0");

      const res3 = calculateNormalizedScore(30, 40);
      expect(res3.toString()).toBe("75");

      // 1/3 * 100 = 33.3333... -> 33.33 (HALF_UP)
      const res4 = calculateNormalizedScore(1, 3);
      expect(res4.toString()).toBe("33.33");

      // 2/3 * 100 = 66.6666... -> 66.67 (HALF_UP)
      const res5 = calculateNormalizedScore(2, 3);
      expect(res5.toString()).toBe("66.67");
    });

    it("should accept rawScore = 0 as valid and distinct from null/absent", () => {
      const res = calculateNormalizedScore(0, 100);
      expect(res.toString()).toBe("0");
    });

    it("should verify initial finalScore equals normalizedScore on first GRADED score", () => {
      const raw = 36;
      const max = 40;
      const normalized = calculateNormalizedScore(raw, max);
      const initialFinal = normalized; // server invariant: finalScore = normalizedScore
      expect(initialFinal.toString()).toBe("90");
    });

    it("should accept Prisma.Decimal inputs directly", () => {
      const raw = new Prisma.Decimal("35.5");
      const max = new Prisma.Decimal("50");
      const res = calculateNormalizedScore(raw, max);
      expect(res.toString()).toBe("71");
    });

    it("should reject negative rawScore", () => {
      expect(() => calculateNormalizedScore(-5, 100)).toThrow("Skor mentah harus berada di antara 0 dan skor maksimum");
    });

    it("should reject rawScore > maxScore", () => {
      expect(() => calculateNormalizedScore(105, 100)).toThrow("Skor mentah harus berada di antara 0 dan skor maksimum");
    });

    it("should reject maxScore <= 0", () => {
      expect(() => calculateNormalizedScore(0, 0)).toThrow("Skor maksimum harus lebih besar dari 0");
      expect(() => calculateNormalizedScore(10, -10)).toThrow("Skor maksimum harus lebih besar dari 0");
    });
  });

  describe("3. Basic Statistics & Mastery", () => {
    it("should correctly aggregate counts and calculate average/highest/lowest", () => {
      const results = [
        { status: "GRADED" as const, finalScore: new Prisma.Decimal(80) },
        { status: "GRADED" as const, finalScore: new Prisma.Decimal(90) },
        { status: "GRADED" as const, finalScore: new Prisma.Decimal(70) },
        { status: "PENDING" as const, finalScore: null },
        { status: "ABSENT" as const, finalScore: null },
        { status: "EXCUSED" as const, finalScore: null },
      ];

      const stats = calculateAssessmentStatistics(results, 75);

      expect(stats.totalParticipants).toBe(6);
      expect(stats.gradedCount).toBe(3);
      expect(stats.pendingCount).toBe(1);
      expect(stats.absentCount).toBe(1);
      expect(stats.excusedCount).toBe(1);

      expect(stats.averageScore?.toString()).toBe("80");
      expect(stats.highestScore?.toString()).toBe("90");
      expect(stats.lowestScore?.toString()).toBe("70");

      expect(stats.tuntasCount).toBe(2); // 80 and 90
      expect(stats.perluRemedialCount).toBe(1); // 70
      // 2/3 * 100 = 66.67
      expect(stats.masteryPercentage?.toString()).toBe("66.67");
    });

    it("should verify null != zero: ABSENT / EXCUSED / PENDING are not treated as score 0", () => {
      const results = [
        { status: "GRADED" as const, finalScore: new Prisma.Decimal(100) },
        { status: "ABSENT" as const, finalScore: null },
        { status: "EXCUSED" as const, finalScore: null },
      ];

      const stats = calculateAssessmentStatistics(results, 75);
      expect(stats.gradedCount).toBe(1);
      // Average is calculated ONLY over GRADED rows (100 / 1 = 100), not diluted by ABSENT
      expect(stats.averageScore?.toString()).toBe("100");
    });

    it("should handle assessment without KKTP (minimumPassingScore = null) without inventing mastery", () => {
      const results = [
        { status: "GRADED" as const, finalScore: new Prisma.Decimal(85) },
        { status: "GRADED" as const, finalScore: new Prisma.Decimal(95) },
      ];

      const stats = calculateAssessmentStatistics(results, null);
      expect(stats.averageScore?.toString()).toBe("90");
      expect(stats.tuntasCount).toBeNull();
      expect(stats.perluRemedialCount).toBeNull();
      expect(stats.masteryPercentage).toBeNull();
    });

    it("should return null metrics when no participants are graded", () => {
      const results = [
        { status: "PENDING" as const, finalScore: null },
        { status: "ABSENT" as const, finalScore: null },
      ];

      const stats = calculateAssessmentStatistics(results, 75);
      expect(stats.totalParticipants).toBe(2);
      expect(stats.gradedCount).toBe(0);
      expect(stats.averageScore).toBeNull();
      expect(stats.highestScore).toBeNull();
      expect(stats.lowestScore).toBeNull();
      expect(stats.tuntasCount).toBeNull();
      expect(stats.masteryPercentage).toBeNull();
    });
  });

  describe("4. Weighted Running Grade Calculation", () => {
    const policyItems = [
      { assessmentTypeId: "type-tugas", assessmentTypeName: "Tugas", category: "ASSIGNMENT", weight: new Prisma.Decimal(20) },
      { assessmentTypeId: "type-uh", assessmentTypeName: "UH", category: "FORMATIVE", weight: new Prisma.Decimal(30) },
      { assessmentTypeId: "type-uts", assessmentTypeName: "UTS", category: "MIDTERM", weight: new Prisma.Decimal(20) },
      { assessmentTypeId: "type-uas", assessmentTypeName: "UAS", category: "FINAL_TERM", weight: new Prisma.Decimal(30) },
    ];

    it("should calculate exact running performance matching known mathematical proof (80@20%, 90@30% -> 86.00)", () => {
      // Known value proof:
      // Category Tugas (avg 80, wt 20), Category UH (avg 90, wt 30)
      // availableWeight = 20 + 30 = 50
      // (80*20 + 90*30) / 50 = (1600 + 2700) / 50 = 4300 / 50 = 86.00
      const student = { id: "std-1", fullName: "Ahmad Fauzi", nis: "1001" };
      const studentScores = [
        // Tugas 1 = 80 (COMPLETED)
        {
          assessmentId: "asm-1",
          assessmentTypeId: "type-tugas",
          assessmentTypeName: "Tugas",
          assessmentStatus: "COMPLETED" as const,
          resultStatus: "GRADED" as const,
          finalScore: new Prisma.Decimal(80),
        },
        // UH 1 = 85, UH 2 = 95 -> UH Category Avg = 90 (COMPLETED)
        {
          assessmentId: "asm-2",
          assessmentTypeId: "type-uh",
          assessmentTypeName: "UH",
          assessmentStatus: "COMPLETED" as const,
          resultStatus: "GRADED" as const,
          finalScore: new Prisma.Decimal(85),
        },
        {
          assessmentId: "asm-3",
          assessmentTypeId: "type-uh",
          assessmentTypeName: "UH",
          assessmentStatus: "COMPLETED" as const,
          resultStatus: "GRADED" as const,
          finalScore: new Prisma.Decimal(95),
        },
      ];

      const runningGrade = calculateStudentRunningPerformance(student, policyItems, studentScores);

      expect(runningGrade.availableWeight.toString()).toBe("50");
      expect(runningGrade.runningPerformance?.toString()).toBe("86");
      expect(runningGrade.categories[0].categoryAverage?.toString()).toBe("80");
      expect(runningGrade.categories[1].categoryAverage?.toString()).toBe("90");
      expect(runningGrade.categories[2].categoryAverage).toBeNull(); // UTS unavailable
      expect(runningGrade.categories[3].categoryAverage).toBeNull(); // UAS unavailable
    });

    it("should exclude IN_PROGRESS and DRAFT assessments from category average", () => {
      const student = { id: "std-1", fullName: "Budi Santoso", nis: "1002" };
      const studentScores = [
        {
          assessmentId: "asm-1",
          assessmentTypeId: "type-tugas",
          assessmentTypeName: "Tugas",
          assessmentStatus: "COMPLETED" as const,
          resultStatus: "GRADED" as const,
          finalScore: new Prisma.Decimal(100),
        },
        {
          assessmentId: "asm-2",
          assessmentTypeId: "type-tugas",
          assessmentTypeName: "Tugas",
          assessmentStatus: "IN_PROGRESS" as const,
          resultStatus: "GRADED" as const,
          finalScore: new Prisma.Decimal(50), // must be excluded
        },
      ];

      const runningGrade = calculateStudentRunningPerformance(student, policyItems, studentScores);
      expect(runningGrade.availableWeight.toString()).toBe("20");
      expect(runningGrade.runningPerformance?.toString()).toBe("100");
    });

    it("should correctly exclude ABSENT and EXCUSED from CategoryAvg denominator (Ahmad UH 1=80, UH 2=ABSENT, UH 3=EXCUSED -> Avg=80, NOT 40 or 26.67)", () => {
      const student = { id: "std-ahmad", fullName: "Ahmad", nis: "1005" };
      const studentScores = [
        // UH 1 COMPLETED: Ahmad GRADED finalScore 80
        {
          assessmentId: "uh-1",
          assessmentTypeId: "type-uh",
          assessmentTypeName: "UH",
          assessmentStatus: "COMPLETED" as const,
          resultStatus: "GRADED" as const,
          finalScore: new Prisma.Decimal(80),
        },
        // UH 2 COMPLETED: Ahmad ABSENT
        {
          assessmentId: "uh-2",
          assessmentTypeId: "type-uh",
          assessmentTypeName: "UH",
          assessmentStatus: "COMPLETED" as const,
          resultStatus: "ABSENT" as const,
          finalScore: null,
        },
      ];

      // Part 1: UH 1 (80) + UH 2 (ABSENT) -> CategoryAvg must be 80, NOT 40
      const runningGradePart1 = calculateStudentRunningPerformance(student, policyItems, studentScores);
      const uhCategoryPart1 = runningGradePart1.categories.find(c => c.assessmentTypeId === "type-uh");
      expect(uhCategoryPart1?.categoryAverage?.toString()).toBe("80");
      expect(runningGradePart1.availableWeight.toString()).toBe("30");
      expect(runningGradePart1.runningPerformance?.toString()).toBe("80");

      // Part 2: Add UH 3 COMPLETED: Ahmad EXCUSED -> CategoryAvg must remain 80
      const studentScoresWithExcused = [
        ...studentScores,
        {
          assessmentId: "uh-3",
          assessmentTypeId: "type-uh",
          assessmentTypeName: "UH",
          assessmentStatus: "COMPLETED" as const,
          resultStatus: "EXCUSED" as const,
          finalScore: null,
        },
      ];

      const runningGradePart2 = calculateStudentRunningPerformance(student, policyItems, studentScoresWithExcused);
      const uhCategoryPart2 = runningGradePart2.categories.find(c => c.assessmentTypeId === "type-uh");
      expect(uhCategoryPart2?.categoryAverage?.toString()).toBe("80");
      expect(runningGradePart2.availableWeight.toString()).toBe("30");
      expect(runningGradePart2.runningPerformance?.toString()).toBe("80");
    });

    it("should handle student-specific availableWeight when students have different completed categories", () => {
      // Student A completed Tugas (20%), Student B completed Tugas (20%) + UH (30%)
      const studentA = { id: "std-a", fullName: "Student A", nis: "101" };
      const studentB = { id: "std-b", fullName: "Student B", nis: "102" };

      const scoresA = [
        { assessmentId: "1", assessmentTypeId: "type-tugas", assessmentTypeName: "Tugas", assessmentStatus: "COMPLETED" as const, resultStatus: "GRADED" as const, finalScore: new Prisma.Decimal(80) },
      ];
      const scoresB = [
        { assessmentId: "1", assessmentTypeId: "type-tugas", assessmentTypeName: "Tugas", assessmentStatus: "COMPLETED" as const, resultStatus: "GRADED" as const, finalScore: new Prisma.Decimal(80) },
        { assessmentId: "2", assessmentTypeId: "type-uh", assessmentTypeName: "UH", assessmentStatus: "COMPLETED" as const, resultStatus: "GRADED" as const, finalScore: new Prisma.Decimal(90) },
      ];

      const gradeA = calculateStudentRunningPerformance(studentA, policyItems, scoresA);
      const gradeB = calculateStudentRunningPerformance(studentB, policyItems, scoresB);

      expect(gradeA.availableWeight.toString()).toBe("20");
      expect(gradeA.runningPerformance?.toString()).toBe("80");

      expect(gradeB.availableWeight.toString()).toBe("50");
      expect(gradeB.runningPerformance?.toString()).toBe("86");
    });

    it("should handle zero available weight safely without division by zero (returns null)", () => {
      const student = { id: "std-2", fullName: "Citra Dewi", nis: "1003" };
      const studentScores: Parameters<typeof calculateStudentRunningPerformance>[2] = [];

      const runningGrade = calculateStudentRunningPerformance(student, policyItems, studentScores);
      expect(runningGrade.availableWeight.toString()).toBe("0");
      expect(runningGrade.runningPerformance).toBeNull();
    });

    it("should calculate 100% available weight when all components are completed", () => {
      const student = { id: "std-3", fullName: "Doni Pratama", nis: "1004" };
      const studentScores = [
        { assessmentId: "1", assessmentTypeId: "type-tugas", assessmentTypeName: "Tugas", assessmentStatus: "COMPLETED" as const, resultStatus: "GRADED" as const, finalScore: new Prisma.Decimal(80) },
        { assessmentId: "2", assessmentTypeId: "type-uh", assessmentTypeName: "UH", assessmentStatus: "COMPLETED" as const, resultStatus: "GRADED" as const, finalScore: new Prisma.Decimal(80) },
        { assessmentId: "3", assessmentTypeId: "type-uts", assessmentTypeName: "UTS", assessmentStatus: "COMPLETED" as const, resultStatus: "GRADED" as const, finalScore: new Prisma.Decimal(80) },
        { assessmentId: "4", assessmentTypeId: "type-uas", assessmentTypeName: "UAS", assessmentStatus: "COMPLETED" as const, resultStatus: "GRADED" as const, finalScore: new Prisma.Decimal(80) },
      ];

      const runningGrade = calculateStudentRunningPerformance(student, policyItems, studentScores);
      expect(runningGrade.availableWeight.toString()).toBe("100");
      expect(runningGrade.runningPerformance?.toString()).toBe("80");
    });
  });

  describe("5. Schema & Invariant Validations (Zod Schemas)", () => {
    it("should reject createAssessment with maxScore <= 0", () => {
      const invalid = {
        teachingContextId: "ctx-1",
        assessmentTypeId: "type-1",
        title: "Test",
        assessmentDate: new Date(),
        maxScore: 0,
      };
      expect(() => createAssessmentSchema.parse(invalid)).toThrow();
    });

    it("should reject saveAssessmentScores with negative rawScore", () => {
      const invalid = {
        assessmentId: "asm-1",
        scores: [{ studentId: "std-1", status: "GRADED" as const, rawScore: -10 }],
      };
      expect(() => saveAssessmentScoresSchema.parse(invalid)).toThrow();
    });

    it("should reject recordRemedialAttempt with score > 100", () => {
      const invalid = {
        assessmentResultId: "res-1",
        score: 110,
        newFinalScore: 80,
      };
      expect(() => recordRemedialAttemptSchema.parse(invalid)).toThrow();
    });

    it("should accept valid grade policy items array", () => {
      const valid = {
        gradePolicyId: "pol-1",
        items: [
          { assessmentTypeId: "type-1", weight: 40, sortOrder: 1 },
          { assessmentTypeId: "type-2", weight: 60, sortOrder: 2 },
        ],
      };
      const parsed = updateGradePolicyItemsSchema.parse(valid);
      expect(parsed.items.length).toBe(2);
    });

    it("should validate createAssessmentType and renameAssessmentType schemas", () => {
      const validCreate = {
        teachingContextId: "ctx-1",
        name: "Ulangan Blok",
        category: "SUMMATIVE" as const,
      };
      expect(createAssessmentTypeSchema.parse(validCreate).name).toBe("Ulangan Blok");

      const validRename = {
        id: "type-1",
        name: "Ulangan Blok Semester 1",
      };
      expect(renameAssessmentTypeSchema.parse(validRename).name).toBe("Ulangan Blok Semester 1");
    });

    it("should validate copyGradePolicySchema", () => {
      const validCopy = {
        sourceTeachingContextId: "src-1",
        targetTeachingContextId: "tgt-1",
        confirmed: true,
      };
      expect(copyGradePolicySchema.parse(validCopy).confirmed).toBe(true);
    });
  });
});
