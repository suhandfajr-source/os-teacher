import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth module
vi.mock("@/lib/auth", () => {
  return {
    auth: {
      api: {
        getSession: vi.fn(),
      },
    },
    prisma: {
      teacherProfile: {
        findUnique: vi.fn(),
      },
      teachingContext: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      classStudent: {
        findMany: vi.fn(),
      },
      studentMonitoringNote: {
        findMany: vi.fn(),
      },
      assessmentResult: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

import { getGlobalMonitoringOverview } from "../monitoring.actions";
import { auth, prisma } from "@/lib/auth";

describe("Stage 05 Performance Batching & Data Isolation Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "u-1" },
    } as unknown as never);

    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({
      id: "tp-1",
      userId: "u-1",
      activeSchoolId: "school-A",
      memberships: [
        { schoolId: "school-A", status: "ACTIVE", school: { id: "school-A", name: "School A" } },
      ],
    } as unknown as never);
  });

  describe("1. Query Count Invariance & No DB Loop", () => {
    it("executes exactly constant batch queries regardless of context count (2 vs 10 contexts)", async () => {
      // Setup 2 contexts
      const contexts2 = [
        {
          id: "ctx-1",
          classId: "class-7a",
          subjectId: "sub-math",
          academicPeriodId: "period-1",
          class: { name: "7A" },
          subject: { name: "Matematika" },
          academicPeriod: { year: "2026/2027", semester: "GANJIL" },
          gradePolicy: { status: "ACTIVE" },
        },
        {
          id: "ctx-2",
          classId: "class-7b",
          subjectId: "sub-math",
          academicPeriodId: "period-1",
          class: { name: "7B" },
          subject: { name: "Matematika" },
          academicPeriod: { year: "2026/2027", semester: "GANJIL" },
          gradePolicy: { status: "ACTIVE" },
        },
      ];

      vi.mocked(prisma.teachingContext.findMany).mockResolvedValueOnce(contexts2 as unknown as never);
      vi.mocked(prisma.classStudent.findMany).mockResolvedValueOnce([
        { classId: "class-7a", academicPeriodId: "period-1", studentId: "s-1" },
        { classId: "class-7b", academicPeriodId: "period-1", studentId: "s-2" },
      ] as unknown as never);
      vi.mocked(prisma.studentMonitoringNote.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.assessmentResult.findMany).mockResolvedValueOnce([]);

      await getGlobalMonitoringOverview();

      // Check query count for 2 contexts:
      // 1 teacherProfile.findUnique + 1 teachingContext.findMany + 1 classStudent.findMany + 1 studentMonitoringNote.findMany + 1 assessmentResult.findMany = 5 queries
      expect(prisma.classStudent.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.studentMonitoringNote.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.assessmentResult.findMany).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();
      vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u-1" } } as unknown as never);
      vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({
        id: "tp-1",
        userId: "u-1",
        activeSchoolId: "school-A",
        memberships: [
          { schoolId: "school-A", status: "ACTIVE", school: { id: "school-A", name: "School A" } },
        ],
      } as unknown as never);

      // Setup 10 contexts
      const contexts10 = Array.from({ length: 10 }, (_, i) => ({
        id: `ctx-${i + 1}`,
        classId: `class-${i + 1}`,
        subjectId: "sub-math",
        academicPeriodId: "period-1",
        class: { name: `Kelas ${i + 1}` },
        subject: { name: "Matematika" },
        academicPeriod: { year: "2026/2027", semester: "GANJIL" },
        gradePolicy: { status: "ACTIVE" },
      }));

      vi.mocked(prisma.teachingContext.findMany).mockResolvedValueOnce(contexts10 as unknown as never);
      vi.mocked(prisma.classStudent.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.studentMonitoringNote.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.assessmentResult.findMany).mockResolvedValueOnce([]);

      await getGlobalMonitoringOverview();

      // For 10 contexts, batch query count remains EXACTLY 1 each!
      expect(prisma.classStudent.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.studentMonitoringNote.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.assessmentResult.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("2. Shared Student Identity & Context-Owned Learning Data Isolation", () => {
    it("shares student roster between contexts but keeps notes and scores strictly separated by teachingContextId", async () => {
      // Same class (7A) and same period, but 2 different subjects (Math vs Science)
      const mathContext = {
        id: "ctx-math",
        classId: "class-7a",
        subjectId: "sub-math",
        academicPeriodId: "period-1",
        class: { name: "7A" },
        subject: { name: "Matematika" },
        academicPeriod: { year: "2026/2027", semester: "GANJIL" },
        gradePolicy: { status: "ACTIVE" },
      };

      const scienceContext = {
        id: "ctx-science",
        classId: "class-7a",
        subjectId: "sub-science",
        academicPeriodId: "period-1",
        class: { name: "7A" },
        subject: { name: "IPA" },
        academicPeriod: { year: "2026/2027", semester: "GANJIL" },
        gradePolicy: { status: "ACTIVE" },
      };

      vi.mocked(prisma.teachingContext.findMany).mockResolvedValueOnce([mathContext, scienceContext] as unknown as never);

      // Shared roster for 7A contains student s-1 and s-2
      vi.mocked(prisma.classStudent.findMany).mockResolvedValueOnce([
        { classId: "class-7a", academicPeriodId: "period-1", studentId: "s-1" },
        { classId: "class-7a", academicPeriodId: "period-1", studentId: "s-2" },
      ] as unknown as never);

      // Student s-1 has an open follow-up note ONLY in Math (ctx-math), NOT in Science
      vi.mocked(prisma.studentMonitoringNote.findMany).mockResolvedValueOnce([
        { teachingContextId: "ctx-math", studentId: "s-1" },
      ] as unknown as never);

      // Student s-2 is below KKTP ONLY in Science (ctx-science), NOT in Math
      vi.mocked(prisma.assessmentResult.findMany).mockResolvedValueOnce([
        {
          studentId: "s-2",
          finalScore: 65,
          assessment: {
            teachingContextId: "ctx-science",
            minimumPassingScore: 75,
          },
        },
      ] as unknown as never);

      const overviews = await getGlobalMonitoringOverview();

      expect(overviews).toHaveLength(2);

      const mathOverview = overviews.find((o) => o.teachingContextId === "ctx-math")!;
      expect(mathOverview.currentStudentCount).toBe(2);
      expect(mathOverview.studentsWithOpenFollowUp).toBe(1); // s-1
      expect(mathOverview.studentsWithBelowKktp).toBe(0); // 0 below KKTP in Math

      const scienceOverview = overviews.find((o) => o.teachingContextId === "ctx-science")!;
      expect(scienceOverview.currentStudentCount).toBe(2);
      expect(scienceOverview.studentsWithOpenFollowUp).toBe(0); // 0 open notes in Science
      expect(scienceOverview.studentsWithBelowKktp).toBe(1); // s-2 below KKTP in Science
    });

    it("handles empty context list gracefully without throwing", async () => {
      vi.mocked(prisma.teachingContext.findMany).mockResolvedValueOnce([]);

      const overviews = await getGlobalMonitoringOverview();
      expect(overviews).toEqual([]);
      expect(prisma.classStudent.findMany).not.toHaveBeenCalled();
    });

    it("handles context with 0 students in roster correctly", async () => {
      const emptyContext = {
        id: "ctx-empty",
        classId: "class-empty",
        subjectId: "sub-art",
        academicPeriodId: "period-1",
        class: { name: "Seni Budaya" },
        subject: { name: "Seni" },
        academicPeriod: { year: "2026/2027", semester: "GANJIL" },
        gradePolicy: null,
      };

      vi.mocked(prisma.teachingContext.findMany).mockResolvedValueOnce([emptyContext] as unknown as never);
      vi.mocked(prisma.classStudent.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.studentMonitoringNote.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.assessmentResult.findMany).mockResolvedValueOnce([]);

      const overviews = await getGlobalMonitoringOverview();
      expect(overviews).toHaveLength(1);
      expect(overviews[0].currentStudentCount).toBe(0);
      expect(overviews[0].studentsWithOpenFollowUp).toBe(0);
      expect(overviews[0].studentsWithBelowKktp).toBe(0);
      expect(overviews[0].hasActiveGradePolicy).toBe(false);
    });
  });
});
