import yauzl, { Entry } from "yauzl";
import {
  MAX_ZIP_ENTRIES,
  MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES,
  MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES,
  XlsxSecurityPreflightResult,
} from "./template.types";

/**
 * Perform hostile-file security preflight on an untrusted XLSX buffer.
 * Enforces strict entry limits, decompressed size limits, path sanitization,
 * and rejects macros, ActiveX, embeddings, and external data links.
 */
export async function validateXlsxSecurityPreflight(
  buffer: Buffer
): Promise<XlsxSecurityPreflightResult> {
  return new Promise((resolve) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (err, zipfile) => {
        if (err || !zipfile) {
          return resolve({
            valid: false,
            error: "Format file tidak valid atau arsip Excel rusak.",
          });
        }

        let entryCount = 0;
        let totalUncompressedBytes = 0;
        let hasContentTypes = false;
        let hasRootRels = false;
        let hasWorkbookXml = false;
        let hasWorkbookRels = false;
        let hasWorksheets = false;

        let contentTypesXml = "";
        let workbookXml = "";
        let workbookRelsXml = "";
        let sharedStringsXml = "";
        const sheetXmlMap: Record<string, string> = {};

        let isClosed = false;
        const closeWithError = (errorMessage: string) => {
          if (!isClosed) {
            isClosed = true;
            try {
              zipfile.close();
            } catch {
              // Ignore close errors
            }
            resolve({ valid: false, error: errorMessage });
          }
        };

        zipfile.on("error", (zipErr) => {
          closeWithError(
            `Gagal membaca arsip Excel: ${zipErr.message || "Arsip rusak"}`
          );
        });

        zipfile.on("entry", (entry: Entry) => {
          if (isClosed) return;

          entryCount++;
          if (entryCount > MAX_ZIP_ENTRIES) {
            return closeWithError(
              `Jumlah entri dalam arsip (${entryCount}) melebihi batas sistem (${MAX_ZIP_ENTRIES}).`
            );
          }

          const fileName = entry.fileName;

          // 1. Path traversal & control characters defense
          if (
            fileName.includes("..") ||
            fileName.startsWith("/") ||
            fileName.startsWith("\\") ||
            /^[a-zA-Z]:/.test(fileName) ||
            /[\x00-\x1F\x7F]/.test(fileName)
          ) {
            return closeWithError(
              `Jalur entri arsip mencurigakan atau mengandung path traversal: ${fileName}`
            );
          }

          // 2. Reject malicious & macro parts
          const lowerName = fileName.toLowerCase();
          if (
            lowerName.includes("vbaproject") ||
            lowerName.includes("vbasignature") ||
            lowerName.startsWith("xl/activex/") ||
            lowerName.startsWith("xl/embeddings/") ||
            lowerName.includes("oleobject") ||
            lowerName.startsWith("xl/externallinks/") ||
            lowerName === "xl/connections.xml" ||
            lowerName.startsWith("xl/querytables/")
          ) {
            return closeWithError(
              `File template mengandung elemen yang dilarang (Macro/VBA/ActiveX/External Links): ${fileName}`
            );
          }

          // 3. Size limit checks
          if (entry.uncompressedSize > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES) {
            return closeWithError(
              `Ukuran entri '${fileName}' (${entry.uncompressedSize} bytes) melebihi batas dekompresi (${MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES} bytes).`
            );
          }

          totalUncompressedBytes += entry.uncompressedSize;
          if (totalUncompressedBytes > MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES) {
            return closeWithError(
              `Total ukuran dekompresi arsip (${totalUncompressedBytes} bytes) melebihi batas sistem (${MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES} bytes).`
            );
          }

          // 4. Track core OpenXML structure
          if (fileName === "[Content_Types].xml") hasContentTypes = true;
          if (fileName === "_rels/.rels") hasRootRels = true;
          if (fileName === "xl/workbook.xml") hasWorkbookXml = true;
          if (fileName === "xl/_rels/workbook.xml.rels") hasWorkbookRels = true;
          if (/^xl\/worksheets\/sheet.*\.xml$/i.test(fileName)) hasWorksheets = true;

          // Check if we need to read XML text for inspection
          const isTargetXml =
            fileName === "[Content_Types].xml" ||
            fileName === "xl/workbook.xml" ||
            fileName === "xl/_rels/workbook.xml.rels" ||
            fileName === "xl/sharedStrings.xml" ||
            /^xl\/worksheets\/sheet.*\.xml$/i.test(fileName);

          if (isTargetXml) {
            zipfile.openReadStream(entry, (streamErr, readStream) => {
              if (streamErr || !readStream) {
                return closeWithError(
                  `Gagal membaca entri '${fileName}': ${streamErr?.message || "Stream error"}`
                );
              }

              const chunks: Buffer[] = [];
              let actualBytesRead = 0;

              readStream.on("data", (chunk: Buffer) => {
                actualBytesRead += chunk.length;
                if (actualBytesRead > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES) {
                  readStream.destroy();
                  return closeWithError(
                    `Ukuran aktual entri '${fileName}' melebihi batas keamanan (${MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES} bytes).`
                  );
                }
                chunks.push(chunk);
              });

              readStream.on("error", (err) => {
                closeWithError(
                  `Kesalahan saat mendekompresi '${fileName}': ${err.message}`
                );
              });

              readStream.on("end", () => {
                if (isClosed) return;
                const content = Buffer.concat(chunks).toString("utf-8");

                if (fileName === "[Content_Types].xml") {
                  contentTypesXml = content;
                } else if (fileName === "xl/workbook.xml") {
                  workbookXml = content;
                } else if (fileName === "xl/_rels/workbook.xml.rels") {
                  workbookRelsXml = content;
                } else if (fileName === "xl/sharedStrings.xml") {
                  sharedStringsXml = content;
                } else if (/^xl\/worksheets\/sheet.*\.xml$/i.test(fileName)) {
                  sheetXmlMap[fileName] = content;
                }

                zipfile.readEntry();
              });
            });
          } else {
            zipfile.readEntry();
          }
        });

        zipfile.on("end", () => {
          if (isClosed) return;

          // Structural OpenXML verification
          if (!hasContentTypes) {
            return resolve({
              valid: false,
              error: "Struktur file XLSX tidak valid: '[Content_Types].xml' tidak ditemukan.",
            });
          }
          if (!hasRootRels) {
            return resolve({
              valid: false,
              error: "Struktur file XLSX tidak valid: '_rels/.rels' tidak ditemukan.",
            });
          }
          if (!hasWorkbookXml) {
            return resolve({
              valid: false,
              error: "Struktur file XLSX tidak valid: 'xl/workbook.xml' tidak ditemukan.",
            });
          }
          if (!hasWorkbookRels) {
            return resolve({
              valid: false,
              error: "Struktur file XLSX tidak valid: 'xl/_rels/workbook.xml.rels' tidak ditemukan.",
            });
          }
          if (!hasWorksheets) {
            return resolve({
              valid: false,
              error: "Struktur file XLSX tidak valid: Tidak ada lembar kerja (worksheet) ditemukan.",
            });
          }

          // Check [Content_Types].xml for macro-enabled declarations
          if (
            contentTypesXml.includes("macroEnabled") ||
            contentTypesXml.includes("vnd.ms-excel.sheet.macroEnabled") ||
            contentTypesXml.includes("vnd.ms-excel.template.macroEnabled")
          ) {
            return resolve({
              valid: false,
              error: "File template Excel mengandung tipe konten Macro (.xlsm / .xltm). Hanya file standar .xlsx yang diizinkan.",
            });
          }

          // Check workbook rels for externalLink relationships
          if (
            workbookRelsXml.includes("relationships/externalLink") ||
            workbookRelsXml.includes("relationships/oleObject")
          ) {
            return resolve({
              valid: false,
              error: "File template Excel mengandung tautan eksternal (externalLink) atau OLE yang dilarang.",
            });
          }

          resolve({
            valid: true,
            sheetXmlMap,
            sharedStringsXml,
            workbookXml,
            workbookRelsXml,
          });
        });

        zipfile.readEntry();
      }
    );
  });
}
