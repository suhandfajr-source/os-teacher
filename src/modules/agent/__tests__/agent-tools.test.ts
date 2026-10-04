import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateAttendanceStats,
  calculateAcademicGradeStats,
} from "../tools/agent-deterministic-math";
import {
  getClassStudentsTool,
  getStudentAttendanceSummaryTool,
  getStudentAcademicSummaryTool,
  analyzeClassPerformanceTool,
} from "../tools/agent-query.tools";
import * as auth from "@/lib/authorization";

vi.mock("@/lib/authorization", () => ({
  verifyActiveSchoolMembership: vi.fn(),
  verifyTeacherClassAccess: vi.fn(),
  verifyClassRosterAccess: vi.fn(),
}));

const mockExecutionOptions = {
  messages: [],
  toolCallId: "call_mock",
  context: {},
} as any;

describe("Klassa Agent Deterministic Tools & Scope Rombel B2 (Stage 12 Story 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Deterministic Math Calculations (100% Non-LLM)", () => {
    it("calculates attendance stats correctly with proper categories", () => {
      // 18 hadir, 1 sakit, 1 izin, 0 alpa = 18/20 = 90%
      const stats1 = calculateAttendanceStats({ hadir: 18, sakit: 1, izin: 1, alpa: 0 });
      expect(stats1.totalPertemuan).toBe(20);
      expect(stats1.persentaseKehadiran).toBe(90);
      expect(stats1.kategori).toBe("SANGAT_BAIK");

      // 14 hadir, 2 sakit, 2 izin, 2 alpa = 14/20 = 70% (<75%)
      const stats2 = calculateAttendanceStats({ hadir: 14, sakit: 2, izin: 2, alpa: 2 });
      expect(stats2.totalPertemuan).toBe(20);
      expect(stats2.persentaseKehadiran).toBe(70);
      expect(stats2.kategori).toBe("PERLU_PERHATIAN");

      // Belum ada data presensi
      const stats3 = calculateAttendanceStats({ hadir: 0, sakit: 0, izin: 0, alpa: 0 });
      expect(stats3.totalPertemuan).toBe(0);
      expect(stats3.persentaseKehadiran).toBe(0);
      expect(stats3.kategori).toBe("BELUM_ADA_DATA");
    });

    it("calculates academic grade stats with exact decimal rounding and KKM evaluation", () => {
      // Nilai [80, 85, 90, 75], KKM 75
      const stats1 = calculateAcademicGradeStats([80, 85, 90, 75], 75);
      expect(stats1.totalItem).toBe(4);
      expect(stats1.rataRata).toBe(82.5);
      expect(stats1.nilaiTertinggi).toBe(90);
      expect(stats1.nilaiTerendah).toBe(75);
      expect(stats1.tuntasCount).toBe(4);
      expect(stats1.remedialCount).toBe(0);
      expect(stats1.statusKetercapaian).toBe("TUNTAS_KLASIKAL");

      // Nilai [60, 65, 70, 75], KKM 75 -> 1 tuntas dari 4 (25% < 75%)
      const stats2 = calculateAcademicGradeStats([60, 65, 70, 75], 75);
      expect(stats2.rataRata).toBe(67.5);
      expect(stats2.tuntasCount).toBe(1);
      expect(stats2.remedialCount).toBe(3);
      expect(stats2.statusKetercapaian).toBe("PERLU_REMEDIAL");

      // Kosong
      const stats3 = calculateAcademicGradeStats([], 75);
      expect(stats3.totalItem).toBe(0);
      expect(stats3.statusKetercapaian).toBe("BELUM_ADA_NILAI");
    });
  });

  describe("Scope Rombel B2 Security Enforcement on Tools", () => {
    it("rejects getClassStudentsTool when teacher does not teach the class", async () => {
      vi.mocked(auth.verifyClassRosterAccess).mockRejectedValueOnce(
        new Error("Forbidden: You do not teach this class")
      );

      const result = (await getClassStudentsTool.execute?.(
        { classId: "forbidden-class-id" },
        mockExecutionOptions
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("Akses ditolak: Anda bukan pengampu rombel ini.");
    });

    it("rejects getStudentAttendanceSummaryTool when teacher does not teach the class", async () => {
      vi.mocked(auth.verifyClassRosterAccess).mockRejectedValueOnce(
        new Error("Forbidden: You do not teach this class")
      );

      const result = (await getStudentAttendanceSummaryTool.execute?.(
        { classId: "other-class" },
        mockExecutionOptions
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("Akses ditolak: Anda bukan pengampu rombel ini.");
    });

    it("rejects getStudentAcademicSummaryTool when teacher does not teach the class", async () => {
      vi.mocked(auth.verifyClassRosterAccess).mockRejectedValueOnce(
        new Error("Forbidden: You do not teach this class")
      );

      const result = (await getStudentAcademicSummaryTool.execute?.(
        { classId: "other-class" },
        mockExecutionOptions
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("Akses ditolak: Anda bukan pengampu rombel ini.");
    });

    it("rejects analyzeClassPerformanceTool when teacher does not teach the class", async () => {
      vi.mocked(auth.verifyClassRosterAccess).mockRejectedValueOnce(
        new Error("Forbidden: You do not teach this class")
      );

      const result = (await analyzeClassPerformanceTool.execute?.(
        { classId: "other-class", kkm: 75 },
        mockExecutionOptions
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("Akses ditolak: Anda bukan pengampu rombel ini.");
    });
  });
});
