import PizZip from "pizzip";
import { AiContentType } from "@prisma/client";
import {
  MAX_GENERATED_XLSX_BYTES,
  MAX_XLSX_CELL_TEXT_UTF16_UNITS,
} from "./template.types";
import { CANONICAL_PLACEHOLDER_DEFINITIONS } from "./template-registry";

export interface XlsxRenderData {
  title: string;
  schoolName: string;
  subjectName: string;
  teacherName: string;
  className: string;
  dateStr: string;
  contentType: AiContentType;
  content: string; // Raw markdown
}

/**
 * Escapes special XML characters.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Normalizes markdown formatting into clean plaintext for Excel cells.
 */
function normalizeMarkdownForCell(md: string): string {
  if (!md) return "";
  let text = md.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Replace Markdown headers (# Header -> Header)
  text = text.replace(/^#{1,6}\s+(.+)$/gm, "$1");

  // Replace Markdown bold & italic (**text** or *text* -> text)
  text = text.replace(/\*\*(.*?)\*\*/g, "$1");
  text = text.replace(/\*(.*?)\*/g, "$1");
  text = text.replace(/__(.*?)__/g, "$1");
  text = text.replace(/_(.*?)_/g, "$1");

  // Normalize bullet points (- item or * item -> • item)
  text = text.replace(/^[\*\-]\s+(.+)$/gm, "• $1");

  // Normalize newlines to Windows CRLF for Excel cells
  return text.replace(/\n/g, "\r\n").trim();
}

/**
 * Extracts a specific section from structured markdown content based on exact heading aliases.
 */
function extractSectionByHeading(content: string, aliases?: string[]): string {
  if (!aliases || aliases.length === 0 || !content) return "";

  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let capturing = false;
  const capturedLines: string[] = [];

  const normalizedAliases = aliases.map((a) =>
    a.trim().toLowerCase().replace(/[^\w\s]/g, "")
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);

    if (headingMatch) {
      const headingTitle = headingMatch[1].trim();
      const strippedTitle = headingTitle
        .replace(/^\d+[\.\)]\s*/, "")
        .trim()
        .toLowerCase()
        .replace(/[^\w\s]/g, "");

      const isMatch = normalizedAliases.some(
        (alias) => strippedTitle === alias
      );

      if (isMatch) {
        capturing = true;
        continue;
      } else if (capturing) {
        break;
      }
    } else if (capturing) {
      capturedLines.push(line);
    }
  }

  return normalizeMarkdownForCell(capturedLines.join("\n"));
}

/**
 * Builds the canonical tag substitution map for an XLSX template export.
 */
export function buildXlsxSubstitutionMap(data: XlsxRenderData): Record<string, string> {
  const map: Record<string, string> = {
    JUDUL: data.title || "",
    NAMA_SEKOLAH: data.schoolName || "",
    MATA_PELAJARAN: data.subjectName || "",
    GURU: data.teacherName || "",
    KELAS: data.className || "",
    TANGGAL: data.dateStr || "",
    ISI_KONTEN: normalizeMarkdownForCell(data.content),
  };

  // Resolve section placeholders from canonical definitions
  for (const [tag, def] of Object.entries(CANONICAL_PLACEHOLDER_DEFINITIONS)) {
    if (def.isContentBearing && def.headingAliases) {
      const sectionText = extractSectionByHeading(data.content, def.headingAliases);
      map[tag] = sectionText;
    }
  }

  // Enforce MAX_XLSX_CELL_TEXT_UTF16_UNITS (32,767) limit
  for (const [tag, val] of Object.entries(map)) {
    if (val && val.length > MAX_XLSX_CELL_TEXT_UTF16_UNITS) {
      throw new Error(
        `Isi untuk {{${tag}}} terlalu panjang (${val.length} karakter). Batas maksimum satu sel Excel adalah ${MAX_XLSX_CELL_TEXT_UTF16_UNITS} karakter. Ringkas konten atau gunakan ekspor Excel Standar.`
      );
    }
  }

  return map;
}

/**
 * Renders an XLSX template buffer with resolved content via minimal targeted OpenXML patching.
 */
export function renderXlsxTemplate(
  templateBuffer: Buffer,
  data: XlsxRenderData
): Buffer {
  const substitutions = buildXlsxSubstitutionMap(data);
  const zip = new PizZip(templateBuffer);

  // 1. Patch sharedStrings.xml if present
  const sharedStringsFile = zip.file("xl/sharedStrings.xml");
  if (sharedStringsFile) {
    let sstXml = sharedStringsFile.asText();
    const rawSiList = sstXml.match(/<si>[\s\S]*?<\/si>/g) || [];

    for (const siXml of rawSiList) {
      // Extract combined text
      const tMatches = siXml.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
      const combinedText = tMatches
        .map((t) => t.replace(/<[^>]+>/g, ""))
        .join("")
        .trim();

      const exactMatch = combinedText.match(/^\{\{([A-Z0-9_]+)\}\}$/);
      if (exactMatch) {
        const tag = exactMatch[1];
        if (tag in substitutions) {
          const resolvedValue = substitutions[tag] || "";
          const escaped = escapeXml(resolvedValue);
          const replacement = `<si><t xml:space="preserve">${escaped}</t></si>`;
          sstXml = sstXml.replace(siXml, replacement);
        }
      }
    }

    zip.file("xl/sharedStrings.xml", sstXml);
  }

  // 2. Patch inline strings in all worksheet XMLs
  const sheetFiles = zip.file(/^xl\/worksheets\/sheet.*\.xml$/);
  for (const sheetFile of sheetFiles) {
    let sheetXml = sheetFile.asText();
    let modified = false;

    sheetXml = sheetXml.replace(
      /<c\s+([^>]*?t="inlineStr"[^>]*?)>([\s\S]*?)<\/c>/g,
      (match, attrs, inner) => {
        const isMatch = inner.match(/<is>([\s\S]*?)<\/is>/);
        if (!isMatch) return match;

        const tMatches = isMatch[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
        const combinedText = tMatches
          .map((t: string) => t.replace(/<[^>]+>/g, ""))
          .join("")
          .trim();

        const exactMatch = combinedText.match(/^\{\{([A-Z0-9_]+)\}\}$/);
        if (exactMatch && exactMatch[1] in substitutions) {
          modified = true;
          const tag = exactMatch[1];
          const resolvedValue = substitutions[tag] || "";
          const escaped = escapeXml(resolvedValue);
          return `<c ${attrs}><is><t xml:space="preserve">${escaped}</t></is></c>`;
        }
        return match;
      }
    );

    if (modified) {
      zip.file(sheetFile.name, sheetXml);
    }
  }

  // 3. Patch workbook.xml to ensure fullCalcOnLoad="1" and forceFullCalc="1" on <calcPr>
  const workbookFile = zip.file("xl/workbook.xml");
  if (workbookFile) {
    let wbXml = workbookFile.asText();
    if (wbXml.includes("<calcPr")) {
      wbXml = wbXml.replace(
        /<calcPr([^/>]*)\/>/g,
        '<calcPr$1 fullCalcOnLoad="1" forceFullCalc="1"/>'
      );
      wbXml = wbXml.replace(
        /<calcPr([^/>]*)>/g,
        '<calcPr$1 fullCalcOnLoad="1" forceFullCalc="1">'
      );
    } else {
      // Insert before <extLst> or before </workbook>
      if (wbXml.includes("<extLst>")) {
        wbXml = wbXml.replace(
          "<extLst>",
          '<calcPr fullCalcOnLoad="1" forceFullCalc="1"/><extLst>'
        );
      } else {
        wbXml = wbXml.replace(
          "</workbook>",
          '<calcPr fullCalcOnLoad="1" forceFullCalc="1"/></workbook>'
        );
      }
    }
    zip.file("xl/workbook.xml", wbXml);
  }

  const generatedBuffer = zip.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  if (generatedBuffer.length > MAX_GENERATED_XLSX_BYTES) {
    throw new Error(
      `Ukuran file Excel yang dihasilkan (${generatedBuffer.length} bytes) melebihi batas sistem (${MAX_GENERATED_XLSX_BYTES} bytes).`
    );
  }

  return generatedBuffer;
}
