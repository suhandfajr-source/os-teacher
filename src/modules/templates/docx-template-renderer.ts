import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { AiContentType } from "@prisma/client";
import {
  MAX_GENERATED_DOCX_BYTES,
  PlaceholderManifest,
} from "./template.types";
import { CANONICAL_PLACEHOLDER_REGISTRY } from "./template-registry";

export interface TemplateRenderContext {
  title: string;
  content: string;
  contentType: AiContentType;
  schoolName?: string;
  subjectName?: string;
  teacherName?: string;
  className?: string;
  dateFormatted?: string;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanHeadingText(text: string): string {
  return text.replace(/^#+\s*/, "").replace(/[*_#`~]+/g, "").trim();
}

function renderOpenXmlRuns(rawText: string, forceBold = false): string {
  const clean = rawText.trim();
  if (!clean) return "";

  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|___[^_]+___|__[^_]+__|_[^_]+_|`[^`]+`)/g;
  const parts = clean.split(regex);
  let xml = "";

  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("***") && part.endsWith("***") && part.length > 6) {
      xml += `<w:r><w:rPr><w:b/><w:bCs/><w:i/><w:iCs/></w:rPr><w:t xml:space="preserve">${escapeXml(part.slice(3, -3))}</w:t></w:r>`;
    } else if (
      (part.startsWith("**") && part.endsWith("**") && part.length > 4) ||
      (part.startsWith("__") && part.endsWith("__") && part.length > 4)
    ) {
      xml += `<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">${escapeXml(part.slice(2, -2))}</w:t></w:r>`;
    } else if (
      (part.startsWith("*") && part.endsWith("*") && part.length > 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length > 2)
    ) {
      xml += `<w:r><w:rPr><w:i/><w:iCs/></w:rPr><w:t xml:space="preserve">${escapeXml(part.slice(1, -1))}</w:t></w:r>`;
    } else if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      xml += `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr><w:t xml:space="preserve">${escapeXml(part.slice(1, -1))}</w:t></w:r>`;
    } else {
      xml += `<w:r>${forceBold ? '<w:rPr><w:b/><w:bCs/></w:rPr>' : ""}<w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`;
    }
  }

  return xml || `<w:r>${forceBold ? '<w:rPr><w:b/><w:bCs/></w:rPr>' : ""}<w:t xml:space="preserve">${escapeXml(clean)}</w:t></w:r>`;
}

/**
 * Converts Markdown content into native Word OpenXML elements (<w:tbl>, <w:p>, <w:r>).
 * Produces clean Word tables with borders and shaded headers, headings, bold/italic runs, and lists.
 */
export function convertMarkdownToOpenXml(markdown: string): string {
  if (!markdown) return "<w:p/>";

  const lines = markdown.split(/\r?\n/);
  const elements: string[] = [];
  let tableRows: string[][] = [];
  let inTable = false;

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const numCols = Math.max(...tableRows.map((r) => r.length), 1);
    const colWidthDxa = Math.floor(9360 / numCols);

    const gridCols = Array(numCols)
      .fill(0)
      .map(() => `<w:gridCol w:w="${colWidthDxa}"/>`)
      .join("");

    const tblRowsXml = tableRows
      .map((row, rIdx) => {
        const isHeader = rIdx === 0;
        const cellsXml = row
          .map((cellText) => {
            const cellLines = cellText.split(/<br\s*\/?>|\n/gi);
            const pXml = cellLines
              .map(
                (cLine) => `
                <w:p>
                  <w:pPr>
                    <w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/>
                  </w:pPr>
                  ${renderOpenXmlRuns(cLine.trim(), isHeader)}
                </w:p>`
              )
              .join("");

            return `
              <w:tc>
                <w:tcPr>
                  <w:tcW w:w="${colWidthDxa}" w:type="dxa"/>
                  ${isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/>' : ""}
                </w:tcPr>
                ${pXml || "<w:p/>"}
              </w:tc>`;
          })
          .join("");

        return `
          <w:tr>
            ${isHeader ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}
            ${cellsXml}
          </w:tr>`;
      })
      .join("");

    const tblXml = `
      <w:tbl>
        <w:tblPr>
          <w:tblW w:w="5000" w:type="pct"/>
          <w:tblBorders>
            <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
            <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          </w:tblBorders>
          <w:tblCellMar>
            <w:top w:w="120" w:type="dxa"/>
            <w:left w:w="160" w:type="dxa"/>
            <w:bottom w:w="120" w:type="dxa"/>
            <w:right w:w="160" w:type="dxa"/>
          </w:tblCellMar>
        </w:tblPr>
        <w:tblGrid>${gridCols}</w:tblGrid>
        ${tblRowsXml}
      </w:tbl>
      <w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>`;

    elements.push(tblXml);
    tableRows = [];
    inTable = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Table detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (trimmed.replace(/[|\-\s:]/g, "").length === 0) continue;
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (!trimmed || trimmed === "---" || trimmed === "***") {
      elements.push('<w:p><w:pPr><w:spacing w:after="100"/></w:pPr></w:p>');
      continue;
    }

    // Heading 1
    if (trimmed.startsWith("# ")) {
      const text = cleanHeadingText(trimmed);
      elements.push(`
        <w:p>
          <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="1E293B"/></w:rPr>
            <w:t xml:space="preserve">${escapeXml(text)}</w:t>
          </w:r>
        </w:p>`);
      continue;
    }

    // Heading 2
    if (trimmed.startsWith("## ")) {
      const text = cleanHeadingText(trimmed);
      elements.push(`
        <w:p>
          <w:pPr><w:spacing w:before="180" w:after="100"/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="334155"/></w:rPr>
            <w:t xml:space="preserve">${escapeXml(text)}</w:t>
          </w:r>
        </w:p>`);
      continue;
    }

    // Heading 3
    if (trimmed.startsWith("### ")) {
      const text = cleanHeadingText(trimmed);
      elements.push(`
        <w:p>
          <w:pPr><w:spacing w:before="140" w:after="80"/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="475569"/></w:rPr>
            <w:t xml:space="preserve">${escapeXml(text)}</w:t>
          </w:r>
        </w:p>`);
      continue;
    }

    // Heading 4, 5, 6
    if (/^#{4,}\s+/.test(trimmed)) {
      const text = cleanHeadingText(trimmed);
      elements.push(`
        <w:p>
          <w:pPr><w:spacing w:before="120" w:after="60"/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:bCs/><w:sz w:val="21"/><w:szCs w:val="21"/><w:color w:val="475569"/></w:rPr>
            <w:t xml:space="preserve">${escapeXml(text)}</w:t>
          </w:r>
        </w:p>`);
      continue;
    }

    // Bullet List
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const text = trimmed.slice(2);
      elements.push(`
        <w:p>
          <w:pPr>
            <w:ind w:left="360" w:hanging="180"/>
            <w:spacing w:after="60"/>
          </w:pPr>
          <w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">•  </w:t></w:r>
          ${renderOpenXmlRuns(text)}
        </w:p>`);
      continue;
    }

    // Numbered List
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      elements.push(`
        <w:p>
          <w:pPr>
            <w:ind w:left="360" w:hanging="180"/>
            <w:spacing w:after="60"/>
          </w:pPr>
          <w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">${numMatch[1]}.  </w:t></w:r>
          ${renderOpenXmlRuns(numMatch[2])}
        </w:p>`);
      continue;
    }

    // Normal Paragraph
    elements.push(`
      <w:p>
        <w:pPr><w:spacing w:after="120"/></w:pPr>
        ${renderOpenXmlRuns(trimmed)}
      </w:p>`);
  }

  if (inTable) {
    flushTable();
  }

  return elements.join("\n");
}

/**
 * Extracts raw markdown section without normalizing to plain text so it can be converted to OpenXML.
 */
export function extractRawSectionByHeading(
  markdown: string,
  headingAliases: string[]
): string {
  if (!markdown || headingAliases.length === 0) return "";

  const lines = markdown.split(/\r?\n/);
  const resultLines: string[] = [];
  let isCapturing = false;
  let targetDepth = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const depth = headingMatch[1].length;
      const title = headingMatch[2].trim().toLowerCase();

      if (isCapturing) {
        if (depth <= targetDepth) {
          break;
        }
      }

      const cleanHeading = title
        .replace(/^[\d.)\s]+/, "")
        .replace(/[:.-]+$/, "")
        .trim();

      const matchesAlias = headingAliases.some((alias) =>
        cleanHeading === alias.toLowerCase()
      );

      if (matchesAlias) {
        isCapturing = true;
        targetDepth = depth;
        continue;
      }
    }

    if (isCapturing) {
      resultLines.push(line);
    }
  }

  return resultLines.join("\n").trim();
}

/**
 * Normalizes Markdown text into clean plain text suitable for scalar DOCX template substitution.
 */
export function normalizeMarkdownToPlainText(markdown: string): string {
  if (!markdown) return "";

  return markdown
    // Remove markdown code blocks
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, "").trim())
    // Replace headings with clean line breaks
    .replace(/^#{1,6}\s+(.+)$/gm, "$1")
    // Replace bold and italic
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Convert list markers to clean bullets and indentation
    .replace(/^(\s*)[-*+]\s+(.+)$/gm, "$1• $2")
    // Convert numbered lists
    .replace(/^(\s*)\d+\.\s+(.+)$/gm, "$1$2")
    // Clean table separators and pipes
    .replace(/^\|[\s\-:|]+\|$/gm, "")
    .replace(/^\|(.+)\|$/gm, (_, inner) =>
      inner
        .split("|")
        .map((c: string) => c.trim())
        .filter(Boolean)
        .join(" — ")
    )
    // Normalize excessive newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extracts a specific section from Markdown based on heading aliases.
 */
export function extractSectionByHeading(
  markdown: string,
  headingAliases: string[]
): string {
  const raw = extractRawSectionByHeading(markdown, headingAliases);
  return normalizeMarkdownToPlainText(raw);
}

/**
 * Builds data dictionary for docxtemplater based on manifest and context.
 */
export function buildTemplateDataDictionary(
  manifest: PlaceholderManifest,
  context: TemplateRenderContext
): Record<string, string> {
  const data: Record<string, string> = {};
  const normalizedBody = normalizeMarkdownToPlainText(context.content);

  for (const tag of manifest.recognized) {
    const def = CANONICAL_PLACEHOLDER_REGISTRY[tag];

    switch (tag) {
      case "JUDUL":
        if (def?.isValueRequiredAtExport && !context.title?.trim()) {
          throw new Error("Judul dokumen wajib diisi untuk ekspor template ini.");
        }
        data[tag] = context.title || "";
        break;

      case "NAMA_SEKOLAH":
        data[tag] = context.schoolName || "";
        break;

      case "MATA_PELAJARAN":
        data[tag] = context.subjectName || "";
        break;

      case "GURU":
        data[tag] = context.teacherName || "";
        break;

      case "KELAS":
        data[tag] = context.className || "";
        break;

      case "TANGGAL":
        data[tag] =
          context.dateFormatted ||
          new Intl.DateTimeFormat("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(new Date());
        break;

      case "ISI_KONTEN":
        if (def?.isValueRequiredAtExport && !normalizedBody) {
          throw new Error("Isi materi dokumen wajib diisi untuk ekspor template ini.");
        }
        data[tag] = normalizedBody;
        break;

      case "TUJUAN_PEMBELAJARAN":
      case "RINGKASAN":
      case "LANGKAH_PEMBELAJARAN":
      case "SOAL_PILIHAN_GANDA":
      case "SOAL_ESSAY":
      case "KUNCI_JAWABAN":
      case "RUBRIK_PENILAIAN": {
        const aliases = def?.headingAliases || [];
        const extracted = extractSectionByHeading(context.content, aliases);
        data[tag] = extracted || "";
        break;
      }

      default:
        data[tag] = "";
        break;
    }
  }

  return data;
}

/**
 * Renders a DOCX template buffer by injecting data using OpenXML structured replacement and Docxtemplater.
 * Preserves template Kop Surat, header/footer layout, and injects native Word tables and formatting.
 * Enforces maximum generated DOCX file size (4 MB).
 */
export async function renderDocxTemplate(
  templateBytes: Buffer,
  manifest: PlaceholderManifest,
  context: TemplateRenderContext
): Promise<Buffer> {
  let zip: PizZip;
  try {
    zip = new PizZip(templateBytes);
  } catch (err: unknown) {
    throw new Error(`Gagal membaca arsip template: ${(err as Error).message}`);
  }

  // 1. Scalar variables replacement mapping
  const scalarMap: Record<string, string> = {
    JUDUL: context.title || "",
    NAMA_SEKOLAH: context.schoolName || "",
    MATA_PELAJARAN: context.subjectName || "",
    GURU: context.teacherName || "",
    KELAS: context.className || "",
    TANGGAL:
      context.dateFormatted ||
      new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
  };

  // Content-bearing section tags to OpenXML mapping
  const contentTags: Array<{ tag: string; xml: string }> = [];

  const defIsiKonten = CANONICAL_PLACEHOLDER_REGISTRY["ISI_KONTEN"];
  if (defIsiKonten?.isValueRequiredAtExport && !context.content?.trim()) {
    throw new Error("Isi materi dokumen wajib diisi untuk ekspor template ini.");
  }
  const defJudul = CANONICAL_PLACEHOLDER_REGISTRY["JUDUL"];
  if (defJudul?.isValueRequiredAtExport && !context.title?.trim()) {
    throw new Error("Judul dokumen wajib diisi untuk ekspor template ini.");
  }

  // Generate OpenXML for ISI_KONTEN
  contentTags.push({
    tag: "ISI_KONTEN",
    xml: convertMarkdownToOpenXml(context.content),
  });

  // Generate OpenXML for specific section placeholders
  const sectionPlaceholderKeys = [
    "TUJUAN_PEMBELAJARAN",
    "RINGKASAN",
    "LANGKAH_PEMBELAJARAN",
    "SOAL_PILIHAN_GANDA",
    "SOAL_ESSAY",
    "KUNCI_JAWABAN",
    "RUBRIK_PENILAIAN",
  ];

  for (const tag of sectionPlaceholderKeys) {
    const def = CANONICAL_PLACEHOLDER_REGISTRY[tag];
    const aliases = def?.headingAliases || [];
    const rawSection = extractRawSectionByHeading(context.content, aliases);
    contentTags.push({
      tag,
      xml: rawSection ? convertMarkdownToOpenXml(rawSection) : "<w:p/>",
    });
  }

  // 2. Process word/document.xml to replace content paragraphs with structured OpenXML
  const docFile = zip.file("word/document.xml");
  if (docFile) {
    let docXml = docFile.asText();

    // Replace rich content placeholders by replacing the enclosing <w:p>...</w:p>
    for (const { tag, xml } of contentTags) {
      // Regex matches any <w:p> containing {{tag}} or split runs of {{tag}}
      const tagRegex = new RegExp(`<w:p\\b[^>]*>(?:(?!<\\/w:p>)[\\s\\S])*?\\{\\{${tag}\\}\\}[\\s\\S]*?<\\/w:p>`, "g");
      if (tagRegex.test(docXml)) {
        docXml = docXml.replace(tagRegex, xml);
      }
    }

    zip.file("word/document.xml", docXml);
  }

  // 3. Use Docxtemplater for clean scalar tag substitution across all parts (headers, footers, doc)
  const data = buildTemplateDataDictionary(manifest, context);

  try {
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: "{{",
        end: "}}",
      },
      nullGetter: () => "",
    });

    doc.render({
      ...data,
      ...scalarMap,
    });
  } catch (err: unknown) {
    // If docxtemplater fails on remaining tags, fallback to safe regex replacement on scalar tags
    for (const file of Object.keys(zip.files)) {
      if (file.startsWith("word/") && file.endsWith(".xml")) {
        let xmlContent = zip.file(file)?.asText() || "";
        for (const [sKey, sVal] of Object.entries(scalarMap)) {
          xmlContent = xmlContent.replace(new RegExp(`\\{\\{${sKey}\\}\\}`, "g"), escapeXml(sVal));
        }
        zip.file(file, xmlContent);
      }
    }
  }

  const outputBuffer = zip.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;

  // Enforce Output Size Ceiling (4 MB)
  if (outputBuffer.length > MAX_GENERATED_DOCX_BYTES) {
    throw new Error(
      `Ukuran dokumen hasil generasi (${outputBuffer.length} byte) melebihi batas sistem (${MAX_GENERATED_DOCX_BYTES} byte / 4 MB). Harap ringkas konten materi.`
    );
  }

  return outputBuffer;
}

/**
 * Creates safe RFC 5987 and ASCII Content-Disposition header.
 */
export function createSafeContentDisposition(rawFilename: string): string {
  const cleanBase = rawFilename
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\w\s.-]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 100);

  const asciiFilename = `${cleanBase}.docx`;
  const utf8Filename = encodeURIComponent(
    rawFilename
      .replace(/[\r\n]+/g, " ")
      .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100) + ".docx"
  );

  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`;
}
