/**
 * Story 1 — validasi file submission (murni, tanpa DB & tanpa SDK).
 * Single source untuk aturan K1–K3 blueprint assignment-file:
 * blocklist ekstensi, 25 MB/file, maks 5 file.
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_FILES = 5;

/** K1: format yang bisa "berjalan sendiri" di komputer — program & makro. */
const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "msi",
  "bat",
  "cmd",
  "scr",
  "apk",
  "jar",
  "docm",
  "dotm",
  "xlsm",
  "hta",
]);

export function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0 || idx === name.length - 1) return "";
  return name.slice(idx + 1).toLowerCase();
}

export function isBlockedExtension(name: string): boolean {
  return BLOCKED_EXTENSIONS.has(getExtension(name));
}

/**
 * K2: boleh pratinjau inline. image/* + PDF — KECUALI SVG (skrip bisa
 * diselundupkan ke halaman bila disajikan inline). Sisanya: tombol unduh.
 */
export function isPreviewable(mimeType: string): boolean {
  const mt = (mimeType || "").toLowerCase();
  if (mt === "image/svg+xml") return false;
  return mt.startsWith("image/") || mt === "application/pdf";
}

/** Tipe yang aman dirender di tag <img> lintas browser (HEIC hanya Safari). */
export const BROWSER_RENDERABLE_IMAGES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/avif",
]);

export function isBrowserRenderableImage(mimeType: string): boolean {
  return BROWSER_RENDERABLE_IMAGES.has((mimeType || "").toLowerCase());
}

/**
 * E8: sebagian file picker mobile mengirim file.type kosong — infer dari
 * ekstensi supaya foto tidak jatuh ke octet-stream (kehilangan pratinjau).
 */
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  heic: "image/heic",
  heif: "image/heic",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  txt: "text/plain",
  csv: "text/csv",
};

export function inferMimeFromExtension(name: string): string | null {
  const ext = getExtension(name);
  return MIME_BY_EXT[ext] ?? null;
}

/**
 * K9: sanitasi nama tampilan — buang komponen path, karakter kontrol,
 * rapikan spasi, potong 200 karakter. Nama asli hanya metadata tampilan.
 */
export function sanitizeOriginalName(raw: string): string {
  // Ambil segmen terakhir dari path (unix & windows)
  const base = raw.split(/[\\/]/).pop() ?? "";
  let name = base
    // karakter kontrol
    .replace(/[\u0000-\u001f\u007f]/g, "")
    // karakter yang berbahaya di header filename
    .replace(/["\\]/g, "")
    .trim()
    // rapikan whitespace beruntun
    .replace(/\s+/g, " ");
  // buang titik/strip di ujung (Windows-era kebiasaan)
  name = name.replace(/[.\s]+$/, "");
  if (name.length > 200) {
    const ext = getExtension(name);
    if (ext && ext.length < 195) {
      const maxStem = 200 - ext.length - 1;
      name = `${name.slice(0, maxStem)}.${ext}`;
    } else {
      // Ekstensi tak wajar (super panjang) — perlakukan seluruhnya sebagai stem
      name = name.slice(0, 200);
    }
  }
  return name;
}

export interface FileMetaInput {
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export type FileMetaValidation =
  | {
      ok: true;
      name: string;
      mimeType: string;
      sizeBytes: number;
    }
  | { ok: false; error: string };

export function validateFileMeta(file: FileMetaInput): FileMetaValidation {
  const name = sanitizeOriginalName(file.name ?? "");
  const mimeType = (file.mimeType ?? "").trim().toLowerCase();
  const sizeBytes = Number(file.sizeBytes);

  if (!name || name === ".") {
    return { ok: false, error: "Nama file tidak valid." };
  }

  if (isBlockedExtension(name)) {
    return {
      ok: false,
      error: `Jenis file .${getExtension(name)} tidak diperbolehkan (program/makro).`,
    };
  }

  if (!Number.isFinite(sizeBytes) || !Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, error: `Ukuran file "${name}" tidak valid.` };
  }

  if (sizeBytes > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `File "${name}" melebihi 25 MB.`,
    };
  }

  if (!mimeType || mimeType.length > 255) {
    return { ok: false, error: `Tipe file "${name}" tidak valid.` };
  }

  return { ok: true, name, mimeType, sizeBytes };
}

export type FileListValidation =
  | { ok: true; files: Array<{ name: string; mimeType: string; sizeBytes: number }> }
  | { ok: false; error: string };

export function validateFileList(files: FileMetaInput[]): FileListValidation {
  if (!Array.isArray(files)) {
    return { ok: false, error: "Daftar file tidak valid." };
  }

  if (files.length > MAX_FILES) {
    return { ok: false, error: `Maksimal ${MAX_FILES} file per pengumpulan.` };
  }

  const validated = [];
  for (const f of files) {
    const res = validateFileMeta(f);
    if (!res.ok) return res;
    validated.push({ name: res.name, mimeType: res.mimeType, sizeBytes: res.sizeBytes });
  }

  return { ok: true, files: validated };
}
