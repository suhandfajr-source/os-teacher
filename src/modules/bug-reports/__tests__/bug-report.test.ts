import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBugReport, listBugReports, updateBugReport } from "../bug-report.service";
import { prisma } from "@/lib/auth";
import { BugReportCategory, BugReportPriority, BugReportStatus } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  prisma: {
    bugReport: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe("BugReportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a bug report with generated ticketNumber", async () => {
    vi.mocked(prisma.bugReport.findFirst).mockResolvedValueOnce(null);
    (prisma.bugReport.create as any).mockImplementationOnce(async ({ data }: any) => ({
      id: "br_123",
      ...data,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await createBugReport({
      title: "UI button overlap",
      description: "Tombol simpan bertumpuk di layar kecil",
      category: BugReportCategory.UI_UX,
      pageUrl: "/guru/jadwal",
    });

    expect(result.ticketNumber).toMatch(/^TICK-\d{4}-0001$/);
    expect(result.status).toBe(BugReportStatus.OPEN);
    expect(result.priority).toBe(BugReportPriority.MEDIUM);
    expect(prisma.bugReport.create).toHaveBeenCalledOnce();
  });

  it("should increment ticketNumber if previous exists", async () => {
    const now = new Date();
    const yearSuffix = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const prefix = `TICK-${yearSuffix}${month}-`;

    vi.mocked(prisma.bugReport.findFirst).mockResolvedValueOnce({
      ticketNumber: `${prefix}0005`,
    } as any);

    (prisma.bugReport.create as any).mockImplementationOnce(async ({ data }: any) => ({
      id: "br_124",
      ...data,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await createBugReport({
      title: "Error 500 when saving",
      description: "Database timeout",
    });

    expect(result.ticketNumber).toBe(`${prefix}0006`);
  });

  it("should update status and auto-fill resolvedAt on RESOLVED", async () => {
    (prisma.bugReport.update as any).mockImplementationOnce(async ({ where, data }: any) => ({
      id: where.id,
      ticketNumber: "TICK-2610-0001",
      title: "Fixed issue",
      description: "Fixed",
      category: BugReportCategory.FEATURE_ERROR,
      status: data.status,
      priority: BugReportPriority.HIGH,
      pageUrl: null,
      deviceInfo: null,
      attachmentUrls: [],
      adminNotes: data.adminNotes || null,
      resolvedAt: data.resolvedAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: null,
      reporterEmail: null,
    }));

    const res = await updateBugReport("br_123", {
      status: BugReportStatus.RESOLVED,
      adminNotes: "Bug berhasil diperbaiki di commit abc.",
    });

    expect(res.status).toBe(BugReportStatus.RESOLVED);
    expect(res.resolvedAt).toBeInstanceOf(Date);
  });
});
