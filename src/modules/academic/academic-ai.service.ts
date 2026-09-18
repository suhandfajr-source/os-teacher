import {
  ExtractedChapter,
  ExtractedCurriculumStructure,
  GeneratedAcademicPlanPreview,
  GeneratedPlanItemPreview,
} from "./academic-ai.types";
import { PlanItemCategory, WeeklyDistributionSlot } from "./academic.types";

/**
 * Semester calendar templates for Indonesia (Months and usable weekly slots).
 * Semester 1 (Ganjil): Bulan 7..12 (Juli - Desember). Total ~18-20 usable weeks.
 * Semester 2 (Genap): Bulan 1..6 (Januari - Juni). Total ~16-18 usable weeks.
 */
export interface SemesterCalendarSlot {
  month: number;
  week: number;
  isSpecialEvent?: "STS" | "SAS" | "HOLIDAY" | "MPLS";
}

export function getSemesterCalendarSlots(semester: number): SemesterCalendarSlot[] {
  if (semester === 1) {
    // Ganjil: Juli s.d. Desember
    return [
      // Juli: M1-M2 Libur/MPLS, M3-M4 KBM
      { month: 7, week: 3 },
      { month: 7, week: 4 },
      // Agustus: M1-M4 KBM
      { month: 8, week: 1 },
      { month: 8, week: 2 },
      { month: 8, week: 3 },
      { month: 8, week: 4 },
      // September: M1-M3 KBM, M4 STS
      { month: 9, week: 1 },
      { month: 9, week: 2 },
      { month: 9, week: 3 },
      { month: 9, week: 4, isSpecialEvent: "STS" },
      // Oktober: M1-M4 KBM
      { month: 10, week: 1 },
      { month: 10, week: 2 },
      { month: 10, week: 3 },
      { month: 10, week: 4 },
      // November: M1-M4 KBM
      { month: 11, week: 1 },
      { month: 11, week: 2 },
      { month: 11, week: 3 },
      { month: 11, week: 4 },
      // Desember: M1 KBM, M2 SAS, M3 Cadangan
      { month: 12, week: 1 },
      { month: 12, week: 2, isSpecialEvent: "SAS" },
      { month: 12, week: 3, isSpecialEvent: "HOLIDAY" },
    ];
  } else {
    // Genap: Januari s.d. Juni
    return [
      // Januari: M1-M4 KBM
      { month: 1, week: 1 },
      { month: 1, week: 2 },
      { month: 1, week: 3 },
      { month: 1, week: 4 },
      // Februari: M1-M4 KBM
      { month: 2, week: 1 },
      { month: 2, week: 2 },
      { month: 2, week: 3 },
      { month: 2, week: 4 },
      // Maret: M1-M3 KBM, M4 STS
      { month: 3, week: 1 },
      { month: 3, week: 2 },
      { month: 3, week: 3 },
      { month: 3, week: 4, isSpecialEvent: "STS" },
      // April: M1-M4 KBM
      { month: 4, week: 1 },
      { month: 4, week: 2 },
      { month: 4, week: 3 },
      { month: 4, week: 4 },
      // Mei: M1-M4 KBM
      { month: 5, week: 1 },
      { month: 5, week: 2 },
      { month: 5, week: 3 },
      { month: 5, week: 4 },
      // Juni: M1 SAT/SAS, M2 Cadangan
      { month: 6, week: 1, isSpecialEvent: "SAS" },
      { month: 6, week: 2, isSpecialEvent: "HOLIDAY" },
    ];
  }
}

/**
 * Deterministic, mathematically balanced PROSEM distribution engine.
 * Guarantees that totalScheduledHours === totalAvailableHours.
 */
export function deterministicDistributePlan(
  chapters: ExtractedChapter[],
  semester: number,
  hoursPerWeek: number,
  effectiveWeeks: number
): GeneratedAcademicPlanPreview {
  const hpw = Math.max(1, hoursPerWeek || 3);
  const effWeeks = Math.max(1, effectiveWeeks || (semester === 1 ? 18 : 16));
  const totalAvailableHours = effWeeks * hpw;

  // Filter chapters relevant to this semester (or default all if not specified)
  const semesterChapters = chapters.filter((c) => !c.suggestedSemester || c.suggestedSemester === semester);
  const activeChapters = semesterChapters.length > 0 ? semesterChapters : chapters;

  // Get available weekly slots
  const allSlots = getSemesterCalendarSlots(semester);
  // Cap slots to effectiveWeeks + special events
  const usableSlots = allSlots.slice(0, Math.min(allSlots.length, effWeeks));

  const items: GeneratedPlanItemPreview[] = [];
  let currentSlotIndex = 0;

  // Reserve 1 slot (hpw) for STS and 1 slot (hpw) for SAS
  const stsHours = hpw;
  const sasHours = hpw;
  const reserveAssessmentHours = stsHours + sasHours;

  const hoursForRegularMaterial = Math.max(hpw, totalAvailableHours - reserveAssessmentHours);

  // Calculate proportional hours per chapter
  const rawChapterTotal = activeChapters.reduce((acc, c) => acc + (c.suggestedHours || 6), 0);
  const chapterAllocations = activeChapters.map((c) => {
    const rawHours = c.suggestedHours || 6;
    const ratio = rawChapterTotal > 0 ? rawHours / rawChapterTotal : 1 / activeChapters.length;
    let alloc = Math.round((ratio * hoursForRegularMaterial) / hpw) * hpw;
    if (alloc < hpw) alloc = hpw;
    return { chapter: c, allocatedHours: alloc };
  });

  // Balance chapter allocations to match hoursForRegularMaterial exactly
  let currentSum = chapterAllocations.reduce((acc, c) => acc + c.allocatedHours, 0);
  let diff = hoursForRegularMaterial - currentSum;

  if (diff !== 0 && chapterAllocations.length > 0) {
    let i = 0;
    while (diff !== 0) {
      if (diff > 0) {
        chapterAllocations[i % chapterAllocations.length].allocatedHours += hpw;
        diff -= hpw;
      } else if (diff < 0 && chapterAllocations[i % chapterAllocations.length].allocatedHours > hpw) {
        chapterAllocations[i % chapterAllocations.length].allocatedHours -= hpw;
        diff += hpw;
      } else {
        break;
      }
      i++;
    }
  }

  // Distribute chapter slots across the timeline
  for (let idx = 0; idx < chapterAllocations.length; idx++) {
    const { chapter, allocatedHours } = chapterAllocations[idx];
    const slotsNeeded = Math.ceil(allocatedHours / hpw);
    const weeklyDist: WeeklyDistributionSlot[] = [];

    for (let s = 0; s < slotsNeeded; s++) {
      if (currentSlotIndex < usableSlots.length) {
        const slot = usableSlots[currentSlotIndex];
        // Check if mid-semester STS should be inserted
        const isMidpoint = currentSlotIndex === Math.floor(effWeeks / 2);
        if (isMidpoint && !items.some((it) => it.category === PlanItemCategory.STS)) {
          items.push({
            title: "Sumatif Tengah Semester (STS)",
            category: PlanItemCategory.STS,
            targetSemester: semester,
            allocatedHours: stsHours,
            notes: "Evaluasi capaian tengah semester",
            weeklyDistribution: [{ month: slot.month, week: slot.week, hours: stsHours }],
          });
          currentSlotIndex++;
          if (currentSlotIndex >= usableSlots.length) break;
        }

        const currentSlot = usableSlots[currentSlotIndex];
        weeklyDist.push({
          month: currentSlot.month,
          week: currentSlot.week,
          hours: hpw,
        });
        currentSlotIndex++;
      }
    }

    items.push({
      title: chapter.title,
      category: PlanItemCategory.REGULAR_MATERIAL,
      learningObjectiveCode: chapter.learningObjectiveCode || `TP-${semester}.${idx + 1}`,
      learningObjectiveDescription: chapter.learningObjectiveDescription || chapter.title,
      targetSemester: semester,
      allocatedHours,
      notes: chapter.subTopics?.length ? `Mencakup: ${chapter.subTopics.join(", ")}` : null,
      weeklyDistribution: weeklyDist,
    });
  }

  // Ensure STS is present if not already added
  if (!items.some((it) => it.category === PlanItemCategory.STS)) {
    const midMonth = semester === 1 ? 9 : 3;
    items.push({
      title: "Sumatif Tengah Semester (STS)",
      category: PlanItemCategory.STS,
      targetSemester: semester,
      allocatedHours: stsHours,
      notes: "Evaluasi capaian tengah semester",
      weeklyDistribution: [{ month: midMonth, week: 4, hours: stsHours }],
    });
  }

  // Add SAS at the end of semester
  const endMonth = semester === 1 ? 12 : 6;
  items.push({
    title: semester === 1 ? "Sumatif Akhir Semester (SAS)" : "Sumatif Akhir Tahun (SAT)",
    category: PlanItemCategory.SAS,
    targetSemester: semester,
    allocatedHours: sasHours,
    notes: "Evaluasi capaian akhir semester & pelaporan hasil belajar",
    weeklyDistribution: [{ month: endMonth, week: 2, hours: sasHours }],
  });

  // Calculate final scheduled hours
  const totalScheduledHours = items.reduce((acc, it) => acc + it.allocatedHours, 0);

  return {
    targetSemester: semester,
    effectiveWeeks: effWeeks,
    hoursPerWeek: hpw,
    totalAvailableHours,
    totalScheduledHours,
    isBalanced: totalScheduledHours === totalAvailableHours,
    items,
  };
}

/**
 * Extracts and cleans JSON from LLM output.
 */
export function parseJsonFromAi<T>(rawText: string): T {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Attempt relaxed json parse (e.g. fix trailing commas)
    const relaxed = cleaned.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(relaxed) as T;
  }
}
