import { z } from "zod";

export const reportQueryFilterSchema = z.object({
  teachingContextId: z.string().min(1, "Teaching Context ID is required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  studentSearch: z.string().optional(),
  includeHistoricalRoster: z.boolean().optional().default(true),
});

/**
 * Sanitizes any cell value against CSV / Spreadsheet Formula Injection (CWE-1236).
 * Prepends a single quote (') if the string begins with =, +, -, @, tab, or carriage return.
 */
export function sanitizeSpreadsheetCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  const str = String(value);

  // Check if string starts with formula triggering character
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }

  return str;
}

/**
 * Validates and normalizes date range filter parameters.
 */
export function parseDateRangeFilter(startDateStr?: string, endDateStr?: string): {
  startDate: Date | undefined;
  endDate: Date | undefined;
} {
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (startDateStr) {
    const d = new Date(startDateStr);
    if (!isNaN(d.getTime())) {
      startDate = d;
    }
  }

  if (endDateStr) {
    const d = new Date(endDateStr);
    if (!isNaN(d.getTime())) {
      // Set to end of day
      d.setHours(23, 59, 59, 999);
      endDate = d;
    }
  }

  return { startDate, endDate };
}

/**
 * Generates clean, safe filename for exports.
 */
export function generateSafeExportFilename(prefix: string, contextLabel: string, ext = "xlsx"): string {
  const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const cleanContext = contextLabel.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${cleanPrefix}_${cleanContext}_${timestamp}.${ext}`;
}
