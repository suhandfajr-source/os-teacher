import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportQuizRecapToExcel } from "../quiz-recap-exporter";
import * as XLSX from "xlsx";

vi.mock("xlsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("xlsx")>();
  return {
    ...actual,
    writeFile: vi.fn(),
  };
});

describe("exportQuizRecapToExcel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates structured workbook and triggers writeFile with sanitized filename", () => {
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

    exportQuizRecapToExcel({
      quizTitle: "Ulangan Harian Bab 1: Peredaran Darah",
      contextLabel: "IPA · Kelas 8A",
      standardScore: 75,
      durationMinutes: 45,
      questionCount: 10,
      roster: mockRoster,
    });

    expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
    const [wb, filename] = vi.mocked(XLSX.writeFile).mock.calls[0];

    expect(filename).toContain("Rekap_Nilai_Ulangan_Harian_Bab_1__Peredaran_Darah.xlsx");
    expect(wb.SheetNames).toContain("Rekap Nilai");

    const sheet = wb.Sheets["Rekap Nilai"];
    expect(sheet).toBeDefined();
  });
});
