import ExcelJS from "exceljs";
import { Document, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType } from "docx";
import {
  AcademicPlanItemData,
  WeeklyDistributionSlot,
} from "./academic.types";

interface ProsemExportData {
  schoolName: string;
  className: string;
  subjectName: string;
  academicYear: string;
  teacherName: string;
  curriculumName: string;
  semester: number;
  hoursPerWeek: number;
  effectiveWeeks: number;
  items: AcademicPlanItemData[];
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF94A3B8" } },
  left: { style: "thin", color: { argb: "FF94A3B8" } },
  bottom: { style: "thin", color: { argb: "FF94A3B8" } },
  right: { style: "thin", color: { argb: "FF94A3B8" } },
};

const DOUBLE_BOTTOM_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF94A3B8" } },
  left: { style: "thin", color: { argb: "FF94A3B8" } },
  bottom: { style: "double", color: { argb: "FF334155" } },
  right: { style: "thin", color: { argb: "FF94A3B8" } },
};

/**
 * Exports Program Semester (PROSEM) to a beautifully formatted XLSX binary buffer with full gridlines,
 * merged header tiers, colors, and signatures matching official Indonesian school standards.
 */
export async function exportProsemToXlsx(data: ProsemExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KLASSA (Naik Kelas Bersama)";
  workbook.lastModifiedBy = data.teacherName;
  workbook.created = new Date();
  workbook.modified = new Date();

  const semesterLabel = data.semester === 1 ? "GANJIL" : "GENAP";
  const worksheet = workbook.addWorksheet(`PROSEM SEM ${data.semester}`, {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const months =
    data.semester === 1
      ? [
          { number: 7, name: "JULI" },
          { number: 8, name: "AGUSTUS" },
          { number: 9, name: "SEPTEMBER" },
          { number: 10, name: "OKTOBER" },
          { number: 11, name: "NOVEMBER" },
          { number: 12, name: "DESEMBER" },
        ]
      : [
          { number: 1, name: "JANUARI" },
          { number: 2, name: "FEBRUARI" },
          { number: 3, name: "MARET" },
          { number: 4, name: "APRIL" },
          { number: 5, name: "MEI" },
          { number: 6, name: "JUNI" },
        ];

  const weeks = [1, 2, 3, 4, 5];

  // Column definitions
  const columns: Partial<ExcelJS.Column>[] = [
    { key: "no", width: 6 },
    { key: "title", width: 48 },
    { key: "jp", width: 14 },
  ];

  // 30 week columns (6 months * 5 weeks)
  for (let m = 0; m < months.length; m++) {
    for (let w = 1; w <= 5; w++) {
      columns.push({ key: `m${months[m].number}_w${w}`, width: 4.8 });
    }
  }
  worksheet.columns = columns;

  // Title Row (Row 1)
  const titleRow = worksheet.getRow(1);
  titleRow.getCell(1).value = `PROGRAM SEMESTER (PROSEM) — ${data.curriculumName.toUpperCase()}`;
  titleRow.getCell(1).font = { name: "Arial", size: 14, bold: true, color: { argb: "FF0F172A" } };
  worksheet.mergeCells("A1:AG1");
  titleRow.height = 24;

  // Metadata Rows (Rows 2 - 6)
  const meta = [
    ["SEKOLAH", data.schoolName.toUpperCase()],
    ["MATA PELAJARAN", data.subjectName],
    ["KELAS / TAHUN AJARAN", `${data.className} / ${data.academicYear}`],
    ["SEMESTER", `${semesterLabel} (${data.hoursPerWeek} JP/Minggu • ${data.effectiveWeeks} Pekan Efektif)`],
    ["GURU PENGAMPU", data.teacherName],
  ];

  meta.forEach((item, idx) => {
    const row = worksheet.getRow(2 + idx);
    row.getCell(1).value = item[0];
    row.getCell(1).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
    row.getCell(2).value = `: ${item[1]}`;
    row.getCell(2).font = { name: "Arial", size: 10, bold: false, color: { argb: "FF1E293B" } };
    row.height = 18;
  });

  // Table Headers (Rows 8 and 9)
  const row8 = worksheet.getRow(8);
  const row9 = worksheet.getRow(9);
  row8.height = 24;
  row9.height = 20;

  // Col A: NO (Merged A8:A9)
  row8.getCell(1).value = "NO";
  worksheet.mergeCells("A8:A9");

  // Col B: MATERI POKOK (Merged B8:B9)
  row8.getCell(2).value = "MATERI POKOK / CAPAIAN TUJUAN PEMBELAJARAN";
  worksheet.mergeCells("B8:B9");

  // Col C: ALOKASI JP (Merged C8:C9)
  row8.getCell(3).value = "ALOKASI (JP)";
  worksheet.mergeCells("C8:C9");

  // Format fixed header cells A8:C9
  ["A8", "B8", "C8", "A9", "B9", "C9"].forEach((cellRef) => {
    const cell = worksheet.getCell(cellRef);
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF1E293B" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.border = THIN_BORDER;
  });

  // Month & Week headers
  let colIdx = 4;
  months.forEach((month) => {
    const startCol = colIdx;
    const endCol = colIdx + 4;

    row8.getCell(startCol).value = month.name;
    worksheet.mergeCells(8, startCol, 8, endCol);

    for (let c = startCol; c <= endCol; c++) {
      const cell8 = row8.getCell(c);
      cell8.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
      cell8.alignment = { vertical: "middle", horizontal: "center" };
      cell8.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCBD5E1" } };
      cell8.border = THIN_BORDER;

      const weekNum = c - startCol + 1;
      const cell9 = row9.getCell(c);
      cell9.value = weekNum;
      cell9.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF334155" } };
      cell9.alignment = { vertical: "middle", horizontal: "center" };
      cell9.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      cell9.border = THIN_BORDER;
    }

    colIdx += 5;
  });

  // Data Rows (Starting at Row 10)
  let currentRowNum = 10;
  let totalJp = 0;

  data.items.forEach((item, index) => {
    const row = worksheet.getRow(currentRowNum);
    row.height = 22;
    totalJp += item.allocatedHours || 0;

    // Col A: NO
    const cellA = row.getCell(1);
    cellA.value = index + 1;
    cellA.font = { name: "Arial", size: 10 };
    cellA.alignment = { vertical: "middle", horizontal: "center" };
    cellA.border = THIN_BORDER;

    // Col B: Title
    const cellB = row.getCell(2);
    cellB.value = item.title;
    cellB.font = { name: "Arial", size: 10, bold: item.category === "STS" || item.category === "SAS" };
    cellB.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cellB.border = THIN_BORDER;

    // Col C: Alokasi JP
    const cellC = row.getCell(3);
    cellC.value = item.allocatedHours || 0;
    cellC.font = { name: "Arial", size: 10, bold: true };
    cellC.alignment = { vertical: "middle", horizontal: "center" };
    cellC.border = THIN_BORDER;

    // Weekly slots
    const dist = (item.weeklyDistribution as unknown as WeeklyDistributionSlot[]) || [];
    let curCol = 4;

    months.forEach((month) => {
      weeks.forEach((week) => {
        const cell = row.getCell(curCol);
        const slot = dist.find((s) => s.month === month.number && s.week === week);
        cell.border = THIN_BORDER;

        if (slot) {
          cell.value = slot.hours || data.hoursPerWeek;
          cell.font = { name: "Arial", size: 10, bold: true };
          cell.alignment = { vertical: "middle", horizontal: "center" };

          if (item.category === "STS") {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF08A" } };
            cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF854D0E" } };
          } else if (item.category === "SAS") {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBFDBFE" } };
            cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF1E40AF" } };
          } else if (item.category === "RESERVE") {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
          } else {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
            cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF166534" } };
          }
        } else {
          cell.value = "";
          cell.alignment = { vertical: "middle", horizontal: "center" };
        }

        curCol++;
      });
    });

    currentRowNum++;
  });

  // Total Summary Row
  const totalRow = worksheet.getRow(currentRowNum);
  totalRow.height = 24;

  totalRow.getCell(1).value = "";
  totalRow.getCell(2).value = "TOTAL ALOKASI WAKTU SEMESTER";
  totalRow.getCell(2).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
  totalRow.getCell(2).alignment = { vertical: "middle", horizontal: "right" };

  totalRow.getCell(3).value = totalJp;
  totalRow.getCell(3).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
  totalRow.getCell(3).alignment = { vertical: "middle", horizontal: "center" };

  for (let c = 1; c <= 33; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.border = DOUBLE_BOTTOM_BORDER;
    if (c > 3 && !cell.value) {
      cell.value = "";
    }
  }

  // Signatures Section (3 rows below total)
  const sigRow1 = currentRowNum + 3;
  const sigRow2 = sigRow1 + 1;
  const sigRow3 = sigRow1 + 5;
  const sigRow4 = sigRow1 + 6;

  worksheet.getCell(`B${sigRow1}`).value = "Mengetahui,";
  worksheet.getCell(`B${sigRow1}`).font = { name: "Arial", size: 10 };
  worksheet.getCell(`B${sigRow2}`).value = "Kepala Sekolah,";
  worksheet.getCell(`B${sigRow2}`).font = { name: "Arial", size: 10, bold: true };
  worksheet.getCell(`B${sigRow3}`).value = "( ............................................................ )";
  worksheet.getCell(`B${sigRow3}`).font = { name: "Arial", size: 10, bold: true };
  worksheet.getCell(`B${sigRow4}`).value = "NIP. ........................................................";
  worksheet.getCell(`B${sigRow4}`).font = { name: "Arial", size: 10 };

  worksheet.getCell(`W${sigRow1}`).value = `Ditetapkan di: ...................., Tanggal: ................`;
  worksheet.getCell(`W${sigRow1}`).font = { name: "Arial", size: 10 };
  worksheet.getCell(`W${sigRow2}`).value = "Guru Mata Pelajaran,";
  worksheet.getCell(`W${sigRow2}`).font = { name: "Arial", size: 10, bold: true };
  worksheet.getCell(`W${sigRow3}`).value = `( ${data.teacherName} )`;
  worksheet.getCell(`W${sigRow3}`).font = { name: "Arial", size: 10, bold: true };
  worksheet.getCell(`W${sigRow4}`).value = "NIP. ........................................................";
  worksheet.getCell(`W${sigRow4}`).font = { name: "Arial", size: 10 };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Exports Program Tahunan (PROTA) to a formatted DOCX binary buffer.
 */
export async function exportProtaToDocx(data: ProsemExportData): Promise<Buffer> {
  const tableRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: "NO", bold: true })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: "MATERI POKOK / CAPAIAN PEMBELAJARAN", bold: true })] })],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: "ALOKASI WAKTU (JP)", bold: true })], alignment: AlignmentType.CENTER })],
        }),
      ],
    }),
  ];

  let totalJp = 0;
  data.items.forEach((item, index) => {
    totalJp += item.allocatedHours || 0;
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: String(index + 1), alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            children: [new Paragraph({ text: item.title })],
          }),
          new TableCell({
            children: [new Paragraph({ text: `${item.allocatedHours || 0} JP`, alignment: AlignmentType.CENTER })],
          }),
        ],
      })
    );
  });

  // Total row
  tableRows.push(
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ text: "" })],
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "JUMLAH TOTAL ALOKASI WAKTU", bold: true })] })],
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: `${totalJp} JP`, bold: true })], alignment: AlignmentType.CENTER })],
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "PROGRAM TAHUNAN (PROTA)",
                bold: true,
                size: 28,
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${data.schoolName.toUpperCase()} - TAHUN AJARAN ${data.academicYear}`,
                bold: true,
                size: 22,
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: `Mata Pelajaran : ${data.subjectName}` }),
          new Paragraph({ text: `Kelas / Fase   : ${data.className}` }),
          new Paragraph({ text: `Guru Pengampu  : ${data.teacherName}` }),
          new Paragraph({ text: "" }),
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: "Mengetahui,\t\t\t\t\t\tGuru Mata Pelajaran," })],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Kepala Sekolah,\t\t\t\t\t\t" })],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: `( ......................................... )\t\t\t( ${data.teacherName} )` })],
          }),
        ],
      },
    ],
  });

  const { Packer } = await import("docx");
  const buffer = await Packer.toBuffer(doc);
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}
