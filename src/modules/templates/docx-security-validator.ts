import yauzl from "yauzl";
import {
  MAX_TEMPLATE_FILE_BYTES,
  MAX_ZIP_ENTRIES,
  MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES,
  MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES,
  SecurityPreflightResult,
} from "./template.types";

/**
 * Validates hostile ZIP / OpenXML package constraints lazily using yauzl.
 * Returns valid status and extracted XML parts.
 */
export async function validateDocxSecurityPreflight(
  buffer: Buffer
): Promise<SecurityPreflightResult> {
  // 1. File Size Verification
  if (buffer.length > MAX_TEMPLATE_FILE_BYTES) {
    return {
      valid: false,
      error: `Ukuran file (${buffer.length} byte) melebihi batas maksimum (${MAX_TEMPLATE_FILE_BYTES} byte / 2 MB).`,
    };
  }

  if (buffer.length < 100) {
    return {
      valid: false,
      error: "File terlalu kecil atau bukan merupakan dokumen Word yang valid.",
    };
  }

  // 2. PK Magic Bytes Verification (0x50, 0x4B, 0x03, 0x04)
  if (
    buffer[0] !== 0x50 ||
    buffer[1] !== 0x4b ||
    buffer[2] !== 0x03 ||
    buffer[3] !== 0x04
  ) {
    return {
      valid: false,
      error: "Format file tidak valid. File harus berupa dokumen Microsoft Word (.docx).",
    };
  }

  // 3. Lazy ZIP Inspection via yauzl
  return new Promise<SecurityPreflightResult>((resolve) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true },
      (err, zipfile) => {
        if (err || !zipfile) {
          return resolve({
            valid: false,
            error: "Arsip dokumen rusak atau tidak dapat dibaca.",
          });
        }

        let entryCount = 0;
        let totalUncompressedBytes = 0;
        let hasContentTypes = false;
        let hasDocumentXml = false;
        let hasHeaders = false;
        let hasFooters = false;
        let hasTables = false;

        let documentXml = "";
        const headerXmls: string[] = [];
        const footerXmls: string[] = [];

        zipfile.on("error", (zipErr) => {
          return resolve({
            valid: false,
            error: `Gagal membaca isi arsip: ${zipErr.message}`,
          });
        });

        zipfile.on("entry", (entry: yauzl.Entry) => {
          entryCount++;

          // 3a. Entry count limit
          if (entryCount > MAX_ZIP_ENTRIES) {
            zipfile.close();
            return resolve({
              valid: false,
              error: `Jumlah entri dalam arsip (${entryCount}) melebihi batas sistem (${MAX_ZIP_ENTRIES}).`,
            });
          }

          const fileName = entry.fileName;

          // 3b. Path traversal & illegal path check
          if (
            fileName.startsWith("/") ||
            fileName.startsWith("\\") ||
            fileName.includes("..") ||
            /[\x00-\x1f\x7f]/.test(fileName)
          ) {
            zipfile.close();
            return resolve({
              valid: false,
              error: "Arsip mengandung struktur path yang tidak aman.",
            });
          }

          const lowerName = fileName.toLowerCase();

          // 3c. Reject hostile / executable / macro / activeX / embedding files
          if (
            lowerName.includes("vbaproject.bin") ||
            lowerName.includes("vbadata.xml") ||
            lowerName.includes("word/activex/") ||
            lowerName.includes("word/embeddings/") ||
            lowerName.endsWith(".exe") ||
            lowerName.endsWith(".dll") ||
            lowerName.endsWith(".bat") ||
            lowerName.endsWith(".cmd") ||
            lowerName.endsWith(".vbs") ||
            lowerName.endsWith(".js")
          ) {
            zipfile.close();
            return resolve({
              valid: false,
              error: "File dokumen ditolak karena mengandung makro, skrip, atau objek aktif yang dilarang.",
            });
          }

          // 3d. Declared size limits
          if (entry.uncompressedSize > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES) {
            zipfile.close();
            return resolve({
              valid: false,
              error: `Ukuran entri '${fileName}' (${entry.uncompressedSize} byte) melebihi batas per-entri (5 MB).`,
            });
          }

          totalUncompressedBytes += entry.uncompressedSize;
          if (totalUncompressedBytes > MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES) {
            zipfile.close();
            return resolve({
              valid: false,
              error: `Total ukuran dekompresi (${totalUncompressedBytes} byte) melebihi batas maksimum (10 MB).`,
            });
          }

          // Check known parts
          if (fileName === "[Content_Types].xml") {
            hasContentTypes = true;
          }
          if (fileName === "word/document.xml") {
            hasDocumentXml = true;
          }
          if (fileName.startsWith("word/header") && fileName.endsWith(".xml")) {
            hasHeaders = true;
          }
          if (fileName.startsWith("word/footer") && fileName.endsWith(".xml")) {
            hasFooters = true;
          }

          // Read relevant XML content safely with actual byte tracking
          const isTargetXml =
            fileName === "word/document.xml" ||
            (fileName.startsWith("word/header") && fileName.endsWith(".xml")) ||
            (fileName.startsWith("word/footer") && fileName.endsWith(".xml")) ||
            fileName === "[Content_Types].xml";

          if (isTargetXml) {
            zipfile.openReadStream(entry, (streamErr, readStream) => {
              if (streamErr || !readStream) {
                zipfile.close();
                return resolve({
                  valid: false,
                  error: `Gagal membaca entri '${fileName}'.`,
                });
              }

              const chunks: Buffer[] = [];
              let actualBytesRead = 0;

              readStream.on("data", (chunk: Buffer) => {
                actualBytesRead += chunk.length;
                if (actualBytesRead > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES) {
                  readStream.destroy();
                  zipfile.close();
                  return resolve({
                    valid: false,
                    error: `Ukuran dekompresi riil entri '${fileName}' melebihi batas keamanan.`,
                  });
                }
                chunks.push(chunk);
              });

              readStream.on("error", (readErr) => {
                zipfile.close();
                return resolve({
                  valid: false,
                  error: `Error saat membaca stream '${fileName}': ${readErr.message}`,
                });
              });

              readStream.on("end", () => {
                const content = Buffer.concat(chunks).toString("utf-8");

                // Validate [Content_Types].xml for macro content types
                if (fileName === "[Content_Types].xml") {
                  if (
                    content.includes("application/vnd.ms-word.document.macroEnabled.main+xml") ||
                    content.includes("application/vnd.ms-word.template.macroEnabledTemplate.main+xml")
                  ) {
                    zipfile.close();
                    return resolve({
                      valid: false,
                      error: "Dokumen bertipe Macro-Enabled (.docm/.dotm) tidak diizinkan.",
                    });
                  }
                }

                if (fileName === "word/document.xml") {
                  documentXml = content;
                  if (content.includes("<w:tbl")) {
                    hasTables = true;
                  }
                } else if (fileName.startsWith("word/header")) {
                  headerXmls.push(content);
                } else if (fileName.startsWith("word/footer")) {
                  footerXmls.push(content);
                }

                zipfile.readEntry();
              });
            });
          } else {
            zipfile.readEntry();
          }
        });

        zipfile.on("end", () => {
          if (!hasContentTypes || !hasDocumentXml) {
            return resolve({
              valid: false,
              error: "Struktur dokumen Word (.docx) tidak lengkap (hilang [Content_Types].xml atau word/document.xml).",
            });
          }

          return resolve({
            valid: true,
            hasHeaders,
            hasFooters,
            hasTables,
            xmlContents: {
              documentXml,
              headerXmls,
              footerXmls,
            },
          });
        });

        // Start reading entries lazily
        zipfile.readEntry();
      }
    );
  });
}
