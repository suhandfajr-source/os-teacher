import { exportToWord } from "./word-exporter";
import { exportToPowerPoint } from "./ppt-exporter";
import { exportToPdf } from "./pdf-exporter";
import { exportToExcel } from "./excel-exporter";

export type ExportFormat = "docx" | "pdf" | "pptx" | "xlsx";

export interface UnifiedExportOptions {
  format: ExportFormat;
  title: string;
  content: string;
  schoolName?: string;
  subjectName?: string;
  teacherName?: string;
  dateStr?: string;
}

/**
 * Single unified helper to trigger instant download in Word, PDF, PPT, or Excel
 */
export async function exportAiDocument(options: UnifiedExportOptions): Promise<void> {
  const { format, title, content, schoolName, subjectName, teacherName, dateStr } = options;

  switch (format) {
    case "docx": {
      const blob = await exportToWord({
        title,
        content,
        schoolName,
        subjectName,
        teacherName,
        dateStr,
      });
      triggerBlobDownload(blob, `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.docx`);
      break;
    }
    case "pptx": {
      await exportToPowerPoint({
        title,
        content,
        schoolName,
        subjectName,
        teacherName,
      });
      break;
    }
    case "pdf": {
      await exportToPdf({
        title,
        content,
        schoolName,
        subjectName,
        teacherName,
        dateStr,
      });
      break;
    }
    case "xlsx": {
      await exportToExcel({
        title,
        content,
        schoolName,
        subjectName,
        teacherName,
      });
      break;
    }
    default:
      throw new Error(`Format ekspor tidak didukung: ${format}`);
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { exportToWord, exportToPowerPoint, exportToPdf, exportToExcel };
export type { ExportDocumentOptions } from "./word-exporter";
export type { ExportPptOptions } from "./ppt-exporter";
export type { ExportPdfOptions } from "./pdf-exporter";
export type { ExportExcelOptions } from "./excel-exporter";
