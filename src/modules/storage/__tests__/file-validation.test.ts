import { describe, it, expect } from "vitest";
import {
  MAX_FILE_BYTES,
  MAX_FILES,
  getExtension,
  isBlockedExtension,
  isPreviewable,
  sanitizeOriginalName,
  validateFileList,
  inferMimeFromExtension,
  isBrowserRenderableImage,
  validateFileMeta,
} from "../file-validation";

describe("Story 1 — getExtension & isBlockedExtension (K1)", () => {
  it("ekstensi dinormalkan lowercase", () => {
    expect(getExtension("Foto.JPG")).toBe("jpg");
    expect(getExtension("arsip.tar.gz")).toBe("gz");
    expect(getExtension("tanpaext")).toBe("");
    expect(getExtension(".gitignore")).toBe("");
  });

  it("blocklist: program & makro ditolak (case-insensitive)", () => {
    for (const name of ["virus.exe", "Setup.MSI", "run.bat", "skrip.cmd", "x.scr", "app.apk", "lib.jar", "makro.docm", "tpl.dotm", "finansial.xlsm", "popup.hta"]) {
      expect(isBlockedExtension(name)).toBe(true);
    }
  });

  it("file normal lolos", () => {
    for (const name of ["jawaban.jpg", "tugas.pdf", "laporan.docx", "video.mp4", "citra.heic"]) {
      expect(isBlockedExtension(name)).toBe(false);
    }
  });
});

describe("Story 1 — isPreviewable (K2)", () => {
  it("foto & PDF inline; svg DITOLAK (XSS)", () => {
    expect(isPreviewable("image/jpeg")).toBe(true);
    expect(isPreviewable("image/png")).toBe(true);
    expect(isPreviewable("image/heic")).toBe(true);
    expect(isPreviewable("application/pdf")).toBe(true);
    expect(isPreviewable("image/svg+xml")).toBe(false);
  });

  it("dokumen & lainnya = tombol unduh", () => {
    expect(isPreviewable("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(false);
    expect(isPreviewable("application/zip")).toBe(false);
    expect(isPreviewable("video/mp4")).toBe(false);
    expect(isPreviewable("")).toBe(false);
  });
});

describe("Story 1 — sanitizeOriginalName (K9)", () => {
  it("path traversal dipangkas ke segmen terakhir", () => {
    expect(sanitizeOriginalName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeOriginalName("C:\\Users\\Budi\\..\\tugas.docx")).toBe("tugas.docx");
  });

  it("karakter kontrol & kutip dibuang, spasi dirapikan", () => {
    expect(sanitizeOriginalName("ja\x00wa\x1fban  final.pdf")).toBe("jawaban final.pdf");
    expect(sanitizeOriginalName('we"ird\\name.pdf')).toBe("name.pdf"); // backslash = path separator
    expect(sanitizeOriginalName('we"irdname.pdf')).toBe("weirdname.pdf");
    expect(sanitizeOriginalName("  spasi   ganda  .docx ")).toBe("spasi ganda .docx");
  });

  it("nama super panjang dipotong maks 200 karakter (ekstensi dipertahankan)", () => {
    const long = "a".repeat(300) + ".pdf";
    const out = sanitizeOriginalName(long);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith(".pdf")).toBe(true);
  });

  it("nama murni path kosong → string kosong", () => {
    expect(sanitizeOriginalName("../../")).toBe("");
    expect(sanitizeOriginalName("   ")).toBe("");
  });
});

describe("Story 1 — validateFileMeta (K1–K3)", () => {
  const base = { name: "jawaban.jpg", mimeType: "image/jpeg", sizeBytes: 1024 };

  it("HAPPY: metadata valid", () => {
    expect(validateFileMeta(base)).toEqual({ ok: true, ...base });
  });

  it("nama path-traversal disanitasi tapi tetap valid", () => {
    const res = validateFileMeta({ ...base, name: "../x/jawaban.jpg" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.name).toBe("jawaban.jpg");
  });

  it("ekstensi terblokir → error menyebut ekstensi", () => {
    const res = validateFileMeta({ ...base, name: "makro.docm", mimeType: "application/msword" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("docm");
  });

  it("ukuran 0 / negatif / non-integer / >25MB → error", () => {
    expect(validateFileMeta({ ...base, sizeBytes: 0 }).ok).toBe(false);
    expect(validateFileMeta({ ...base, sizeBytes: -5 }).ok).toBe(false);
    expect(validateFileMeta({ ...base, sizeBytes: 1.5 }).ok).toBe(false);
    const over = validateFileMeta({ ...base, sizeBytes: MAX_FILE_BYTES + 1 });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toContain("25 MB");
  });

  it("mime kosong / kepanjangan → error", () => {
    expect(validateFileMeta({ ...base, mimeType: "" }).ok).toBe(false);
    expect(validateFileMeta({ ...base, mimeType: "a".repeat(256) }).ok).toBe(false);
  });
});

describe("Story 1 — validateFileList (K3 jumlah)", () => {
  const mk = (i: number) => ({ name: `f${i}.jpg`, mimeType: "image/jpeg", sizeBytes: 1000 });

  it("tepat MAX_FILES lolos, satu lebih → error", () => {
    expect(validateFileList(Array.from({ length: MAX_FILES }, (_, i) => mk(i))).ok).toBe(true);
    const over = validateFileList(Array.from({ length: MAX_FILES + 1 }, (_, i) => mk(i)));
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toContain("5 file");
  });

  it("satu file bermasalah menolak seluruh daftar", () => {
    const res = validateFileList([mk(1), { name: "boom.exe", mimeType: "application/x-msdownload", sizeBytes: 10 }]);
    expect(res.ok).toBe(false);
  });
});

describe("Story 1 patch — inferMimeFromExtension (E8)", () => {
  it("ekstensi umum terpetakan, tak dikenal → null", () => {
    expect(inferMimeFromExtension("foto.JPG")).toBe("image/jpeg");
    expect(inferMimeFromExtension("heic.heic")).toBe("image/heic");
    expect(inferMimeFromExtension("dok.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(inferMimeFromExtension("aneh.xyzabc")).toBeNull();
    expect(inferMimeFromExtension("tanpaext")).toBeNull();
  });
});

describe("Story 1 patch — isBrowserRenderableImage (BH5/E9)", () => {
  it("jpeg/png/gif/webp/bmp/avif renderable; HEIC & svg tidak", () => {
    for (const mt of ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/avif"]) {
      expect(isBrowserRenderableImage(mt)).toBe(true);
    }
    expect(isBrowserRenderableImage("image/heic")).toBe(false);
    expect(isBrowserRenderableImage("image/svg+xml")).toBe(false);
    expect(isBrowserRenderableImage("")).toBe(false);
  });
});

describe("Story 1 patch — sanitize ekstensi tak wajar (C3)", () => {
  it("ekstensi super panjang → seluruh nama dipotong 200 tanpa ekstensi", () => {
    const longExt = "a".repeat(300) + "." + "b".repeat(220);
    const out = sanitizeOriginalName(longExt);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith(".bbbb")).toBe(false);
  });
});
