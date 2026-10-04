import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sanitizeInsightString,
  sanitizeMetadata,
  recordAnonymizedInsight,
  getPulseSummaryMetrics,
  getTopClassroomStruggles,
  getCurriculumBottlenecks,
  getActivityHeatmapData,
  getKlassaPulseAnalytics,
  seedPulseDemoData,
} from "../pulse/pulse.service";
import {
  getKlassaPulseAnalyticsAction,
  seedKlassaPulseDemoDataAction,
} from "../pulse/pulse.actions";
import { prisma } from "@/lib/auth";
import * as superadminModule from "@/lib/superadmin";

vi.mock("@/lib/superadmin", () => ({
  requireSuperAdmin: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  prisma: {
    agentInsightAggregate: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("Story 6: Klassa Pulse Aggregation Engine & Superadmin Insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Zero-PII Sanitization & UU PDP Compliance", () => {
    it("scrubs email addresses and sensitive ID sequences from metric strings", () => {
      const dirty = "Keluhan guru budi@sekolah.sch.id tentang NIS 123456789012 gagal input";
      const cleaned = sanitizeInsightString(dirty);

      expect(cleaned).not.toContain("budi@sekolah.sch.id");
      expect(cleaned).not.toContain("123456789012");
      expect(cleaned).toContain("[TERANONIM]");
      expect(cleaned).toContain("[ID_TERANONIM]");
    });

    it("sanitizes metadata recursively and blocks sensitive identity keys (M-01)", () => {
      const dirtyMetadata = {
        subject: "Matematika",
        studentName: "Ahmad Dahlan", // PII Key
        nisn: "0012345678", // PII Key
        rawSnippet: "Siswa ini bermasalah", // PII Key
        notes: "Kontak orang tua di ortu@gmail.com atau 081234567890",
        nested: {
          subtopic: "Aljabar",
          teacher_name: "Ibu Siti", // PII Key
        },
      };

      const cleaned = sanitizeMetadata(dirtyMetadata);

      expect(cleaned).toBeDefined();
      expect(cleaned!.subject).toBe("Matematika");
      expect(cleaned!.studentName).toBeUndefined();
      expect(cleaned!.nisn).toBeUndefined();
      expect(cleaned!.rawSnippet).toBeUndefined();
      expect(cleaned!.notes).toContain("[TERANONIM]");
      expect(cleaned!.notes).toContain("[ID_TERANONIM]");
      expect((cleaned!.nested as any).teacher_name).toBeUndefined();
      expect((cleaned!.nested as any).subtopic).toBe("Aljabar");
    });

    it("records insight strictly without teacher or student personal identity", async () => {
      vi.mocked(prisma.agentInsightAggregate.create).mockResolvedValueOnce({
        id: "agg-1",
      } as any);

      await recordAnonymizedInsight({
        period: "2026-10",
        category: "STUDENT_STRUGGLE",
        metricKey: "Literasi Bacaan Rendah",
        metricValue: 80,
        sampleCount: 5,
        tags: ["Pedagogi", "SMP"],
      });

      expect(prisma.agentInsightAggregate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          period: "2026-10",
          category: "STUDENT_STRUGGLE",
          metricKey: "Literasi Bacaan Rendah",
          sampleCount: 5,
        }),
      });

      // Verifikasi tidak ada field guru atau siswa yang dikirim
      const callData = vi.mocked(prisma.agentInsightAggregate.create).mock.calls[0][0].data;
      expect((callData as any).teacherId).toBeUndefined();
      expect((callData as any).studentId).toBeUndefined();
      expect((callData as any).nisn).toBeUndefined();
    });
  });

  describe("2. Deterministic Mathematical Aggregation", () => {
    it("calculates summary metrics, average burnout index, and peak active hours correctly", async () => {
      const mockAggregates = [
        {
          category: "BURNOUT_RISK",
          metricKey: "Koreksi Rapor",
          metricValue: 70,
          sampleCount: 2,
        },
        {
          category: "BURNOUT_RISK",
          metricKey: "Modul Ajar",
          metricValue: 50,
          sampleCount: 2,
        },
        {
          category: "OPERATIONAL_HOURS",
          metricKey: "21",
          metricValue: 1,
          sampleCount: 10,
        },
        {
          category: "STUDENT_STRUGGLE",
          metricKey: "Siswa Pasif",
          metricValue: 1,
          sampleCount: 8,
        },
      ];

      vi.mocked(prisma.agentInsightAggregate.findMany).mockResolvedValueOnce(
        mockAggregates as any
      );

      const summary = await getPulseSummaryMetrics("2026-10");

      // Burnout calculation: (70*2 + 50*2) / 4 = 240 / 4 = 60
      expect(summary.burnoutIndex).toBe(60);
      expect(summary.burnoutLevel).toBe("WASPADA");
      expect(summary.peakActiveHours).toBe("21:00 - 23:00 WIB");
      expect(summary.topStruggleTopic).toBe("Siswa Pasif");
      expect(summary.totalInsights).toBe(22);
    });

    it("aggregates top classroom struggles with accurate percentages", async () => {
      const mockStruggles = [
        {
          category: "STUDENT_STRUGGLE",
          metricKey: "Literasi Rendah",
          sampleCount: 60,
          tags: ["Pedagogi"],
        },
        {
          category: "STUDENT_STRUGGLE",
          metricKey: "Konsentrasi Singkat",
          sampleCount: 40,
          tags: ["Fokus"],
        },
      ];

      vi.mocked(prisma.agentInsightAggregate.findMany).mockResolvedValueOnce(
        mockStruggles as any
      );

      const topStruggles = await getTopClassroomStruggles(5, "2026-10");

      expect(topStruggles).toHaveLength(2);
      expect(topStruggles[0].topic).toBe("Literasi Rendah");
      expect(topStruggles[0].frequency).toBe(60);
      expect(topStruggles[0].percentage).toBe(60); // 60/100 = 60%
      expect(topStruggles[1].percentage).toBe(40); // 40/100 = 40%
    });

    it("aggregates curriculum bottlenecks with subject metadata", async () => {
      const mockBottlenecks = [
        {
          category: "CURRICULUM_BOTTLENECK",
          metricKey: "Pecahan Aljabar",
          metricValue: 85,
          sampleCount: 30,
          metadata: { subject: "Matematika", gradeLevel: "SMP" },
        },
      ];

      vi.mocked(prisma.agentInsightAggregate.findMany).mockResolvedValueOnce(
        mockBottlenecks as any
      );

      const bottlenecks = await getCurriculumBottlenecks(5, "2026-10");

      expect(bottlenecks).toHaveLength(1);
      expect(bottlenecks[0].topic).toBe("Pecahan Aljabar");
      expect(bottlenecks[0].subject).toBe("Matematika");
      expect(bottlenecks[0].gradeLevel).toBe("SMP");
      expect(bottlenecks[0].struggleRate).toBe(85);
    });

    it("constructs full 7x24 activity heatmap grid (168 slots)", async () => {
      vi.mocked(prisma.agentInsightAggregate.findMany).mockResolvedValueOnce([]);

      const heatmap = await getActivityHeatmapData("2026-10");

      expect(heatmap).toHaveLength(7 * 24); // 168 slot
      const nightSlot = heatmap.find((s) => s.dayOfWeek === 1 && s.hour === 20);
      expect(nightSlot).toBeDefined();
      expect(nightSlot!.intensity).toBeGreaterThan(0);
    });
  });

  describe("3. Superadmin Security Gate & Server Actions", () => {
    it("rejects non-superadmin from viewing Klassa Pulse analytics", async () => {
      vi.mocked(superadminModule.requireSuperAdmin).mockRejectedValueOnce(
        new Error("Akses ditolak: Hanya Superadmin yang diizinkan.")
      );

      const res = await getKlassaPulseAnalyticsAction();

      expect(res.success).toBe(false);
      expect(res.error).toContain("Akses ditolak");
    });

    it("allows superadmin to fetch full Klassa Pulse analytics", async () => {
      vi.mocked(superadminModule.requireSuperAdmin).mockResolvedValueOnce({
        userId: "admin-1",
      });
      vi.mocked(prisma.agentInsightAggregate.findMany).mockResolvedValue([]);

      const res = await getKlassaPulseAnalyticsAction();

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.summary).toBeDefined();
      expect(res.data?.topStruggles).toBeDefined();
    });

    it("rejects invalid period format string gracefully (m-01)", async () => {
      vi.mocked(superadminModule.requireSuperAdmin).mockResolvedValueOnce({
        userId: "admin-1",
      });

      const res = await getKlassaPulseAnalyticsAction({
        period: "invalid-date-format",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it("seeds realistic demo data successfully when invoked by superadmin", async () => {
      vi.mocked(superadminModule.requireSuperAdmin).mockResolvedValueOnce({
        userId: "admin-1",
      });
      vi.mocked(prisma.agentInsightAggregate.create).mockResolvedValue({} as any);

      const res = await seedKlassaPulseDemoDataAction();

      expect(res.success).toBe(true);
      expect(res.count).toBeGreaterThan(0);
    });
  });
});
