import { Prisma } from "@prisma/client";
import { AssessmentBasicStatistics, StudentCategoryPerformance, StudentRunningGrade } from "./assessment.types";

/**
 * Canonical string normalization helper matching Stage 02 conventions for School, Subject, Class.
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Deterministic, Decimal-safe normalization formula:
 * normalizedScore = Decimal(rawScore) / Decimal(maxScore) * Decimal(100)
 * rounded to 2 decimal places using ROUND_HALF_UP.
 */
export function calculateNormalizedScore(
  rawScore: Prisma.Decimal | number | string,
  maxScore: Prisma.Decimal | number | string
): Prisma.Decimal {
  const raw = new Prisma.Decimal(rawScore);
  const max = new Prisma.Decimal(maxScore);

  if (max.lessThanOrEqualTo(0)) {
    throw new Error("Skor maksimum harus lebih besar dari 0");
  }
  if (raw.lessThan(0) || raw.greaterThan(max)) {
    throw new Error("Skor mentah harus berada di antara 0 dan skor maksimum");
  }

  return raw.dividedBy(max).times(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

interface BasicResultRow {
  status: "PENDING" | "GRADED" | "ABSENT" | "EXCUSED";
  finalScore: Prisma.Decimal | number | null;
}

/**
 * Deterministic calculation of basic statistics for an Assessment.
 */
export function calculateAssessmentStatistics(
  results: BasicResultRow[],
  minimumPassingScore: Prisma.Decimal | number | null | undefined
): AssessmentBasicStatistics {
  const totalParticipants = results.length;
  let gradedCount = 0;
  let pendingCount = 0;
  let absentCount = 0;
  let excusedCount = 0;

  const validScores: Prisma.Decimal[] = [];

  for (const r of results) {
    if (r.status === "PENDING") {
      pendingCount++;
    } else if (r.status === "ABSENT") {
      absentCount++;
    } else if (r.status === "EXCUSED") {
      excusedCount++;
    } else if (r.status === "GRADED") {
      gradedCount++;
      if (r.finalScore !== null && r.finalScore !== undefined) {
        validScores.push(new Prisma.Decimal(r.finalScore));
      }
    }
  }

  if (validScores.length === 0) {
    return {
      totalParticipants,
      gradedCount,
      pendingCount,
      absentCount,
      excusedCount,
      averageScore: null,
      highestScore: null,
      lowestScore: null,
      tuntasCount: null,
      perluRemedialCount: null,
      masteryPercentage: null,
    };
  }

  let sum = new Prisma.Decimal(0);
  let highest = validScores[0];
  let lowest = validScores[0];

  for (const score of validScores) {
    sum = sum.plus(score);
    if (score.greaterThan(highest)) highest = score;
    if (score.lessThan(lowest)) lowest = score;
  }

  const averageScore = sum.dividedBy(validScores.length).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  let tuntasCount: number | null = null;
  let perluRemedialCount: number | null = null;
  let masteryPercentage: Prisma.Decimal | null = null;

  if (minimumPassingScore !== null && minimumPassingScore !== undefined) {
    const kktp = new Prisma.Decimal(minimumPassingScore);
    let tuntas = 0;
    let perluRemedial = 0;

    for (const score of validScores) {
      if (score.greaterThanOrEqualTo(kktp)) {
        tuntas++;
      } else {
        perluRemedial++;
      }
    }

    tuntasCount = tuntas;
    perluRemedialCount = perluRemedial;
    masteryPercentage = new Prisma.Decimal(tuntas)
      .dividedBy(validScores.length)
      .times(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  return {
    totalParticipants,
    gradedCount,
    pendingCount,
    absentCount,
    excusedCount,
    averageScore,
    highestScore: highest,
    lowestScore: lowest,
    tuntasCount,
    perluRemedialCount,
    masteryPercentage,
  };
}

export interface StudentScoreSnapshot {
  assessmentId: string;
  assessmentTypeId: string;
  assessmentTypeName: string;
  assessmentStatus: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
  resultStatus: "PENDING" | "GRADED" | "ABSENT" | "EXCUSED";
  finalScore: Prisma.Decimal | number | null;
}

export interface PolicyItemSnapshot {
  assessmentTypeId: string;
  assessmentTypeName: string;
  category: string;
  weight: Prisma.Decimal | number;
}

/**
 * Calculates weighted running grade for a single student.
 * Gated strictly by ACTIVE policy and COMPLETED assessments.
 * Available weight is student-specific based on available completed components.
 */
export function calculateStudentRunningPerformance(
  student: { id: string; fullName: string; nis: string | null },
  policyItems: PolicyItemSnapshot[],
  studentScores: StudentScoreSnapshot[]
): StudentRunningGrade {
  // Map of assessmentTypeId -> valid final scores from COMPLETED assessments only
  const scoresByType = new Map<string, Prisma.Decimal[]>();

  for (const score of studentScores) {
    if (score.assessmentStatus === "COMPLETED" && score.resultStatus === "GRADED" && score.finalScore !== null) {
      const typeId = score.assessmentTypeId;
      if (!scoresByType.has(typeId)) {
        scoresByType.set(typeId, []);
      }
      scoresByType.get(typeId)!.push(new Prisma.Decimal(score.finalScore));
    }
  }

  let totalWeightedContribution = new Prisma.Decimal(0);
  let availableWeight = new Prisma.Decimal(0);
  const categories: StudentCategoryPerformance[] = [];

  for (const item of policyItems) {
    const itemWeight = new Prisma.Decimal(item.weight);
    const validScores = scoresByType.get(item.assessmentTypeId) || [];
    const count = validScores.length;

    let categoryAverage: Prisma.Decimal | null = null;

    if (count > 0) {
      let sum = new Prisma.Decimal(0);
      for (const s of validScores) {
        sum = sum.plus(s);
      }
      categoryAverage = sum.dividedBy(count).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      // Weighted contribution: CategoryAvg * weight
      const contribution = categoryAverage.times(itemWeight);
      totalWeightedContribution = totalWeightedContribution.plus(contribution);
      availableWeight = availableWeight.plus(itemWeight);
    }

    categories.push({
      assessmentTypeId: item.assessmentTypeId,
      assessmentTypeName: item.assessmentTypeName,
      category: item.category,
      weight: itemWeight,
      categoryAverage,
      completedAssessmentCount: count,
    });
  }

  let runningPerformance: Prisma.Decimal | null = null;

  // Zero availableWeight protection: never divide by zero
  if (availableWeight.greaterThan(0)) {
    runningPerformance = totalWeightedContribution
      .dividedBy(availableWeight)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  return {
    studentId: student.id,
    studentName: student.fullName,
    nis: student.nis,
    availableWeight,
    runningPerformance,
    categories,
  };
}
