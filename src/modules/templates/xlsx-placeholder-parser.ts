import { XMLParser } from "fast-xml-parser";
import { AiContentType } from "@prisma/client";
import {
  CANONICAL_PLACEHOLDER_DEFINITIONS,
  CANONICAL_TAG_SET,
} from "./template-registry";
import {
  PlaceholderLocation,
  PlaceholderManifest,
  TemplateValidationResult,
  XlsxSecurityPreflightResult,
} from "./template.types";

interface SheetMeta {
  name: string;
  sheetId: string;
  rId: string;
  targetPath: string;
  visibility: "VISIBLE" | "HIDDEN" | "VERY_HIDDEN";
}

interface ParsedRun {
  rPr: string;
  text: string;
}

interface ParsedStringItem {
  combinedText: string;
  isExactPlaceholder: boolean;
  tag: string | null;
  hasConflictingFormat: boolean;
  isMixedText: boolean;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  trimValues: false,
});

/**
 * Parse a shared string or inline string node into structured text runs.
 */
function parseStringItemXml(rawXml: string): ParsedStringItem {
  const runs: ParsedRun[] = [];
  const rMatches = rawXml.match(/<r>[\s\S]*?<\/r>/g);

  if (rMatches && rMatches.length > 0) {
    for (const rXml of rMatches) {
      const rPrMatch = rXml.match(/<rPr>[\s\S]*?<\/rPr>/);
      const rPr = rPrMatch ? rPrMatch[0] : "";
      const tMatch = rXml.match(/<t[^>]*>([\s\S]*?)<\/t>/);
      const text = tMatch ? tMatch[1] : "";
      runs.push({ rPr, text });
    }
  } else {
    const tMatch = rawXml.match(/<t[^>]*>([\s\S]*?)<\/t>/);
    const text = tMatch ? tMatch[1] : "";
    runs.push({ rPr: "", text });
  }

  const combinedText = runs.map((r) => r.text).join("");
  const trimmed = combinedText.trim();
  const exactMatch = trimmed.match(/^\{\{([A-Z0-9_]+)\}\}$/);
  const isExactPlaceholder = !!exactMatch;
  const tag = exactMatch ? exactMatch[1] : null;

  const hasMultipleDifferentRPr =
    runs.length > 1 && new Set(runs.map((r) => r.rPr)).size > 1;

  const isMixedText = !isExactPlaceholder && combinedText.includes("{{");

  return {
    combinedText,
    isExactPlaceholder,
    tag,
    hasConflictingFormat: isExactPlaceholder && hasMultipleDifferentRPr,
    isMixedText,
  };
}

/**
 * Parses relationships and sheets from workbook.xml and workbook.xml.rels.
 */
function parseWorkbookSheets(
  workbookXml: string,
  workbookRelsXml: string
): SheetMeta[] {
  // 1. Map rId to targetPath from workbook.xml.rels
  const relMap: Record<string, string> = {};
  try {
    const relsObj = parser.parse(workbookRelsXml);
    const relsList = Array.isArray(relsObj?.Relationships?.Relationship)
      ? relsObj.Relationships.Relationship
      : relsObj?.Relationships?.Relationship
      ? [relsObj.Relationships.Relationship]
      : [];

    for (const rel of relsList) {
      const id = rel["@_Id"];
      let target = rel["@_Target"] || "";
      if (target.startsWith("/")) {
        target = target.slice(1);
      } else if (!target.startsWith("xl/")) {
        target = `xl/${target}`;
      }
      relMap[id] = target;
    }
  } catch {
    // Fallback regex if parser fails
    const relMatches = workbookRelsXml.matchAll(
      /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g
    );
    for (const match of relMatches) {
      let target = match[2];
      if (target.startsWith("/")) target = target.slice(1);
      else if (!target.startsWith("xl/")) target = `xl/${target}`;
      relMap[match[1]] = target;
    }
  }

  // 2. Parse sheet list from workbook.xml in document order
  const sheets: SheetMeta[] = [];
  try {
    const wbObj = parser.parse(workbookXml);
    const rawSheets = Array.isArray(wbObj?.workbook?.sheets?.sheet)
      ? wbObj.workbook.sheets.sheet
      : wbObj?.workbook?.sheets?.sheet
      ? [wbObj.workbook.sheets.sheet]
      : [];

    for (const s of rawSheets) {
      const name = s["@_name"] || "";
      const sheetId = s["@_sheetId"] || "";
      const rId = s["@_r:id"] || s["@_id"] || "";
      const state = (s["@_state"] || "").toLowerCase();

      let visibility: "VISIBLE" | "HIDDEN" | "VERY_HIDDEN" = "VISIBLE";
      if (state === "hidden") visibility = "HIDDEN";
      else if (state === "veryhidden") visibility = "VERY_HIDDEN";

      const targetPath = relMap[rId] || `xl/worksheets/sheet${sheetId}.xml`;
      sheets.push({ name, sheetId, rId, targetPath, visibility });
    }
  } catch {
    // Fallback regex
    const sheetMatches = workbookXml.matchAll(
      /<sheet[^>]*name="([^"]+)"[^>]*sheetId="([^"]+)"[^>]*r:id="([^"]+)"(?:[^>]*state="([^"]+)")?/g
    );
    for (const match of sheetMatches) {
      const name = match[1];
      const sheetId = match[2];
      const rId = match[3];
      const state = (match[4] || "").toLowerCase();
      let visibility: "VISIBLE" | "HIDDEN" | "VERY_HIDDEN" = "VISIBLE";
      if (state === "hidden") visibility = "HIDDEN";
      else if (state === "veryhidden") visibility = "VERY_HIDDEN";

      const targetPath = relMap[rId] || `xl/worksheets/sheet${sheetId}.xml`;
      sheets.push({ name, sheetId, rId, targetPath, visibility });
    }
  }

  return sheets;
}

/**
 * Validates and extracts placeholders and cell locations from an untrusted XLSX package.
 */
export function validateXlsxPlaceholders(
  preflight: XlsxSecurityPreflightResult,
  contentType: AiContentType,
  checksumSha256?: string
): TemplateValidationResult {
  if (!preflight.valid || !preflight.sheetXmlMap || !preflight.workbookXml) {
    return {
      valid: false,
      error: preflight.error || "Pemeriksaan struktur XLSX gagal.",
    };
  }

  const sheets = parseWorkbookSheets(
    preflight.workbookXml,
    preflight.workbookRelsXml || ""
  );

  if (sheets.length === 0) {
    return {
      valid: false,
      error: "Tidak ada lembar kerja (worksheet) ditemukan pada buku kerja Excel.",
    };
  }

  // 1. Parse shared strings table (SST)
  const sstTagMap: Record<number, string> = {};
  const detectedPlaceholdersSet = new Set<string>();
  const unsupportedTagsSet = new Set<string>();

  if (preflight.sharedStringsXml) {
    const rawSiList = preflight.sharedStringsXml.match(/<si>[\s\S]*?<\/si>/g) || [];
    for (let i = 0; i < rawSiList.length; i++) {
      const siXml = rawSiList[i];
      const parsed = parseStringItemXml(siXml);

      if (parsed.isMixedText) {
        return {
          valid: false,
          error: `Placeholder harus menempati seluruh isi sel (contoh: {{JUDUL}}). Format teks campuran seperti '${parsed.combinedText.slice(0, 40)}' tidak didukung pada template Excel.`,
        };
      }

      if (parsed.hasConflictingFormat) {
        return {
          valid: false,
          error: `Placeholder {{${parsed.tag}}} memiliki format teks yang bertentangan dalam satu sel. Pastikan format sel seragam.`,
        };
      }

      if (parsed.isExactPlaceholder && parsed.tag) {
        detectedPlaceholdersSet.add(parsed.tag);
        if (CANONICAL_TAG_SET.has(parsed.tag)) {
          sstTagMap[i] = parsed.tag;
        } else {
          unsupportedTagsSet.add(parsed.tag);
        }
      }
    }
  }

  // 2. Scan every worksheet for cell references
  const rawLocations: PlaceholderLocation[] = [];

  for (const sheet of sheets) {
    const sheetXml = preflight.sheetXmlMap[sheet.targetPath];
    if (!sheetXml) continue;

    // Match all cell elements: <c r="B4" ...>...</c>
    const cellMatches = sheetXml.matchAll(
      /<c\s+([^>]*?)>([\s\S]*?)<\/c>|<c\s+([^>]*?)\/>/g
    );

    for (const match of cellMatches) {
      const attrsStr = match[1] || match[3] || "";
      const innerContent = match[2] || "";

      // Extract cell ref: r="B4"
      const rMatch = attrsStr.match(/r="([A-Z0-9]+)"/i);
      if (!rMatch) continue;
      const cellRef = rMatch[1].toUpperCase();

      // Skip formula cells
      if (innerContent.includes("<f>") || innerContent.includes("<f ")) {
        continue;
      }

      // Check cell type: t="s" (shared string) or t="inlineStr"
      const tMatch = attrsStr.match(/t="([^"]+)"/i);
      const cellType = tMatch ? tMatch[1] : "";

      if (cellType === "s") {
        const vMatch = innerContent.match(/<v>([0-9]+)<\/v>/);
        if (vMatch) {
          const sstIdx = parseInt(vMatch[1], 10);
          const tag = sstTagMap[sstIdx];
          if (tag) {
            if (sheet.visibility === "VERY_HIDDEN") {
              return {
                valid: false,
                error: `Placeholder '{{${tag}}}' ditemukan pada lembar kerja sangat tersembunyi (veryHidden: '${sheet.name}'). Lembar veryHidden tidak diizinkan memiliki placeholder.`,
              };
            }

            rawLocations.push({
              sheet: sheet.name,
              cell: cellRef,
              placeholder: tag,
              sheetVisibility: sheet.visibility === "HIDDEN" ? "HIDDEN" : "VISIBLE",
            });
          }
        }
      } else if (cellType === "inlineStr") {
        const isMatch = innerContent.match(/<is>[\s\S]*?<\/is>/);
        if (isMatch) {
          const parsed = parseStringItemXml(isMatch[0]);

          if (parsed.isMixedText) {
            return {
              valid: false,
              error: `Placeholder harus menempati seluruh isi sel pada ${sheet.name}!${cellRef}. Format teks campuran tidak didukung pada template Excel.`,
            };
          }

          if (parsed.hasConflictingFormat) {
            return {
              valid: false,
              error: `Placeholder {{${parsed.tag}}} pada ${sheet.name}!${cellRef} memiliki format teks yang bertentangan. Pastikan format sel seragam.`,
            };
          }

          if (parsed.isExactPlaceholder && parsed.tag) {
            detectedPlaceholdersSet.add(parsed.tag);
            if (CANONICAL_TAG_SET.has(parsed.tag)) {
              if (sheet.visibility === "VERY_HIDDEN") {
                return {
                  valid: false,
                  error: `Placeholder '{{${parsed.tag}}}' ditemukan pada lembar kerja sangat tersembunyi (veryHidden: '${sheet.name}').`,
                };
              }
              rawLocations.push({
                sheet: sheet.name,
                cell: cellRef,
                placeholder: parsed.tag,
                sheetVisibility: sheet.visibility === "HIDDEN" ? "HIDDEN" : "VISIBLE",
              });
            } else {
              unsupportedTagsSet.add(parsed.tag);
            }
          }
        }
      }
    }
  }

  // 3. Validate unsupported tags
  if (unsupportedTagsSet.size > 0) {
    const unsupportedList = Array.from(unsupportedTagsSet);
    return {
      valid: false,
      error: `Template mengandung placeholder tidak dikenal: ${unsupportedList.map((t) => `{{${t}}}`).join(", ")}. Gunakan tag standar yang didukung.`,
      unsupportedTags: unsupportedList,
    };
  }

  // 4. Validate recognized tags & content-bearing requirements
  const recognizedTags = Array.from(
    new Set(rawLocations.map((loc) => loc.placeholder))
  );

  if (recognizedTags.length === 0) {
    return {
      valid: false,
      error: "Template tidak mengandung satupun placeholder standar yang dikenali sistem.",
    };
  }

  // Filter content-bearing tags compatible with the contentType
  const contentBearingTags = recognizedTags.filter((tag) => {
    const def = CANONICAL_PLACEHOLDER_DEFINITIONS[tag];
    return (
      def &&
      def.isContentBearing &&
      def.supportedContentTypes.includes(contentType)
    );
  });

  if (contentBearingTags.length === 0) {
    return {
      valid: false,
      error: `Template untuk tipe ${contentType} harus memiliki setidaknya satu placeholder konten (misalnya {{ISI_KONTEN}}, {{TUJUAN_PEMBELAJARAN}}, atau {{RINGKASAN}}). Template hanya berisi metadata/judul tidak dapat disimpan.`,
    };
  }

  // 5. Deterministic sorting for locations
  // Sort by sheet order as declared in workbook.xml, then cell coordinates (row number then column)
  const sheetOrderMap: Record<string, number> = {};
  sheets.forEach((s, idx) => {
    sheetOrderMap[s.name] = idx;
  });

  const sortedLocations = [...rawLocations].sort((a, b) => {
    const sA = sheetOrderMap[a.sheet] ?? 999;
    const sB = sheetOrderMap[b.sheet] ?? 999;
    if (sA !== sB) return sA - sB;

    // Parse cell coordinates (e.g. "B4" -> col "B", row 4)
    const matchA = a.cell.match(/^([A-Z]+)([0-9]+)$/);
    const matchB = b.cell.match(/^([A-Z]+)([0-9]+)$/);
    if (matchA && matchB) {
      const rowA = parseInt(matchA[2], 10);
      const rowB = parseInt(matchB[2], 10);
      if (rowA !== rowB) return rowA - rowB;
      if (matchA[1] !== matchB[1]) return matchA[1].localeCompare(matchB[1]);
    }
    return a.placeholder.localeCompare(b.placeholder);
  });

  const manifest: PlaceholderManifest = {
    version: 2,
    format: "XLSX",
    detectedPlaceholders: Array.from(detectedPlaceholdersSet).sort(),
    recognized: recognizedTags.sort(),
    unsupported: [],
    contentBearing: contentBearingTags.sort(),
    locations: sortedLocations,
  };

  return {
    valid: true,
    manifest,
    checksumSha256,
  };
}
