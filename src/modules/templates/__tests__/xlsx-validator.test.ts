import { describe, it, expect } from "vitest";
import PizZip from "pizzip";
import { AiContentType } from "@prisma/client";
import { validateXlsxSecurityPreflight } from "../xlsx-security-validator";
import { validateXlsxPlaceholders } from "../xlsx-placeholder-parser";
import { MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES } from "../template.types";

function createValidXlsxZip(options?: {
  sharedStrings?: string[];
  inlineStrings?: Record<string, string>; // cellRef -> text
  sheetName?: string;
  sheetVisibility?: "hidden" | "veryHidden" | "visible";
  extraFiles?: Record<string, string | Buffer>;
}): Buffer {
  const zip = new PizZip();

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const sheetName = options?.sheetName || "Sheet1";
  const stateAttr =
    options?.sheetVisibility === "hidden"
      ? ' state="hidden"'
      : options?.sheetVisibility === "veryHidden"
      ? ' state="veryHidden"'
      : "";

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${sheetName}" sheetId="1"${stateAttr} r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const sstStrings = options?.sharedStrings || ["{{JUDUL}}", "{{ISI_KONTEN}}"];
  const sstItemsXml = sstStrings
    .map((s) => `<si><t>${s}</t></si>`)
    .join("");

  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sstStrings.length}" uniqueCount="${sstStrings.length}">
  ${sstItemsXml}
</sst>`;

  let sheetCellsXml = "";
  if (options?.inlineStrings) {
    for (const [cellRef, val] of Object.entries(options.inlineStrings)) {
      sheetCellsXml += `<c r="${cellRef}" t="inlineStr"><is><t>${val}</t></is></c>`;
    }
  } else {
    // Reference shared strings in sheet cells: A1 -> sst[0], A2 -> sst[1]
    sstStrings.forEach((_, idx) => {
      const row = idx + 1;
      sheetCellsXml += `<c r="A${row}" t="s"><v>${idx}</v></c>`;
    });
  }

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      ${sheetCellsXml}
    </row>
  </sheetData>
</worksheet>`;

  zip.file("[Content_Types].xml", contentTypesXml);
  zip.file("_rels/.rels", rootRelsXml);
  zip.file("xl/workbook.xml", workbookXml);
  zip.file("xl/_rels/workbook.xml.rels", workbookRelsXml);
  zip.file("xl/sharedStrings.xml", sharedStringsXml);
  zip.file("xl/worksheets/sheet1.xml", sheet1Xml);

  if (options?.extraFiles) {
    for (const [k, v] of Object.entries(options.extraFiles)) {
      zip.file(k, v);
    }
  }

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

describe("XLSX Security & Hostile Package Validator", () => {
  it("accepts a valid benign XLSX workbook package", async () => {
    const buf = createValidXlsxZip();
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(true);

    const validation = validateXlsxPlaceholders(preflight, AiContentType.LESSON_PLAN);
    expect(validation.valid).toBe(true);
    expect(validation.manifest?.recognized).toContain("JUDUL");
    expect(validation.manifest?.recognized).toContain("ISI_KONTEN");
    expect(validation.manifest?.locations?.length).toBeGreaterThan(0);
  });

  it("rejects corrupt non-ZIP or arbitrary binary files", async () => {
    const corruptBuffer = Buffer.from("NOT_A_ZIP_FILE_AT_ALL_JUST_RANDOM_GARBAGE");
    const preflight = await validateXlsxSecurityPreflight(corruptBuffer);
    expect(preflight.valid).toBe(false);
    expect(preflight.error).toContain("Format file tidak valid atau arsip Excel rusak");
  });

  it("rejects packages containing VBA macros (xl/vbaProject.bin)", async () => {
    const buf = createValidXlsxZip({
      extraFiles: { "xl/vbaProject.bin": Buffer.from("EVIL_MACRO_PAYLOAD") },
    });
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(false);
    expect(preflight.error).toContain("elemen yang dilarang (Macro/VBA/ActiveX/External Links)");
  });

  it("rejects packages containing ActiveX or OLE embeddings", async () => {
    const buf = createValidXlsxZip({
      extraFiles: { "xl/activeX/activeX1.xml": "<xml>activex</xml>" },
    });
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(false);
    expect(preflight.error).toContain("elemen yang dilarang");
  });

  it("rejects packages containing external links (xl/externalLinks/*)", async () => {
    const buf = createValidXlsxZip({
      extraFiles: { "xl/externalLinks/externalLink1.xml": "<xml>external</xml>" },
    });
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(false);
    expect(preflight.error).toContain("elemen yang dilarang (Macro/VBA/ActiveX/External Links)");
  });

  it("rejects packages containing external connections (xl/connections.xml)", async () => {
    const buf = createValidXlsxZip({
      extraFiles: { "xl/connections.xml": "<connections/>" },
    });
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(false);
    expect(preflight.error).toContain("elemen yang dilarang");
  });

  it("rejects packages containing external queryTables (xl/queryTables/*)", async () => {
    const buf = createValidXlsxZip({
      extraFiles: { "xl/queryTables/queryTable1.xml": "<queryTable/>" },
    });
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(false);
    expect(preflight.error).toContain("elemen yang dilarang");
  });

  it("rejects packages with path traversal entries (.. or /)", async () => {
    const buf = createValidXlsxZip({
      extraFiles: { "../evil.txt": "path traversal" },
    });
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(false);
    expect(preflight.error).toMatch(/path traversal|invalid relative path/i);
  });

  it("rejects archives with excessive entry count (> MAX_ZIP_ENTRIES=100)", async () => {
    const extraFiles: Record<string, string> = {};
    for (let i = 0; i < 101; i++) {
      extraFiles[`xl/extra_${i}.xml`] = `<data>${i}</data>`;
    }
    const buf = createValidXlsxZip({ extraFiles });
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(false);
    expect(preflight.error).toContain("melebihi batas sistem (100)");
  });

  it("rejects a single entry exceeding MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES (5 MB)", async () => {
    const hugeXml = "<root>" + "X".repeat(MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES + 100) + "</root>";
    const buf = createValidXlsxZip({
      extraFiles: { "xl/customXml/huge.xml": hugeXml },
    });
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(false);
    expect(preflight.error).toContain("melebihi batas dekompresi");
  });

  it("rejects total uncompressed entries exceeding MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES (10 MB)", async () => {
    const chunkSize = 2_000_000;
    const chunkXml = "<root>" + "A".repeat(chunkSize) + "</root>";
    const extraFiles: Record<string, string> = {};
    for (let i = 0; i < 6; i++) {
      extraFiles[`xl/custom_${i}.xml`] = chunkXml;
    }
    const buf = createValidXlsxZip({ extraFiles });
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(false);
    expect(preflight.error).toContain("melebihi batas sistem (10485760 bytes)");
  });
});

describe("XLSX Placeholder Contract & Location Parser", () => {
  it("rejects mixed text inside single cell (e.g. 'Judul: {{JUDUL}}')", async () => {
    const buf = createValidXlsxZip({
      sharedStrings: ["Judul: {{JUDUL}}", "{{ISI_KONTEN}}"],
    });
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(true);

    const validation = validateXlsxPlaceholders(preflight, AiContentType.LESSON_PLAN);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("Placeholder harus menempati seluruh isi sel");
  });

  it("rejects multiple placeholders inside a single cell", async () => {
    const buf = createValidXlsxZip({
      sharedStrings: ["{{JUDUL}} - {{KELAS}}", "{{ISI_KONTEN}}"],
    });
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(true);

    const validation = validateXlsxPlaceholders(preflight, AiContentType.LESSON_PLAN);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("Placeholder harus menempati seluruh isi sel");
  });

  it("rejects placeholders referenced in veryHidden worksheets", async () => {
    const buf = createValidXlsxZip({
      sheetVisibility: "veryHidden",
      sharedStrings: ["{{JUDUL}}", "{{ISI_KONTEN}}"],
    });
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(true);

    const validation = validateXlsxPlaceholders(preflight, AiContentType.LESSON_PLAN);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("veryHidden");
  });

  it("accepts placeholders in hidden worksheets and preserves sheetVisibility", async () => {
    const buf = createValidXlsxZip({
      sheetVisibility: "hidden",
      sharedStrings: ["{{JUDUL}}", "{{ISI_KONTEN}}"],
    });
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(true);

    const validation = validateXlsxPlaceholders(preflight, AiContentType.LESSON_PLAN);
    expect(validation.valid).toBe(true);
    expect(validation.manifest?.locations?.[0].sheetVisibility).toBe("HIDDEN");
  });

  it("rejects template with unknown/unsupported placeholders", async () => {
    const buf = createValidXlsxZip({
      sharedStrings: ["{{JUDUL}}", "{{UNKNOWN_TAG}}", "{{ISI_KONTEN}}"],
    });
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(true);

    const validation = validateXlsxPlaceholders(preflight, AiContentType.LESSON_PLAN);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("tidak dikenal");
    expect(validation.unsupportedTags).toContain("UNKNOWN_TAG");
  });

  it("rejects template containing only metadata placeholders without any content-bearing tag", async () => {
    const buf = createValidXlsxZip({
      sharedStrings: ["{{JUDUL}}", "{{NAMA_SEKOLAH}}", "{{GURU}}", "{{KELAS}}", "{{TANGGAL}}"],
    });
    const preflight = await validateXlsxSecurityPreflight(buf);
    expect(preflight.valid).toBe(true);

    const validation = validateXlsxPlaceholders(preflight, AiContentType.LESSON_PLAN);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("harus memiliki setidaknya satu placeholder konten");
  });

  it("accepts single content-bearing tag per contentType", async () => {
    // 1. LESSON_PLAN with TUJUAN_PEMBELAJARAN alone
    const buf1 = createValidXlsxZip({ sharedStrings: ["{{TUJUAN_PEMBELAJARAN}}"] });
    const p1 = await validateXlsxSecurityPreflight(buf1);
    expect(validateXlsxPlaceholders(p1, AiContentType.LESSON_PLAN).valid).toBe(true);

    // 2. LEARNING_MATERIAL with RINGKASAN alone
    const buf2 = createValidXlsxZip({ sharedStrings: ["{{RINGKASAN}}"] });
    const p2 = await validateXlsxSecurityPreflight(buf2);
    expect(validateXlsxPlaceholders(p2, AiContentType.LEARNING_MATERIAL).valid).toBe(true);

    // 3. TASK_INSTRUCTION with SOAL_PILIHAN_GANDA alone
    const buf3 = createValidXlsxZip({ sharedStrings: ["{{SOAL_PILIHAN_GANDA}}"] });
    const p3 = await validateXlsxSecurityPreflight(buf3);
    expect(validateXlsxPlaceholders(p3, AiContentType.TASK_INSTRUCTION).valid).toBe(true);

    // 4. RUBRIC with RUBRIK_PENILAIAN alone
    const buf4 = createValidXlsxZip({ sharedStrings: ["{{RUBRIK_PENILAIAN}}"] });
    const p4 = await validateXlsxSecurityPreflight(buf4);
    expect(validateXlsxPlaceholders(p4, AiContentType.RUBRIC).valid).toBe(true);
  });
});
