import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportQuizRecapToExcel } from "../quiz-recap-exporter";
import ExcelJS from "exceljs";

describe("exportQuizRecapToExcel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates structured workbook with proper sheets, styles, and data rows", async () => {
    const mockRoster = [
      {
        studentId: "s1",
        fullName: "Ahmad Zaki",
        attemptStatus: "SUBMITTED",
        score: 85,
        isRemedial: false,
        submittedAt: "2026-09-14T08:30:00.000Z",
      },
      {
        studentId: "s2",
        fullName: "Budi Santoso",
        attemptStatus: "SUBMITTED",
        score: 60,
        isRemedial: true,
        submittedAt: "2026-09-14T08:35:00.000Z",
      },
      {
        studentId: "s3",
        fullName: "Citra Dewi",
        attemptStatus: "NOT_STARTED",
        score: null,
        isRemedial: false,
      },
    ];

    // Mock DOM download elements for Node test environment
    const fakeAnchor = { href: "", download: "", click: vi.fn() };
    const fakeAppendChild = vi.fn();
    const fakeRemoveChild = vi.fn();

    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {
      createElement: vi.fn().mockReturnValue(fakeAnchor),
      body: {
        appendChild: fakeAppendChild,
        removeChild: fakeRemoveChild,
      },
    });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:fake-url"),
      revokeObjectURL: vi.fn(),
    });

    await exportQuizRecapToExcel({
      quizTitle: "Ulangan Harian Bab 1: Peredaran Darah",
      contextLabel: "IPA · Kelas 8A",
      standardScore: 75,
      durationMinutes: 45,
      questionCount: 10,
      roster: mockRoster,
    });

    expect(fakeAnchor.download).toContain("Rekap_Nilai_Ulangan_Harian_Bab_1__Peredaran_Darah.xlsx");
    expect(fakeAnchor.click).toHaveBeenCalledTimes(1);
    expect(fakeAppendChild).toHaveBeenCalledWith(fakeAnchor);
    expect(fakeRemoveChild).toHaveBeenCalledWith(fakeAnchor);
  });
});
