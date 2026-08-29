import * as XLSX from "xlsx";

export interface ExportExcelOptions {
  title: string;
  content: string;
  schoolName?: string;
  subjectName?: string;
  teacherName?: string;
}

/**
 * Parses markdown tables or key-value sections into structured Excel (.xlsx) sheets
 */
export async function exportToExcel(options: ExportExcelOptions): Promise<void> {
  const { title, content, schoolName, subjectName, teacherName } = options;

  const lines = content.split("\n");
  const tableRows: string[][] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (trimmed.replace(/[|\-\s:]/g, "").length === 0) continue;
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      tableRows.push(cells);
    }
  }

  const wb = XLSX.utils.book_new();

  // If table rows were found
  if (tableRows.length > 0) {
    const wsData: (string | number)[][] = [
      [title.toUpperCase()],
      [schoolName || "", subjectName ? `Mapel: ${subjectName}` : "", teacherName ? `Guru: ${teacherName}` : ""],
      [], // blank line
      ...tableRows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-fit column widths
    const colWidths = tableRows[0].map((_, colIdx) => {
      let maxLen = 12;
      tableRows.forEach((row) => {
        if (row[colIdx]) {
          maxLen = Math.max(maxLen, row[colIdx].length);
        }
      });
      return { wch: Math.min(maxLen + 4, 50) };
    });

    ws["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, "Data Output");
  } else {
    // If text only, structure line by line into clean worksheet
    const wsData: (string | number)[][] = [
      [title.toUpperCase()],
      [schoolName || "", subjectName ? `Mapel: ${subjectName}` : ""],
      [],
      ["No", "Konten / Poin Materi"],
    ];

    let rowNum = 1;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      wsData.push([rowNum++, trimmed.replace(/^[-*•#]+\s*/, "")]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 6 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, ws, "Ringkasan");
  }

  const safeFilename = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`;
  XLSX.writeFile(wb, safeFilename);
}
