import { describe, it, expect } from "vitest";
import PizZip from "pizzip";
import { AiContentType } from "@prisma/client";
import {
  renderXlsxTemplate,
  buildXlsxSubstitutionMap,
} from "../xlsx-template-renderer";

function createTemplateXlsxBuffer(options?: {
  sharedStrings?: string[];
  inlineStrings?: Record<string, string>;
  extraSheets?: Array<{ name: string; cellsXml: string; state?: string }>;
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

  let sheetsXml = '<sheet name="Sheet1" sheetId="1" r:id="rId1"/>';
  let sheetRelsXml = '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>';

  if (options?.extraSheets) {
    options.extraSheets.forEach((s, idx) => {
      const sheetId = idx + 2;
      const rId = `rId${sheetId}`;
      const stateAttr = s.state ? ` state="${s.state}"` : "";
      sheetsXml += `\n<sheet name="${s.name}" sheetId="${sheetId}"${stateAttr} r:id="${rId}"/>`;
      sheetRelsXml += `\n<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetId}.xml"/>`;

      const sheetContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      ${s.cellsXml}
    </row>
  </sheetData>
</worksheet>`;
      zip.file(`xl/worksheets/sheet${sheetId}.xml`, sheetContent);
    });
  }

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheetsXml}
  </sheets>
  <calcPr calcId="191029"/>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRelsXml}
</Relationships>`;

  const sstStrings = options?.sharedStrings || ["{{JUDUL}}", "{{ISI_KONTEN}}"];
  const sstItemsXml = sstStrings.map((s) => `<si><t>${s}</t></si>`).join("");

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

describe("XLSX Template Renderer", () => {
  it("substitutes placeholders in shared strings cleanly", () => {
    const templateBuf = createTemplateXlsxBuffer({
      sharedStrings: ["{{JUDUL}}", "{{NAMA_SEKOLAH}}", "{{ISI_KONTEN}}"],
    });

    const rendered = renderXlsxTemplate(templateBuf, {
      title: "Modul Bahasa Indonesia",
      schoolName: "SMA Negeri 1",
      subjectName: "Bahasa Indonesia",
      teacherName: "Budi Santoso",
      className: "X-A",
      dateStr: "31 Agustus 2026",
      contentType: AiContentType.LESSON_PLAN,
      content: "## Tujuan Pembelajaran\nSiswa mampu memahami teks narasi.",
    });

    expect(rendered.length).toBeGreaterThan(0);
    const outZip = new PizZip(rendered);
    const outSst = outZip.file("xl/sharedStrings.xml")?.asText() || "";

    expect(outSst).toContain("Modul Bahasa Indonesia");
    expect(outSst).toContain("SMA Negeri 1");
    expect(outSst).toContain("Siswa mampu memahami teks narasi");
    expect(outSst).not.toContain("{{JUDUL}}");
  });

  it("substitutes placeholders across multiple sheets and preserves hidden sheets", () => {
    const templateBuf = createTemplateXlsxBuffer({
      sharedStrings: ["{{JUDUL}}", "{{ISI_KONTEN}}", "{{MATA_PELAJARAN}}"],
      extraSheets: [
        {
          name: "ConfigHidden",
          cellsXml: '<c r="A1" t="s"><v>2</v></c>',
          state: "hidden",
        },
      ],
    });

    const rendered = renderXlsxTemplate(templateBuf, {
      title: "RPP Matematika",
      schoolName: "SMP 2",
      subjectName: "Matematika",
      teacherName: "Siti Aminah",
      className: "VIII-B",
      dateStr: "31 Agustus 2026",
      contentType: AiContentType.LESSON_PLAN,
      content: "Isi RPP Matematika",
    });

    const outZip = new PizZip(rendered);
    const outWbXml = outZip.file("xl/workbook.xml")?.asText() || "";
    expect(outWbXml).toContain('name="ConfigHidden"');
    expect(outWbXml).toContain('state="hidden"');

    const outSst = outZip.file("xl/sharedStrings.xml")?.asText() || "";
    expect(outSst).toContain("Matematika");
    expect(outSst).toContain("RPP Matematika");
  });

  it("ensures calcPr sets fullCalcOnLoad='1' and forceFullCalc='1'", () => {
    const templateBuf = createTemplateXlsxBuffer();
    const rendered = renderXlsxTemplate(templateBuf, {
      title: "Test",
      schoolName: "School",
      subjectName: "Subject",
      teacherName: "Teacher",
      className: "Class",
      dateStr: "Date",
      contentType: AiContentType.LESSON_PLAN,
      content: "Content",
    });

    const outZip = new PizZip(rendered);
    const wbXml = outZip.file("xl/workbook.xml")?.asText() || "";
    expect(wbXml).toContain('fullCalcOnLoad="1"');
    expect(wbXml).toContain('forceFullCalc="1"');
  });

  it("enforces MAX_XLSX_CELL_TEXT_UTF16_UNITS (32,767) character limit", () => {
    const valid32767 = "A".repeat(32_767);
    const invalid32768 = "A".repeat(32_768);

    // 32,767 passes
    expect(() =>
      buildXlsxSubstitutionMap({
        title: "Test",
        schoolName: "School",
        subjectName: "Subject",
        teacherName: "Teacher",
        className: "Class",
        dateStr: "Date",
        contentType: AiContentType.LESSON_PLAN,
        content: valid32767,
      })
    ).not.toThrow();

    // 32,768 throws actionable error
    expect(() =>
      buildXlsxSubstitutionMap({
        title: "Test",
        schoolName: "School",
        subjectName: "Subject",
        teacherName: "Teacher",
        className: "Class",
        dateStr: "Date",
        contentType: AiContentType.LESSON_PLAN,
        content: invalid32768,
      })
    ).toThrow(/terlalu panjang.*Batas maksimum satu sel Excel adalah 32767 karakter/);
  });

  it("safely escapes formula injection triggers into string data with HasFormula = False", () => {
    const dangerousContent = `
=1+1
+SUM(A1:A2)
-1+2
@SUM(A1:A2)
   =1+1
\t=1+1
`;

    const templateBuf = createTemplateXlsxBuffer({
      sharedStrings: ["{{ISI_KONTEN}}"],
    });

    const rendered = renderXlsxTemplate(templateBuf, {
      title: "=HYPERLINK('http://evil.com')",
      schoolName: "School",
      subjectName: "Subject",
      teacherName: "Teacher",
      className: "Class",
      dateStr: "Date",
      contentType: AiContentType.LESSON_PLAN,
      content: dangerousContent,
    });

    const outZip = new PizZip(rendered);
    const sstXml = outZip.file("xl/sharedStrings.xml")?.asText() || "";
    // Values are strictly stored as <t xml:space="preserve"> text runs
    expect(sstXml).toContain('<t xml:space="preserve">');
    expect(sstXml).toContain("+SUM(A1:A2)");
  });

  it("preserves embedded images and drawings without corruption", () => {
    const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const templateBuf = createTemplateXlsxBuffer({
      extraFiles: {
        "xl/media/image1.png": fakePng,
        "xl/drawings/drawing1.xml": "<drawing><pic/></drawing>",
        "xl/drawings/_rels/drawing1.xml.rels": "<rels/>",
      },
    });

    const rendered = renderXlsxTemplate(templateBuf, {
      title: "Test with Image",
      schoolName: "School",
      subjectName: "Subject",
      teacherName: "Teacher",
      className: "Class",
      dateStr: "Date",
      contentType: AiContentType.LESSON_PLAN,
      content: "Content with image preservation",
    });

    const outZip = new PizZip(rendered);
    expect(outZip.file("xl/media/image1.png")?.asNodeBuffer()).toEqual(fakePng);
    expect(outZip.file("xl/drawings/drawing1.xml")?.asText()).toContain("<drawing><pic/></drawing>");
  });
});
