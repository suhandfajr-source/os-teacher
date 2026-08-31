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

/**
 * Normalizes Markdown text into clean plain text suitable for DOCX template substitution.
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
        // If we hit another heading of same or higher level, stop capturing
        if (depth <= targetDepth) {
          break;
        }
      }

      // Check if this heading matches any alias strictly (exact match after stripping leading numbering and trailing colon/punctuation)
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

  return normalizeMarkdownToPlainText(resultLines.join("\n"));
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
 * Renders a DOCX template buffer by injecting data using PizZip and Docxtemplater.
 * Enforces maximum generated DOCX file size (4 MB).
 */
export async function renderDocxTemplate(
  templateBytes: Buffer,
  manifest: PlaceholderManifest,
  context: TemplateRenderContext
): Promise<Buffer> {
  const data = buildTemplateDataDictionary(manifest, context);

  let zip: PizZip;
  try {
    zip = new PizZip(templateBytes);
  } catch (err: unknown) {
    throw new Error(`Gagal membaca arsip template: ${(err as Error).message}`);
  }

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: {
      start: "{{",
      end: "}}",
    },
    nullGetter: () => "",
  });

  try {
    doc.render(data);
  } catch (err: unknown) {
    throw new Error(`Gagal menyusun dokumen Word: ${(err as Error).message}`);
  }

  const outputBuffer = doc.getZip().generate({
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
