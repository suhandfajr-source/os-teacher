import { describe, it, expect } from "vitest";
import { exportProsemToXlsx, exportProtaToDocx } from "../academic.export";
import { AcademicPlanType, EntityStatus } from "@prisma/client";

describe("Academic Document Export Unit Tests", () => {
  const mockExportData = {
    schoolName: "SMA Negeri 1 Indonesia",
    className: "XI MIPA 1",
    subjectName: "Pendidikan Agama Islam",
    academicYear: "2026/2027",
    teacherName: "Budi Santoso, S.Pd",
    curriculumName: "Kurikulum Merdeka",
    semester: 1,
    hoursPerWeek: 3,
    effectiveWeeks: 18,
    items: [
      {
        id: "item_1",
        teachingContextId: "ctx_1",
        learningObjectiveId: null,
        planType: AcademicPlanType.PROSEM,
        category: "REGULAR_MATERIAL" as any,
        title: "Bab 1: Eksponen & Logaritma",
        targetMonth: 7,
        targetSemester: 1,
        allocatedHours: 12,
        notes: null,
        weeklyDistribution: [
          { month: 7, week: 3, hours: 3 },
          { month: 7, week: 4, hours: 3 },
          { month: 8, week: 1, hours: 3 },
          { month: 8, week: 2, hours: 3 },
        ] as any,
        orderIndex: 0,
        status: EntityStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "item_2",
        teachingContextId: "ctx_1",
        learningObjectiveId: null,
        planType: AcademicPlanType.PROSEM,
        category: "STS" as any,
        title: "Sumatif Tengah Semester (STS)",
        targetMonth: 9,
        targetSemester: 1,
        allocatedHours: 3,
        notes: null,
        weeklyDistribution: [{ month: 9, week: 4, hours: 3 }] as any,
        orderIndex: 1,
        status: EntityStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  it("exports PROSEM matrix to XLSX buffer correctly", async () => {
    const buffer = await exportProsemToXlsx(mockExportData);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(100);
  });

  it("exports PROTA document to DOCX buffer correctly", async () => {
    const buffer = await exportProtaToDocx(mockExportData);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(100);
  });
});
