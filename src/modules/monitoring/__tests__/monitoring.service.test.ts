import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  summarizeStudentAttendance,
  summarizeStudentAssessments,
  calculateClassMonitoringMetrics,
  composeStudentActivityTimeline,
  RawAssessmentResultForMonitoring,
  RawAttendanceForTimeline,
  RawNoteForTimeline,
} from "../monitoring.service";
import { StudentMonitoringRow } from "../monitoring.types";

describe("Stage 05 Monitoring Service Unit Tests", () => {
  describe("summarizeStudentAttendance", () => {
    it("correctly counts all attendance statuses without inventing rate percentages", () => {
      const records = [
        { status: "PRESENT" as const },
        { status: "PRESENT" as const },
        { status: "LATE" as const },
        { status: "SICK" as const },
        { status: "PERMISSION" as const },
        { status: "ABSENT" as const },
      ];

      const result = summarizeStudentAttendance(records);

      expect(result.totalRecordedSessions).toBe(6);
      expect(result.presentCount).toBe(2);
      expect(result.lateCount).toBe(1);
      expect(result.sickCount).toBe(1);
      expect(result.permissionCount).toBe(1);
      expect(result.absentCount).toBe(1);
    });

    it("handles zero sessions cleanly without error", () => {
      const result = summarizeStudentAttendance([]);
      expect(result.totalRecordedSessions).toBe(0);
      expect(result.presentCount).toBe(0);
      expect(result.lateCount).toBe(0);
      expect(result.sickCount).toBe(0);
      expect(result.permissionCount).toBe(0);
      expect(result.absentCount).toBe(0);
    });
  });

  describe("summarizeStudentAssessments", () => {
    it("includes only COMPLETED assessments and GRADED numeric results", () => {
      const rawResults: RawAssessmentResultForMonitoring[] = [
        // 1. Valid completed + graded above KKTP
        {
          id: "r1",
          status: "GRADED",
          finalScore: new Prisma.Decimal(80),
          assessment: {
            id: "a1",
            title: "UH 1",
            status: "COMPLETED",
            assessmentDate: new Date("2026-08-10"),
            minimumPassingScore: new Prisma.Decimal(75),
            assessmentType: { id: "t1", name: "Ulangan Harian" },
          },
        },
        // 2. Valid completed + graded below KKTP
        {
          id: "r2",
          status: "GRADED",
          finalScore: new Prisma.Decimal(65),
          assessment: {
            id: "a2",
            title: "UH 2",
            status: "COMPLETED",
            assessmentDate: new Date("2026-08-15"),
            minimumPassingScore: new Prisma.Decimal(75),
            assessmentType: { id: "t1", name: "Ulangan Harian" },
          },
          remedialAttempts: [
            {
              id: "rem1",
              score: new Prisma.Decimal(85),
              attemptDate: new Date("2026-08-16"),
              note: "Remedial UH 2",
            },
          ],
        },
        // 3. IN_PROGRESS assessment - MUST BE EXCLUDED from gradedResultCount and KKTP
        {
          id: "r3",
          status: "GRADED",
          finalScore: new Prisma.Decimal(50),
          assessment: {
            id: "a3",
            title: "Tugas 1",
            status: "IN_PROGRESS",
            assessmentDate: new Date("2026-08-18"),
            minimumPassingScore: new Prisma.Decimal(75),
            assessmentType: { id: "t2", name: "Tugas" },
          },
        },
        // 4. PENDING result on COMPLETED assessment - MUST BE EXCLUDED
        {
          id: "r4",
          status: "PENDING",
          finalScore: null,
          assessment: {
            id: "a4",
            title: "UH 3",
            status: "COMPLETED",
            assessmentDate: new Date("2026-08-20"),
            minimumPassingScore: new Prisma.Decimal(75),
            assessmentType: { id: "t1", name: "Ulangan Harian" },
          },
        },
        // 5. ABSENT result - MUST BE EXCLUDED from numeric/KKTP
        {
          id: "r5",
          status: "ABSENT",
          finalScore: null,
          assessment: {
            id: "a5",
            title: "UH 4",
            status: "COMPLETED",
            assessmentDate: new Date("2026-08-21"),
            minimumPassingScore: new Prisma.Decimal(75),
            assessmentType: { id: "t1", name: "Ulangan Harian" },
          },
        },
      ];

      const summary = summarizeStudentAssessments(rawResults);

      expect(summary.gradedResultCount).toBe(2);
      expect(summary.belowKktpCount).toBe(1); // Only r2 is completed + graded < 75
      expect(summary.remedialCount).toBe(1);
      expect(summary.latestGradedScore).toBe(65); // r2 is the latest completed graded (2026-08-15)
    });

    it("handles assessment without KKTP cleanly (does not invent belowKktpCount)", () => {
      const rawResults: RawAssessmentResultForMonitoring[] = [
        {
          id: "r1",
          status: "GRADED",
          finalScore: new Prisma.Decimal(40),
          assessment: {
            id: "a1",
            title: "Kuis",
            status: "COMPLETED",
            assessmentDate: new Date("2026-08-10"),
            minimumPassingScore: null, // No KKTP set
            assessmentType: { id: "t1", name: "Kuis" },
          },
        },
      ];

      const summary = summarizeStudentAssessments(rawResults);
      expect(summary.gradedResultCount).toBe(1);
      expect(summary.belowKktpCount).toBe(0);
      expect(summary.latestGradedScore).toBe(40);
    });
  });

  describe("calculateClassMonitoringMetrics (Unique Student Semantics)", () => {
    it("counts unique students rather than summing raw records", () => {
      const rows: StudentMonitoringRow[] = [
        {
          studentId: "s1",
          fullName: "Ahmad",
          nis: "101",
          attendance: { totalRecordedSessions: 5, presentCount: 4, lateCount: 0, sickCount: 1, permissionCount: 0, absentCount: 0 },
          assessment: { gradedResultCount: 3, latestGradedScore: 60, belowKktpCount: 2, remedialCount: 2 }, // 2 below KKTP
          runningPerformance: null,
          openFollowUpCount: 3, // 3 open notes
          notesCount: 3,
        },
        {
          studentId: "s2",
          fullName: "Budi",
          nis: "102",
          attendance: { totalRecordedSessions: 5, presentCount: 5, lateCount: 0, sickCount: 0, permissionCount: 0, absentCount: 0 },
          assessment: { gradedResultCount: 3, latestGradedScore: 90, belowKktpCount: 0, remedialCount: 0 },
          runningPerformance: null,
          openFollowUpCount: 0,
          notesCount: 0,
        },
        {
          studentId: "s3",
          fullName: "Citra",
          nis: "103",
          attendance: { totalRecordedSessions: 5, presentCount: 3, lateCount: 0, sickCount: 0, permissionCount: 1, absentCount: 1 },
          assessment: { gradedResultCount: 2, latestGradedScore: 70, belowKktpCount: 1, remedialCount: 1 },
          runningPerformance: null,
          openFollowUpCount: 1,
          notesCount: 2,
        },
      ];

      const metrics = calculateClassMonitoringMetrics(rows);

      expect(metrics.totalCurrentStudents).toBe(3);
      expect(metrics.studentsWithBelowKktp).toBe(2); // Ahmad (2) and Citra (1) -> 2 unique students
      expect(metrics.studentsWithRemedial).toBe(2); // Ahmad and Citra -> 2 unique students
      expect(metrics.studentsWithAbsence).toBe(2); // Ahmad (sick:1) and Citra (perm:1, absent:1) -> 2 unique students
      expect(metrics.studentsWithOpenFollowUp).toBe(2); // Ahmad (3) and Citra (1) -> 2 unique students
    });
  });

  describe("composeStudentActivityTimeline", () => {
    it("merges events chronologically descending without inventing score transitions", () => {
      const attendance: RawAttendanceForTimeline[] = [
        {
          id: "att1",
          status: "PRESENT",
          note: null,
          createdAt: new Date("2026-08-01"),
          teachingSession: {
            id: "ts1",
            date: new Date("2026-08-01"),
            plannedTopic: "Pengantar Pecahan",
            actualTopic: "Pengantar Pecahan",
          },
        },
      ];

      const assessments: RawAssessmentResultForMonitoring[] = [
        {
          id: "r1",
          status: "GRADED",
          finalScore: new Prisma.Decimal(80),
          assessment: {
            id: "a1",
            title: "UH Pecahan",
            status: "COMPLETED",
            assessmentDate: new Date("2026-08-10"),
            minimumPassingScore: new Prisma.Decimal(75),
            assessmentType: { id: "t1", name: "UH" },
          },
          remedialAttempts: [
            {
              id: "rem1",
              score: new Prisma.Decimal(85),
              attemptDate: new Date("2026-08-15"),
              note: "Mengerjakan soal perbaikan",
            },
          ],
        },
      ];

      const notes: RawNoteForTimeline[] = [
        {
          id: "n1",
          content: "Perlu bimbingan tambahan operasi pembagian",
          requiresFollowUp: true,
          resolvedAt: null,
          isArchived: false,
          createdAt: new Date("2026-08-12"),
        },
      ];

      const timeline = composeStudentActivityTimeline(attendance, assessments, notes);

      expect(timeline.length).toBe(4);
      // Descending order:
      // 1. Remedial (2026-08-15)
      // 2. Note (2026-08-12)
      // 3. Assessment (2026-08-10)
      // 4. Attendance (2026-08-01)
      expect(timeline[0].type).toBe("REMEDIAL");
      expect(timeline[0].title).toBe("Remedial: UH Pecahan");
      expect(timeline[0].description).toContain("Skor Remedial: 85.0");

      expect(timeline[1].type).toBe("NOTE");
      expect(timeline[1].title).toBe("Catatan Monitoring Guru");

      expect(timeline[2].type).toBe("ASSESSMENT");
      expect(timeline[2].title).toBe("Penilaian: UH Pecahan");
      expect(timeline[2].badge?.text).toBe("Tuntas");

      expect(timeline[3].type).toBe("ATTENDANCE");
      expect(timeline[3].badge?.text).toBe("Hadir");
    });
  });
});
