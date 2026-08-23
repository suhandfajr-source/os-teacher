import { describe, it, expect } from "vitest";
import {
  sanitizeSpreadsheetCell,
  parseDateRangeFilter,
  generateSafeExportFilename,
} from "../reporting.service";

describe("Stage 07 Reporting Service Unit Tests", () => {
  describe("sanitizeSpreadsheetCell (Formula Injection Protection CWE-1236)", () => {
    it("neutralizes formula prefix '=' by prepending single quote", () => {
      const input = "=SUM(A1:A10)";
      expect(sanitizeSpreadsheetCell(input)).toBe("'=SUM(A1:A10)");
    });

    it("neutralizes formula prefix '+' by prepending single quote", () => {
      const input = "+cmd|' /C calc'!A0";
      expect(sanitizeSpreadsheetCell(input)).toBe("'+cmd|' /C calc'!A0");
    });

    it("neutralizes formula prefix '-' by prepending single quote", () => {
      const input = "-5+2";
      expect(sanitizeSpreadsheetCell(input)).toBe("'-5+2");
    });

    it("neutralizes formula prefix '@' by prepending single quote", () => {
      const input = "@SUM(1+1)";
      expect(sanitizeSpreadsheetCell(input)).toBe("'@SUM(1+1)");
    });

    it("neutralizes tab and carriage return prefixes", () => {
      expect(sanitizeSpreadsheetCell("\t=cmd")).toBe("'\t=cmd");
      expect(sanitizeSpreadsheetCell("\r=cmd")).toBe("'\r=cmd");
    });

    it("leaves regular benign text untouched", () => {
      expect(sanitizeSpreadsheetCell("Ahmad Subarjo")).toBe("Ahmad Subarjo");
      expect(sanitizeSpreadsheetCell("TP 1.1 Menjelaskan Eksponen")).toBe("TP 1.1 Menjelaskan Eksponen");
      expect(sanitizeSpreadsheetCell("Hadir")).toBe("Hadir");
    });

    it("leaves pure numeric and boolean values untouched", () => {
      expect(sanitizeSpreadsheetCell(85.5)).toBe(85.5);
      expect(sanitizeSpreadsheetCell(100)).toBe(100);
      expect(sanitizeSpreadsheetCell(0)).toBe(0);
      expect(sanitizeSpreadsheetCell(true)).toBe(true);
      expect(sanitizeSpreadsheetCell(false)).toBe(false);
    });

    it("handles null and undefined safely", () => {
      expect(sanitizeSpreadsheetCell(null)).toBe(null);
      expect(sanitizeSpreadsheetCell(undefined)).toBe(null);
    });
  });

  describe("parseDateRangeFilter", () => {
    it("parses valid date strings and sets end of day for endDate", () => {
      const { startDate, endDate } = parseDateRangeFilter("2026-08-01", "2026-08-31");
      expect(startDate).toBeInstanceOf(Date);
      expect(endDate).toBeInstanceOf(Date);
      expect(startDate?.toISOString().startsWith("2026-08-01")).toBe(true);
      expect(endDate?.getHours()).toBe(23);
      expect(endDate?.getMinutes()).toBe(59);
      expect(endDate?.getSeconds()).toBe(59);
    });

    it("returns undefined for invalid or missing date strings", () => {
      const { startDate, endDate } = parseDateRangeFilter("invalid-date", undefined);
      expect(startDate).toBeUndefined();
      expect(endDate).toBeUndefined();
    });
  });

  describe("generateSafeExportFilename", () => {
    it("generates a safe sanitized filename with date timestamp", () => {
      const filename = generateSafeExportFilename("Rekap Presensi", "10-IPA-1 / Fisika");
      expect(filename).toMatch(/^rekap_presensi_10-ipa-1___fisika_\d{4}-\d{2}-\d{2}\.xlsx$/);
    });
  });
});
