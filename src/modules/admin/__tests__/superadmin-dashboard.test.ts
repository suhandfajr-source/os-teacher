import { describe, it, expect } from "vitest";
import { normalizeGradeKey } from "../admin-stats.service";

describe("Superadmin Grade Level Normalizer & Aggregation Engine", () => {
  it("normalizes Arabic numbers in gradeLevel or className correctly", () => {
    expect(normalizeGradeKey("7", "7-A")).toEqual({
      key: "7",
      label: "Kelas 7 (SMP/MTs)",
      order: 7,
    });

    expect(normalizeGradeKey(null, "Kelas 8B")).toEqual({
      key: "8",
      label: "Kelas 8 (SMP/MTs)",
      order: 8,
    });

    expect(normalizeGradeKey("9", "9-C")).toEqual({
      key: "9",
      label: "Kelas 9 (SMP/MTs)",
      order: 9,
    });
  });

  it("normalizes Roman numerals in gradeLevel or className correctly", () => {
    expect(normalizeGradeKey("VII", "VII-1")).toEqual({
      key: "7",
      label: "Kelas 7 (SMP/MTs)",
      order: 7,
    });

    expect(normalizeGradeKey("VIII", "VIII-A")).toEqual({
      key: "8",
      label: "Kelas 8 (SMP/MTs)",
      order: 8,
    });

    expect(normalizeGradeKey("IX", "IX-F")).toEqual({
      key: "9",
      label: "Kelas 9 (SMP/MTs)",
      order: 9,
    });

    expect(normalizeGradeKey("X", "X RPL 1")).toEqual({
      key: "10",
      label: "Kelas 10 (SMA/SMK)",
      order: 10,
    });

    expect(normalizeGradeKey("XI", "XI IPA 2")).toEqual({
      key: "11",
      label: "Kelas 11 (SMA/SMK)",
      order: 11,
    });

    expect(normalizeGradeKey("XII", "XII TKJ 3")).toEqual({
      key: "12",
      label: "Kelas 12 (SMA/SMK)",
      order: 12,
    });
  });

  it("handles custom or non-standard grade names gracefully", () => {
    const res = normalizeGradeKey("Olimpiade", "Klub Sains");
    expect(res.key).toBe("olimpiade");
    expect(res.label).toBe("Tingkat Olimpiade");
  });

  it("falls back to other when grade is completely missing", () => {
    const res = normalizeGradeKey(null, "Ekskul Robotik");
    expect(res.key).toBe("other");
    expect(res.label).toBe("Kelas Khusus / Non-Jenjang");
  });
});
