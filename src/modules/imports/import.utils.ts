import crypto from "crypto";

export const SESSION_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ROW_COUNT = 500;
export const MAX_COLUMN_COUNT = 50;
export const MAX_CELL_STRING_LENGTH = 1000;

/**
 * Computes deterministic SHA-256 hash of normalized preview/confirmation rows.
 */
export function computePayloadHash(rows: unknown[]): string {
  const jsonStr = JSON.stringify(rows);
  return crypto.createHash("sha256").update(jsonStr).digest("hex");
}

export function computeRowsHash(rows: unknown[]): string {
  return computePayloadHash(rows);
}

/**
 * Generates a cryptographically strong random token (32 bytes hex) and its SHA-256 hash.
 * The raw token is returned to the client only; the tokenHash is persisted in the database.
 */
export function generateImportSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Computes SHA-256 hash of a string or raw token.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Sanitizes cell input to enforce string limits and prevent malicious payload attacks.
 */
export function sanitizeCellString(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  if (str.length > MAX_CELL_STRING_LENGTH) {
    return str.slice(0, MAX_CELL_STRING_LENGTH);
  }
  return str;
}

/**
 * Normalizes Excel dates / string dates into standard YYYY-MM-DD format.
 */
export function parseDateToIsoDateString(val: unknown): string | null {
  if (!val) return null;

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }

  // Check if it's an Excel date serial number (e.g. 45123)
  if (typeof val === "number" && val > 20000 && val < 60000) {
    // Excel epoch starts Dec 30, 1899
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const jsDate = new Date(excelEpoch.getTime() + val * 86400 * 1000);
    if (!isNaN(jsDate.getTime())) {
      return jsDate.toISOString().slice(0, 10);
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return str;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    const isoStr = `${year}-${month}-${day}`;
    const d = new Date(isoStr);
    if (!isNaN(d.getTime())) return isoStr;
  }

  // Generic Date parsing fallback
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Normalizes attendance status values deterministically.
 */
export function normalizeAttendanceStatus(
  rawStatus: unknown
): "PRESENT" | "SICK" | "PERMISSION" | "ABSENT" | "LATE" | null {
  if (!rawStatus) return null;
  const s = String(rawStatus).trim().toLowerCase();

  if (["hadir", "h", "present", "masuk", "v", "1"].includes(s)) {
    return "PRESENT";
  }
  if (["terlambat", "t", "late", "telat"].includes(s)) {
    return "LATE";
  }
  if (["sakit", "s", "sick"].includes(s)) {
    return "SICK";
  }
  if (["izin", "i", "ijin", "permission", "dispensasi"].includes(s)) {
    return "PERMISSION";
  }
  if (["alpa", "a", "tidak hadir", "absent", "alpha", "tanpa keterangan", "tk", "0"].includes(s)) {
    return "ABSENT";
  }

  return null;
}

/**
 * Suggests column mappings based on common Indonesian and English header terms.
 */
export function suggestColumnMapping(headers: string[]) {
  const cleanHeaders = headers.map((h) => ({
    original: h,
    clean: h.toLowerCase().replace(/[^a-z0-9]/g, ""),
  }));

  const findHeader = (candidates: string[]): string => {
    for (const cand of candidates) {
      const match = cleanHeaders.find((h) => h.clean.includes(cand));
      if (match) return match.original;
    }
    return "";
  };

  return {
    namaCol: findHeader(["namasiswa", "namalengkap", "studentname", "nama", "name"]),
    nisCol: findHeader(["nisn", "nis", "nomorinduk", "id"]),
    dateCol: findHeader(["tanggal", "tgl", "date", "waktu"]),
    topicCol: findHeader(["materi", "topik", "pokokbahasan", "topic", "actualtopic", "kegiatan"]),
    summaryCol: findHeader(["ringkasan", "kegiatan", "summary", "aktivitas", "catatan"]),
    statusCol: findHeader(["status", "kehadiran", "presensi", "absensi", "absent"]),
    titleCol: findHeader(["judul", "namapenilaian", "assessment", "title", "ulangan", "tugas"]),
    typeCol: findHeader(["jenis", "tipe", "kategori", "category", "type"]),
    maxScoreCol: findHeader(["skormaksimum", "skormaks", "maxscore", "maksimal", "max"]),
    scoreCol: findHeader(["nilai", "skor", "score", "rawscore", "hasil"]),
  };
}
