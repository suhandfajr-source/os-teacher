import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportPdfOptions {
  title: string;
  content: string;
  schoolName?: string;
  subjectName?: string;
  teacherName?: string;
  className?: string;
  dateStr?: string;
}

/**
 * Generates and downloads a clean, elegant, printable PDF document
 */
export async function exportToPdf(options: ExportPdfOptions): Promise<void> {
  const { title, content, schoolName, subjectName, teacherName, className, dateStr } = options;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = 18;

  // Header / Kop Sekolah
  const displaySchool = schoolName || "KLASSA";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text(displaySchool.toUpperCase(), pageWidth / 2, cursorY, { align: "center" });
  cursorY += 5;

  const metaParts: string[] = [];
  if (subjectName) metaParts.push(`Mata Pelajaran: ${subjectName}`);
  if (className) metaParts.push(`Kelas: ${className}`);
  if (teacherName) metaParts.push(`Guru: ${teacherName}`);
  if (dateStr) metaParts.push(`Tanggal: ${dateStr}`);

  if (metaParts.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(metaParts.join("  |  "), pageWidth / 2, cursorY, { align: "center" });
    cursorY += 5;
  }

  // Header separator line
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.4);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 7;

  // Document Title (Clean & centered)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 138); // Deep Navy
  const cleanTitle = cleanHeadingText(title);
  const titleLines = doc.splitTextToSize(cleanTitle, contentWidth);
  for (const tLine of titleLines) {
    doc.text(tLine, pageWidth / 2, cursorY, { align: "center" });
    cursorY += 6;
  }
  cursorY += 4;

  // Parse lines of markdown
  const lines = content.split("\n");
  let tableRows: string[][] = [];
  let inTable = false;

  const flushTable = () => {
    if (tableRows.length === 0) return;

    // Filter out separator lines (e.g. |---|---|)
    const validRows = tableRows.filter((r) => {
      const combined = r.join("").replace(/[|\-\s:]/g, "");
      return combined.length > 0;
    });

    if (validRows.length === 0) {
      tableRows = [];
      inTable = false;
      return;
    }

    // Determine maximum columns across all rows
    const maxCols = Math.max(...validRows.map((r) => r.length), 1);

    // Normalize and clean each cell
    const normalizedRows = validRows.map((row) => {
      const padded = [...row];
      while (padded.length < maxCols) {
        padded.push("");
      }
      return padded.map((cell) => cleanMarkdownString(cell));
    });

    const headers = normalizedRows[0];
    const bodyData = normalizedRows.slice(1);

    if (cursorY > pageHeight - 35) {
      doc.addPage();
      cursorY = 20;
    }

    autoTable(doc, {
      startY: cursorY,
      head: [headers],
      body: bodyData.length > 0 ? bodyData : [new Array(maxCols).fill("")],
      theme: "grid",
      headStyles: {
        fillColor: [30, 41, 59], // Elegant Dark Slate
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "center",
        valign: "middle",
        cellPadding: 3,
      },
      bodyStyles: {
        textColor: [51, 65, 85],
        fontSize: 8,
        cellPadding: 2.8,
        valign: "middle",
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: margin, right: margin },
      styles: {
        font: "helvetica",
        overflow: "linebreak",
        cellWidth: "auto",
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
      },
    });

    // @ts-expect-error - jspdf-autotable adds lastAutoTable to doc
    cursorY = (doc.lastAutoTable?.finalY || cursorY) + 6;
    tableRows = [];
    inTable = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Table detection (starts with | and ends with |)
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

    // Page overflow safety
    if (cursorY > pageHeight - 20) {
      doc.addPage();
      cursorY = 20;
    }

    // Empty lines / dividers
    if (!trimmed || trimmed === "---" || trimmed === "***") {
      cursorY += 3;
      continue;
    }

    // Heading 1 (# Bagian Utama)
    if (trimmed.startsWith("# ")) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      cursorY += 4;
      doc.text(cleanHeadingText(trimmed), margin, cursorY);
      cursorY += 6;
      continue;
    }

    // Heading 2 (## Sub Bagian)
    if (trimmed.startsWith("## ")) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      cursorY += 3;
      doc.text(cleanHeadingText(trimmed), margin, cursorY);
      cursorY += 5.5;
      continue;
    }

    // Heading 3 (### Sub Seksi)
    if (trimmed.startsWith("### ")) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      cursorY += 2.5;
      doc.text(cleanHeadingText(trimmed), margin, cursorY);
      cursorY += 5;
      continue;
    }

    // Heading 4+
    if (/^#{4,}\s+/.test(trimmed)) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      cursorY += 2;
      doc.text(cleanHeadingText(trimmed), margin, cursorY);
      cursorY += 4.5;
      continue;
    }

    // Multiple Choice Options (A. B. C. D. E. or a. b. c. d. e.)
    const mcqMatch = trimmed.match(/^([A-Ea-e])\.\s+(.+)$/);
    if (mcqMatch) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const optText = `${mcqMatch[1].toUpperCase()}.  ${cleanMarkdownString(mcqMatch[2])}`;
      const splitLines = doc.splitTextToSize(optText, contentWidth - 6);
      for (const textLine of splitLines) {
        if (cursorY > pageHeight - 20) {
          doc.addPage();
          cursorY = 20;
        }
        doc.text(textLine, margin + 5, cursorY);
        cursorY += 4.5;
      }
      cursorY += 0.8;
      continue;
    }

    // Bullet Points (- or *)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const bulletText = `•  ${cleanMarkdownString(trimmed.slice(2))}`;
      const splitLines = doc.splitTextToSize(bulletText, contentWidth - 5);
      for (const textLine of splitLines) {
        if (cursorY > pageHeight - 20) {
          doc.addPage();
          cursorY = 20;
        }
        doc.text(textLine, margin + 4, cursorY);
        cursorY += 4.5;
      }
      cursorY += 1;
      continue;
    }

    // Numbered Questions / Items (1. 2. 20.)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      cursorY += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);

      const numPrefix = `${numMatch[1]}. `;
      const textBody = cleanMarkdownString(numMatch[2]);
      const fullText = `${numPrefix}${textBody}`;
      const splitLines = doc.splitTextToSize(fullText, contentWidth);

      for (let sIdx = 0; sIdx < splitLines.length; sIdx++) {
        if (cursorY > pageHeight - 20) {
          doc.addPage();
          cursorY = 20;
        }
        // First line bold number emphasis, subsequent lines normal
        doc.setFont("helvetica", sIdx === 0 ? "bold" : "normal");
        doc.text(splitLines[sIdx], margin, cursorY);
        cursorY += 4.5;
      }
      cursorY += 1.5;
      continue;
    }

    // Blockquote or reading stimulus (> text)
    if (trimmed.startsWith(">")) {
      const cleanQuote = cleanMarkdownString(trimmed.replace(/^>+\s*/, "").trim());
      if (!cleanQuote) {
        cursorY += 2;
        continue;
      }
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const splitLines = doc.splitTextToSize(cleanQuote, contentWidth - 8);
      for (const textLine of splitLines) {
        if (cursorY > pageHeight - 20) {
          doc.addPage();
          cursorY = 20;
        }
        doc.text(textLine, margin + 4, cursorY);
        cursorY += 4.2;
      }
      cursorY += 1.5;
      continue;
    }

    // Normal Paragraph
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);

    const cleanText = cleanMarkdownString(trimmed);
    const splitLines = doc.splitTextToSize(cleanText, contentWidth);

    for (const textLine of splitLines) {
      if (cursorY > pageHeight - 20) {
        doc.addPage();
        cursorY = 20;
      }
      doc.text(textLine, margin, cursorY);
      cursorY += 4.6;
    }
    cursorY += 1;
  }

  if (inTable) {
    flushTable();
  }

  // Page Numbers & Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(
      `Halaman ${i} dari ${totalPages}  •  KLASSA (Naik Kelas Bersama)`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
  }

  const safeFilename = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  doc.save(safeFilename);
}

function cleanHeadingText(text: string): string {
  return text.replace(/^#+\s*/, "").replace(/[*_#`~]+/g, "").trim();
}

function cleanMarkdownString(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/^>+\s*/, "")
    .replace(/(\*\*\*|___)(.*?)\1/g, "$2")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s*/, "")
    .trim();
}
