import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportPdfOptions {
  title: string;
  content: string;
  schoolName?: string;
  subjectName?: string;
  teacherName?: string;
  dateStr?: string;
}

/**
 * Generates and downloads a clean, printable PDF document
 */
export async function exportToPdf(options: ExportPdfOptions): Promise<void> {
  const { title, content, schoolName, subjectName, teacherName, dateStr } = options;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = 20;

  // Header / Kop
  if (schoolName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text(schoolName.toUpperCase(), pageWidth / 2, cursorY, { align: "center" });
    cursorY += 6;
  }

  if (subjectName || teacherName) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    const metaParts = [];
    if (subjectName) metaParts.push(`Mata Pelajaran: ${subjectName}`);
    if (teacherName) metaParts.push(`Guru: ${teacherName}`);
    if (dateStr) metaParts.push(`Tanggal: ${dateStr}`);
    doc.text(metaParts.join(" | "), pageWidth / 2, cursorY, { align: "center" });
    cursorY += 6;
  }

  // Divider line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 8;

  // Document Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 138); // Navy
  doc.text(title, pageWidth / 2, cursorY, { align: "center" });
  cursorY += 10;

  // Parse lines
  const lines = content.split("\n");
  let tableRows: string[][] = [];
  let inTable = false;

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const [headers, ...data] = tableRows;

    // Clean headers and cell data from markdown symbols & replace <br> with newline
    const cleanHeaders = headers.map((h) => cleanMarkdownString(h));
    const cleanData = data.map((row) =>
      row.map((cell) => cleanMarkdownString(cell))
    );

    autoTable(doc, {
      startY: cursorY,
      head: [cleanHeaders],
      body: cleanData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2.5 },
    });
    // @ts-expect-error - jspdf-autotable adds lastAutoTable to doc
    cursorY = (doc.lastAutoTable?.finalY || cursorY) + 6;
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

    // Check page overflow
    if (cursorY > pageHeight - 20) {
      doc.addPage();
      cursorY = 20;
    }

    if (!trimmed || trimmed === "---" || trimmed === "***") {
      cursorY += 4;
      continue;
    }

    // Heading 1
    if (trimmed.startsWith("# ")) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      cursorY += 4;
      doc.text(cleanHeadingText(trimmed), margin, cursorY);
      cursorY += 6;
      continue;
    }

    // Heading 2
    if (trimmed.startsWith("## ")) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(51, 65, 85);
      cursorY += 3;
      doc.text(cleanHeadingText(trimmed), margin, cursorY);
      cursorY += 5;
      continue;
    }

    // Heading 3
    if (trimmed.startsWith("### ")) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(51, 65, 85);
      cursorY += 3;
      doc.text(cleanHeadingText(trimmed), margin, cursorY);
      cursorY += 5;
      continue;
    }

    // Heading 4, 5, 6
    if (/^#{4,}\s+/.test(trimmed)) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      cursorY += 2;
      doc.text(cleanHeadingText(trimmed), margin, cursorY);
      cursorY += 4;
      continue;
    }

    // Bullet / List
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);

      const bulletText = `•  ${cleanMarkdownString(trimmed.slice(2))}`;
      const splitLines = doc.splitTextToSize(bulletText, contentWidth - 4);
      for (const textLine of splitLines) {
        if (cursorY > pageHeight - 20) {
          doc.addPage();
          cursorY = 20;
        }
        doc.text(textLine, margin + 4, cursorY);
        cursorY += 5;
      }
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);

      const numText = `${numMatch[1]}. ${cleanMarkdownString(numMatch[2])}`;
      const splitLines = doc.splitTextToSize(numText, contentWidth - 4);
      for (const textLine of splitLines) {
        if (cursorY > pageHeight - 20) {
          doc.addPage();
          cursorY = 20;
        }
        doc.text(textLine, margin + 4, cursorY);
        cursorY += 5;
      }
      continue;
    }

    // Normal Text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);

    const cleanText = cleanMarkdownString(trimmed);
    const splitLines = doc.splitTextToSize(cleanText, contentWidth);

    for (const textLine of splitLines) {
      if (cursorY > pageHeight - 20) {
        doc.addPage();
        cursorY = 20;
      }
      doc.text(textLine, margin, cursorY);
      cursorY += 5;
    }
  }

  if (inTable) {
    flushTable();
  }

  // Add Page Numbers in Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Halaman ${i} dari ${totalPages} • AI Teacher Assistant`,
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
    .replace(/(\*\*\*|___)(.*?)\1/g, "$2")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s*/, "")
    .trim();
}
