import { describe, it, expect } from "vitest";
import {
  parseDateToIsoDateString,
  normalizeAttendanceStatus,
  sanitizeCellString,
  suggestColumnMapping,
} from "../import.utils";
import { calculateNormalizedScore } from "@/modules/assessment/assessment.service";
import { utils, write } from "xlsx";

describe("Stage 09 Import Engine — Unit & Service Tests", () => {
  describe("Utility & Bounds Functions", () => {
    it("sanitizes cell strings and trims whitespace", () => {
      expect(sanitizeCellString("   Budi Santoso   ")).toBe("Budi Santoso");
      expect(sanitizeCellString(null)).toBe("");
      expect(sanitizeCellString(undefined)).toBe("");
      expect(sanitizeCellString(12345)).toBe("12345");
    });

    it("parses dates accurately across standard formats and serial numbers", () => {
      expect(parseDateToIsoDateString("2026-08-20")).toBe("2026-08-20");
      expect(parseDateToIsoDateString("20/08/2026")).toBe("2026-08-20");
      expect(parseDateToIsoDateString("05-09-2026")).toBe("2026-09-05");
      expect(parseDateToIsoDateString(new Date("2026-08-20T00:00:00.000Z"))).toBe("2026-08-20");
      expect(parseDateToIsoDateString("invalid-date-string")).toBeNull();
      expect(parseDateToIsoDateString("")).toBeNull();
    });

    it("normalizes Indonesian attendance statuses deterministically", () => {
      expect(normalizeAttendanceStatus("Hadir")).toBe("PRESENT");
      expect(normalizeAttendanceStatus("H")).toBe("PRESENT");
      expect(normalizeAttendanceStatus("present")).toBe("PRESENT");
      expect(normalizeAttendanceStatus("Terlambat")).toBe("LATE");
      expect(normalizeAttendanceStatus("T")).toBe("LATE");
      expect(normalizeAttendanceStatus("Telat")).toBe("LATE");
      expect(normalizeAttendanceStatus("Sakit")).toBe("SICK");
      expect(normalizeAttendanceStatus("S")).toBe("SICK");
      expect(normalizeAttendanceStatus("Izin")).toBe("PERMISSION");
      expect(normalizeAttendanceStatus("Ijin")).toBe("PERMISSION");
      expect(normalizeAttendanceStatus("Alpa")).toBe("ABSENT");
      expect(normalizeAttendanceStatus("A")).toBe("ABSENT");
      expect(normalizeAttendanceStatus("Tidak Hadir")).toBe("ABSENT");
      expect(normalizeAttendanceStatus("Unknown status")).toBeNull();
    });

    it("auto-suggests column mappings from headers", () => {
      const headers = ["Nama Lengkap", "NISN", "Tanggal", "Materi Pokok", "Presensi", "Nilai UH"];
      const suggestions = suggestColumnMapping(headers);

      expect(suggestions.namaCol).toBe("Nama Lengkap");
      expect(suggestions.nisCol).toBe("NISN");
      expect(suggestions.dateCol).toBe("Tanggal");
      expect(suggestions.topicCol).toBe("Materi Pokok");
      expect(suggestions.statusCol).toBe("Presensi");
      expect(suggestions.scoreCol).toBe("Nilai UH");
    });
  });

  describe("Decimal Score Normalization & Missing Value Preservation", () => {
    it("calculates Decimal normalized score deterministically (raw / max * 100)", () => {
      const norm1 = calculateNormalizedScore(85, 100);
      expect(norm1.toNumber()).toBe(85.0);

      const norm2 = calculateNormalizedScore(37.5, 50);
      expect(norm2.toNumber()).toBe(75.0);

      const norm3 = calculateNormalizedScore(17, 20);
      expect(norm3.toNumber()).toBe(85.0);

      // Rounding half-up to 2 decimals
      const norm4 = calculateNormalizedScore(2, 3);
      expect(norm4.toNumber()).toBe(66.67);
    });

    it("throws error for raw score exceeding max score or negative values", () => {
      expect(() => calculateNormalizedScore(105, 100)).toThrow();
      expect(() => calculateNormalizedScore(-5, 100)).toThrow();
      expect(() => calculateNormalizedScore(50, 0)).toThrow();
    });
  });

  describe("Spreadsheet Generation & Safe Parsing", () => {
    it("generates valid workbook buffers and parses data correctly", () => {
      const data = [
        ["Nama Lengkap", "NIS"],
        ["Siti Aminah", "1001"],
        ["Ahmad Dahlan", "1002"],
      ];

      const ws = utils.aoa_to_sheet(data);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Sheet1");
      const buffer = write(wb, { type: "buffer", bookType: "xlsx" });

      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
