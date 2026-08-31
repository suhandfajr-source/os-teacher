import crypto from "crypto";
import { AiContentType } from "@prisma/client";
import {
  getContentBearingTagsForType,
  isRecognizedTag,
} from "./template-registry";
import {
  PlaceholderManifest,
  TemplateValidationResult,
} from "./template.types";
import { validateDocxSecurityPreflight } from "./docx-security-validator";

/**
 * Normalizes run properties string for comparison.
 */
function normalizeRunProperties(rPrXml: string): string {
  return rPrXml
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if a placeholder within paragraph XML spans split runs with conflicting formatting.
 */
function checkParagraphSplitRunFormatting(paragraphXml: string): {
  hasConflictingFormatting: boolean;
  conflictingTag?: string;
} {
  // Find all runs in the paragraph
  const runRegex = /<w:r\b[^>]*>(?:<w:rPr>([\s\S]*?)<\/w:rPr>)?[\s\S]*?<w:t\b[^>]*>([\s\S]*?)<\/w:t>[\s\S]*?<\/w:r>/g;
  const runs: { rPr: string; text: string }[] = [];

  let match: RegExpExecArray | null;
  while ((match = runRegex.exec(paragraphXml)) !== null) {
    runs.push({
      rPr: normalizeRunProperties(match[1] || ""),
      text: match[2] || "",
    });
  }

  // Check if a placeholder spans across multiple runs
  const fullText = runs.map((r) => r.text).join("");
  const placeholderRegex = /\{\{([A-Z0-9_]+)\}\}/g;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = placeholderRegex.exec(fullText)) !== null) {
    const tagName = pMatch[1];
    const startIndex = pMatch.index;
    const endIndex = startIndex + pMatch[0].length;

    // Find which runs contribute to this placeholder
    let currentIndex = 0;
    const contributingRunProps: string[] = [];

    for (const run of runs) {
      const runStart = currentIndex;
      const runEnd = currentIndex + run.text.length;
      currentIndex = runEnd;

      // If run overlaps with placeholder range
      if (Math.max(startIndex, runStart) < Math.min(endIndex, runEnd)) {
        contributingRunProps.push(run.rPr);
      }
    }

    // If multiple runs contribute and they have different formatting
    if (contributingRunProps.length > 1) {
      const firstProp = contributingRunProps[0];
      const hasConflict = contributingRunProps.some((prop) => prop !== firstProp);
      if (hasConflict) {
        return {
          hasConflictingFormatting: true,
          conflictingTag: tagName,
        };
      }
    }
  }

  return { hasConflictingFormatting: false };
}

/**
 * Extracts all placeholder tags from XML contents.
 */
function extractPlaceholderTagsFromXmls(xmlContents: string[]): {
  tags: string[];
  hasConflictingFormatting: boolean;
  conflictingTag?: string;
} {
  const tagSet = new Set<string>();

  for (const xml of xmlContents) {
    // Check paragraphs for split-run formatting conflicts and extract text
    const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = pRegex.exec(xml)) !== null) {
      const pXml = pMatch[0];
      const check = checkParagraphSplitRunFormatting(pXml);
      if (check.hasConflictingFormatting) {
        return {
          tags: [],
          hasConflictingFormatting: true,
          conflictingTag: check.conflictingTag,
        };
      }

      // Aggregate text across <w:t> tags in this paragraph
      const tMatches = pXml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || [];
      const pText = tMatches
        .map((t) => t.replace(/<w:t\b[^>]*>/, "").replace(/<\/w:t>/, ""))
        .join("");

      const matches = pText.match(/\{\{([A-Z0-9_]+)\}\}/g) || [];
      for (const m of matches) {
        const tag = m.replace(/[{}]/g, "").trim();
        if (tag) {
          tagSet.add(tag);
        }
      }
    }
  }

  return {
    tags: Array.from(tagSet).sort(),
    hasConflictingFormatting: false,
  };
}

/**
 * Validates a DOCX template file buffer against security rules,
 * OpenXML structure, split-run formatting, and canonical placeholder requirements.
 */
export async function validateAndParseDocxTemplate(
  buffer: Buffer,
  contentType: AiContentType
): Promise<TemplateValidationResult> {
  // 1. Security & OpenXML Preflight Validation
  const preflight = await validateDocxSecurityPreflight(buffer);
  if (!preflight.valid || !preflight.xmlContents) {
    return {
      valid: false,
      error: preflight.error || "Validasi keamanan dokumen gagal.",
    };
  }

  // 2. Extract and Validate Placeholders
  const allXmls = [
    preflight.xmlContents.documentXml,
    ...preflight.xmlContents.headerXmls,
    ...preflight.xmlContents.footerXmls,
  ];

  const extracted = extractPlaceholderTagsFromXmls(allXmls);
  if (extracted.hasConflictingFormatting) {
    return {
      valid: false,
      error: `Tag {{${extracted.conflictingTag}}} terpecah dengan pemformatan yang bertentangan (misalnya sebagian tebal, sebagian miring). Harap seragamkan format tag dalam dokumen Word.`,
    };
  }

  const detectedPlaceholders = extracted.tags;

  if (detectedPlaceholders.length === 0) {
    return {
      valid: false,
      error: "Tidak ditemukan placeholder tag yang valid (misalnya {{JUDUL}} atau {{ISI_KONTEN}}) dalam dokumen.",
    };
  }

  // 3. Classify Recognized vs Unsupported Placeholders
  const recognized: string[] = [];
  const unsupported: string[] = [];

  for (const tag of detectedPlaceholders) {
    if (isRecognizedTag(tag)) {
      recognized.push(tag);
    } else {
      unsupported.push(tag);
    }
  }

  // 4. Unsupported Tag Enforcement (BLOCK UPLOAD)
  if (unsupported.length > 0) {
    unsupported.sort();
    const formattedList = unsupported.map((t) => `{{${t}}}`).join(", ");
    return {
      valid: false,
      error: `Template mengandung tag yang belum didukung: ${formattedList}. Harap hapus atau sesuaikan tag tersebut.`,
      unsupportedTags: unsupported,
    };
  }

  // 5. Content-Bearing Tag Contract
  const supportedContentBearingTags = getContentBearingTagsForType(contentType);
  const matchedContentBearing = recognized.filter((t) =>
    supportedContentBearingTags.includes(t)
  );

  if (matchedContentBearing.length === 0) {
    const requiredOptions = supportedContentBearingTags.map((t) => `{{${t}}}`).join(" atau ");
    return {
      valid: false,
      error: `Template untuk tipe konten '${contentType}' harus memuat setidaknya satu tag konten: ${requiredOptions}.`,
    };
  }

  // 6. Generate Checksum SHA-256
  const checksumSha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  // 7. Assemble Manifest
  const manifest: PlaceholderManifest = {
    version: 1,
    detectedPlaceholders,
    recognized,
    unsupported: [],
    contentBearing: matchedContentBearing,
    hasHeaders: preflight.hasHeaders || false,
    hasFooters: preflight.hasFooters || false,
    hasTables: preflight.hasTables || false,
  };

  return {
    valid: true,
    manifest,
    checksumSha256,
  };
}
