import { describe, it, expect } from "vitest";
import PizZip from "pizzip";
import { validateDocxSecurityPreflight } from "../docx-security-validator";
import { validateAndParseDocxTemplate } from "../docx-placeholder-parser";
import { MAX_TEMPLATE_FILE_BYTES } from "../template.types";

/**
 * Helper to create a valid minimal DOCX buffer in memory.
 */
function createMinimalDocx(params?: {
  documentXml?: string;
  headerXml?: string;
  footerXml?: string;
  extraFiles?: Record<string, string | Buffer>;
  contentTypesXml?: string;
}): Buffer {
  const zip = new PizZip();

  const contentTypes =
    params?.contentTypesXml ||
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`;

  const docXml =
    params?.documentXml ||
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>{{JUDUL}}</w:t></w:r></w:p>
        <w:p><w:r><w:t>{{ISI_KONTEN}}</w:t></w:r></w:p>
      </w:body>
    </w:document>`;

  zip.file("[Content_Types].xml", contentTypes);
  zip.file("word/document.xml", docXml);

  if (params?.headerXml) {
    zip.file("word/header1.xml", params.headerXml);
  }
  if (params?.footerXml) {
    zip.file("word/footer1.xml", params.footerXml);
  }

  if (params?.extraFiles) {
    for (const [name, content] of Object.entries(params.extraFiles)) {
      zip.file(name, content);
    }
  }

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

describe("PHASE B: DOCX Security & Hostile Input Validator", () => {
  it("passes a valid normal DOCX file with recognized placeholders", async () => {
    const docx = createMinimalDocx();
    const result = await validateAndParseDocxTemplate(docx, "LESSON_PLAN");

    expect(result.valid).toBe(true);
    expect(result.manifest?.recognized).toEqual(["ISI_KONTEN", "JUDUL"]);
    expect(result.manifest?.unsupported).toEqual([]);
    expect(result.checksumSha256).toBeDefined();
  });

  it("rejects non-DOCX arbitrary buffer lacking PK zip magic bytes", async () => {
    const fakeBuffer = Buffer.from("NOT_A_ZIP_FILE_AT_ALL".repeat(10));
    const result = await validateDocxSecurityPreflight(fakeBuffer);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Format file tidak valid/);
  });

  it("rejects files exceeding MAX_TEMPLATE_FILE_BYTES (2 MB)", async () => {
    const hugeBuffer = Buffer.alloc(MAX_TEMPLATE_FILE_BYTES + 1);
    hugeBuffer[0] = 0x50;
    hugeBuffer[1] = 0x4b;
    hugeBuffer[2] = 0x03;
    hugeBuffer[3] = 0x04;

    const result = await validateDocxSecurityPreflight(hugeBuffer);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/melebihi batas maksimum/);
  });

  it("rejects corrupted ZIP archives", async () => {
    const corruptBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x99, 0x88, 0x77, 0x66, 0x55, 0x44]);
    const result = await validateDocxSecurityPreflight(corruptBuffer);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects DOCX packages containing vbaProject.bin (Macros)", async () => {
    const macroDocx = createMinimalDocx({
      extraFiles: {
        "word/vbaProject.bin": Buffer.from("MALICIOUS_VBA_PAYLOAD"),
      },
    });

    const result = await validateDocxSecurityPreflight(macroDocx);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/mengandung makro/);
  });

  it("rejects DOCX packages containing activeX or embeddings", async () => {
    const activeXDocx = createMinimalDocx({
      extraFiles: {
        "word/activeX/activeX1.xml": "<activeX/>",
      },
    });

    const result = await validateDocxSecurityPreflight(activeXDocx);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/objek aktif/);

    const embeddingDocx = createMinimalDocx({
      extraFiles: {
        "word/embeddings/oleObject1.bin": Buffer.from("OLE_DATA"),
      },
    });

    const embResult = await validateDocxSecurityPreflight(embeddingDocx);
    expect(embResult.valid).toBe(false);
    expect(embResult.error).toMatch(/objek aktif/);
  });

  it("rejects Macro-Enabled content types declared in [Content_Types].xml", async () => {
    const docmTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/>
    </Types>`;

    const docmDocx = createMinimalDocx({ contentTypesXml: docmTypes });
    const result = await validateDocxSecurityPreflight(docmDocx);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Macro-Enabled/);
  });

  it("rejects archives with path traversal entries (.. or /)", async () => {
    const traversalDocx = createMinimalDocx({
      extraFiles: {
        "../evil.txt": "evil",
      },
    });

    const result = await validateDocxSecurityPreflight(traversalDocx);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/path/i);
  });

  it("rejects archives with excessive entry count (101 entries vs MAX_ZIP_ENTRIES=100)", async () => {
    const extra: Record<string, string> = {};
    // Exactly 101 total entries (including [Content_Types].xml and word/document.xml)
    for (let i = 0; i < 99; i++) {
      extra[`word/dummy${i}.xml`] = `<dummy>${i}</dummy>`;
    }

    const bloatedDocx = createMinimalDocx({ extraFiles: extra });
    const result = await validateDocxSecurityPreflight(bloatedDocx);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Jumlah entri dalam arsip.*melebihi batas sistem \(100\)/);
  });

  it("rejects a single entry exceeding MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES (5 MB)", async () => {
    const largeXml = "<tag>" + "B".repeat(5_242_880 + 100) + "</tag>";
    const largeEntryDocx = createMinimalDocx({
      extraFiles: {
        "word/large_entry.xml": largeXml,
      },
    });

    const result = await validateDocxSecurityPreflight(largeEntryDocx);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/melebihi batas per-entri \(5 MB\)/);
  });

  it("rejects ZIP bomb entries exceeding total uncompressed byte limits (> 10 MB total)", async () => {
    // 3 entries each ~4 MB totaling > 12 MB (exceeding 10 MB total limit)
    const part1 = "<p>" + "C".repeat(4_000_000) + "</p>";
    const part2 = "<p>" + "D".repeat(4_000_000) + "</p>";
    const part3 = "<p>" + "E".repeat(4_000_000) + "</p>";

    const zipBomb = createMinimalDocx({
      extraFiles: {
        "word/part1.xml": part1,
        "word/part2.xml": part2,
        "word/part3.xml": part3,
      },
    });

    const result = await validateDocxSecurityPreflight(zipBomb);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Total ukuran dekompresi.*melebihi batas maksimum \(10 MB\)/);
  });

  it("rejects archives with control-character filenames or absolute slash paths", async () => {
    const ctrlCharDocx = createMinimalDocx({
      extraFiles: {
        "word/\x00evil.xml": "<evil/>",
      },
    });
    const ctrlResult = await validateDocxSecurityPreflight(ctrlCharDocx);
    expect(ctrlResult.valid).toBe(false);
    expect(ctrlResult.error).toMatch(/path yang tidak aman/);

    const absPathDocx = createMinimalDocx({
      extraFiles: {
        "/absolute/word/evil.xml": "<evil/>",
      },
    });
    const absResult = await validateDocxSecurityPreflight(absPathDocx);
    expect(absResult.valid).toBe(false);
    expect(absResult.error).toMatch(/path/i);
  });

  describe("Content-Bearing Tag Acceptance per ContentType", () => {
    it("LESSON_PLAN: accepts a single valid content-bearing tag (TUJUAN_PEMBELAJARAN alone)", async () => {
      const docx = createMinimalDocx({
        documentXml: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{TUJUAN_PEMBELAJARAN}}</w:t></w:r></w:p></w:body></w:document>`,
      });
      const res = await validateAndParseDocxTemplate(docx, "LESSON_PLAN");
      expect(res.valid).toBe(true);
      expect(res.manifest?.contentBearing).toEqual(["TUJUAN_PEMBELAJARAN"]);
    });

    it("LESSON_PLAN: accepts a single valid content-bearing tag (LANGKAH_PEMBELAJARAN alone)", async () => {
      const docx = createMinimalDocx({
        documentXml: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{LANGKAH_PEMBELAJARAN}}</w:t></w:r></w:p></w:body></w:document>`,
      });
      const res = await validateAndParseDocxTemplate(docx, "LESSON_PLAN");
      expect(res.valid).toBe(true);
      expect(res.manifest?.contentBearing).toEqual(["LANGKAH_PEMBELAJARAN"]);
    });

    it("LEARNING_MATERIAL: accepts a single valid content-bearing tag (RINGKASAN alone)", async () => {
      const docx = createMinimalDocx({
        documentXml: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{RINGKASAN}}</w:t></w:r></w:p></w:body></w:document>`,
      });
      const res = await validateAndParseDocxTemplate(docx, "LEARNING_MATERIAL");
      expect(res.valid).toBe(true);
      expect(res.manifest?.contentBearing).toEqual(["RINGKASAN"]);
    });

    it("TASK_INSTRUCTION: accepts a single valid content-bearing tag (SOAL_PILIHAN_GANDA alone)", async () => {
      const docx = createMinimalDocx({
        documentXml: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{SOAL_PILIHAN_GANDA}}</w:t></w:r></w:p></w:body></w:document>`,
      });
      const res = await validateAndParseDocxTemplate(docx, "TASK_INSTRUCTION");
      expect(res.valid).toBe(true);
      expect(res.manifest?.contentBearing).toEqual(["SOAL_PILIHAN_GANDA"]);
    });

    it("TASK_INSTRUCTION: accepts a single valid content-bearing tag (SOAL_ESSAY alone)", async () => {
      const docx = createMinimalDocx({
        documentXml: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{SOAL_ESSAY}}</w:t></w:r></w:p></w:body></w:document>`,
      });
      const res = await validateAndParseDocxTemplate(docx, "TASK_INSTRUCTION");
      expect(res.valid).toBe(true);
      expect(res.manifest?.contentBearing).toEqual(["SOAL_ESSAY"]);
    });

    it("TASK_INSTRUCTION: accepts a single valid content-bearing tag (KUNCI_JAWABAN alone)", async () => {
      const docx = createMinimalDocx({
        documentXml: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{KUNCI_JAWABAN}}</w:t></w:r></w:p></w:body></w:document>`,
      });
      const res = await validateAndParseDocxTemplate(docx, "TASK_INSTRUCTION");
      expect(res.valid).toBe(true);
      expect(res.manifest?.contentBearing).toEqual(["KUNCI_JAWABAN"]);
    });

    it("RUBRIC: accepts a single valid content-bearing tag (RUBRIK_PENILAIAN alone)", async () => {
      const docx = createMinimalDocx({
        documentXml: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{RUBRIK_PENILAIAN}}</w:t></w:r></w:p></w:body></w:document>`,
      });
      const res = await validateAndParseDocxTemplate(docx, "RUBRIC");
      expect(res.valid).toBe(true);
      expect(res.manifest?.contentBearing).toEqual(["RUBRIK_PENILAIAN"]);
    });

    it("REJECTS templates containing only metadata placeholders without any content-bearing tag", async () => {
      const docx = createMinimalDocx({
        documentXml: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{JUDUL}} - {{NAMA_SEKOLAH}} - {{GURU}} - {{KELAS}} - {{TANGGAL}}</w:t></w:r></w:p></w:body></w:document>`,
      });
      const res = await validateAndParseDocxTemplate(docx, "LESSON_PLAN");
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/harus memuat setidaknya satu tag konten/);
    });
  });
});
