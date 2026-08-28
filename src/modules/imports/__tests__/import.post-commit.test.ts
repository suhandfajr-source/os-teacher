import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeRosterImportAction } from "../import.actions";
import * as authLib from "@/lib/authorization";
import * as importService from "../import.service";
import * as nextCache from "next/cache";

vi.mock("@/lib/authorization", () => ({
  verifyActiveSchoolMembership: vi.fn(),
  verifyTeachingContextAccess: vi.fn(),
}));

vi.mock("../import.service", () => ({
  executeRosterImport: vi.fn(),
  parseRawWorkbook: vi.fn(),
  validateRosterImport: vi.fn(),
  validateHistoricalSessionsImport: vi.fn(),
  executeHistoricalSessionsImport: vi.fn(),
  validateHistoricalAttendanceImport: vi.fn(),
  executeHistoricalAttendanceImport: vi.fn(),
  validateHistoricalAssessmentsImport: vi.fn(),
  executeHistoricalAssessmentsImport: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Import Engine — Post-Commit Safe Revalidation & Error Invariants", () => {
  const teacherProfileId = "tp-post-commit-1";
  const activeSchoolId = "sch-post-commit-1";
  const teachingContextId = "tc-post-commit-1";
  const token = "mock-token-abc";
  const validRows = [
    { rowNum: 2, namaLengkap: "Siswa 1", nis: "10001", status: "VALID" as const, action: "CREATE" as const, message: "Valid" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authLib.verifyActiveSchoolMembership).mockResolvedValue({
      session: { user: { id: "user-1" } } as never,
      profile: { id: teacherProfileId, activeSchoolId } as never,
      activeSchoolId,
      activeSchool: { id: activeSchoolId, name: "SMA Post Commit" } as never,
    });

    vi.mocked(authLib.verifyTeachingContextAccess).mockResolvedValue({
      session: { user: { id: "user-1" } } as never,
      profile: { id: teacherProfileId, activeSchoolId } as never,
      activeSchoolId,
      activeSchool: { id: activeSchoolId, name: "SMA Post Commit" } as never,
      context: {
        id: teachingContextId,
        schoolId: activeSchoolId,
        teacherProfileId,
        classId: "cls-1",
        academicPeriodId: "per-1",
        subjectId: "sub-1",
      } as never,
    });
  });

  it("returns business SUCCESS even when post-commit revalidatePath throws an error (14-row roster)", async () => {
    const fourteenRows = Array.from({ length: 14 }, (_, i) => ({
      rowNum: i + 2,
      namaLengkap: `Siswa Ke-${i + 1}`,
      nis: `1000${i + 1}`,
      status: "VALID" as const,
      action: "CREATE" as const,
      message: "Siap didaftarkan sebagai siswa baru.",
    }));

    const mockSuccessResult = {
      success: true,
      category: "ROSTER" as const,
      totalRows: 14,
      importedCount: 14,
      reusedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      message: "Berhasil memproses 14 siswa ke kelas.",
    };

    vi.mocked(importService.executeRosterImport).mockResolvedValue(mockSuccessResult);

    // Simulate revalidatePath throwing an unhandled RSC error / cache failure
    vi.mocked(nextCache.revalidatePath).mockImplementation(() => {
      throw new Error("Simulated Next.js RSC revalidation worker failure (Error #441 trigger)");
    });

    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Action MUST complete and return the committed business success
    const result = await executeRosterImportAction(teachingContextId, fourteenRows, token);

    expect(result).toEqual(mockSuccessResult);
    expect(result.success).toBe(true);
    expect(result.importedCount).toBe(14);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[SafeRevalidation] Non-blocking post-commit cache invalidation failed"),
      expect.stringContaining("Simulated Next.js RSC revalidation worker failure")
    );

    consoleWarnSpy.mockRestore();
  });

  it("strictly propagates genuine transaction errors without returning false success", async () => {
    // Simulate transaction / authorization / token failure in executeRosterImport
    vi.mocked(importService.executeRosterImport).mockRejectedValue(
      new Error("Sesi import sudah pernah digunakan (one-time token replay detected).")
    );

    await expect(
      executeRosterImportAction(teachingContextId, validRows, token)
    ).rejects.toThrow("one-time token replay detected");

    // revalidatePath must NOT run if transaction threw
    expect(nextCache.revalidatePath).not.toHaveBeenCalled();
  });

  it("strictly propagates authorization rejections", async () => {
    vi.mocked(authLib.verifyTeachingContextAccess).mockRejectedValue(
      new Error("Forbidden: You do not own this teaching context")
    );

    await expect(
      executeRosterImportAction(teachingContextId, validRows, token)
    ).rejects.toThrow("Forbidden: You do not own this teaching context");

    expect(importService.executeRosterImport).not.toHaveBeenCalled();
    expect(nextCache.revalidatePath).not.toHaveBeenCalled();
  });
});
