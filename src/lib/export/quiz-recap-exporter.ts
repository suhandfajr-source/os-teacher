import ExcelJS from "exceljs";

export interface QuizRecapStudentRow {
  studentId: string;
  fullName: string;
  pin?: string | null;
  attemptStatus: string;
  score: number | null;
  isRemedial: boolean;
  startedAt?: string;
  submittedAt?: string;
}

export interface QuizRecapExportOptions {
  quizTitle: string;
  contextLabel: string;
  standardScore?: number | null;
  durationMinutes?: number | null;
  questionCount: number;
  roster: QuizRecapStudentRow[];
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCBD5E1" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

const HEADER_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF94A3B8" } },
  left: { style: "thin", color: { argb: "FF94A3B8" } },
  bottom: { style: "medium", color: { argb: "FF64748B" } },
  right: { style: "thin", color: { argb: "FF94A3B8" } },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF1F5F9" }, // slate-100
};

/**
 * Generates and downloads a clean, professional Excel (.xlsx) spreadsheet
 * containing full student quiz results, class statistics, and KKM status.
 */
export async function exportQuizRecapToExcel(options: QuizRecapExportOptions): Promise<void> {
  const {
    quizTitle,
    contextLabel,
    standardScore,
    durationMinutes,
    questionCount,
    roster,
  } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KLASSA";

  const worksheet = workbook.addWorksheet("Rekap Nilai Kuis", {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: "portrait",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  // Summary statistics
  const totalStudents = roster.length;
  const submittedStudents = roster.filter((r) => r.attemptStatus === "SUBMITTED");
  const submittedCount = submittedStudents.length;
  const passedStudents = submittedStudents.filter(
    (r) => standardScore != null && (r.score ?? 0) >= standardScore
  );
  const remedialStudents = submittedStudents.filter(
    (r) => standardScore != null && (r.score ?? 0) < standardScore
  );
  const averageScore =
    submittedCount > 0
      ? Math.round(
          (submittedStudents.reduce((sum, r) => sum + (r.score ?? 0), 0) /
            submittedCount) *
            10
        ) / 10
      : 0;

  // Title
  const titleRow = worksheet.getRow(1);
  titleRow.getCell(1).value = "REKAP NILAI KUIS ONLINE — KLASSA";
  titleRow.getCell(1).font = { name: "Arial", size: 13, bold: true, color: { argb: "FF0F172A" } };
  titleRow.height = 24;

  // Metadata block
  const meta: [string, string | number][] = [
    ["Judul Kuis", quizTitle],
    ["Kelas & Mapel", contextLabel],
    ["Jumlah Soal", `${questionCount} Soal Pilihan Ganda`],
    ["KKM / Standar Nilai", standardScore != null ? standardScore : "Tidak diatur"],
    ["Durasi Pengerjaan", durationMinutes ? `${durationMinutes} Menit` : "Bebas"],
    ["Tanggal Unduh", new Date().toLocaleDateString("id-ID", { dateStyle: "full" })],
  ];

  meta.forEach((m, idx) => {
    const row = worksheet.getRow(3 + idx);
    row.getCell(1).value = m[0];
    row.getCell(1).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF64748B" } };
    row.getCell(2).value = `: ${m[1]}`;
    row.getCell(2).font = { name: "Arial", size: 9, bold: false, color: { argb: "FF0F172A" } };
    row.height = 18;
  });

  // Summary Card Box
  const summaryHeaderRow = worksheet.getRow(10);
  summaryHeaderRow.getCell(1).value = "RINGKASAN HASIL KELAS";
  summaryHeaderRow.getCell(1).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF1E293B" } };

  const summaryItems: [string, string | number][] = [
    ["Total Siswa", totalStudents],
    ["Sudah Mengerjakan", submittedCount],
    ["Belum Selesai", totalStudents - submittedCount],
    ["Tuntas (≥ KKM)", standardScore != null ? passedStudents.length : "-"],
    ["Remedial (< KKM)", standardScore != null ? remedialStudents.length : "-"],
    ["Rata-Rata Kelas", submittedCount > 0 ? averageScore : "-"],
  ];

  summaryItems.forEach((item, idx) => {
    const row = worksheet.getRow(11 + idx);
    row.getCell(1).value = item[0];
    row.getCell(1).font = { name: "Arial", size: 9, bold: false, color: { argb: "FF475569" } };
    row.getCell(2).value = item[1];
    row.getCell(2).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF0F172A" } };
    row.getCell(1).border = THIN_BORDER;
    row.getCell(2).border = THIN_BORDER;
    row.height = 18;
  });

  // Main Table Header (Row 18)
  const headerRowIdx = 18;
  const headers = [
    "No",
    "Nama Siswa",
    "Status Pengerjaan",
    "Nilai Akhir (0-100)",
    "Keterangan KKM",
    "Waktu Selesai",
    "Catatan",
  ];

  const tableHeaderRow = worksheet.getRow(headerRowIdx);
  headers.forEach((title, idx) => {
    const cell = tableHeaderRow.getCell(idx + 1);
    cell.value = title;
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF1E293B" } };
    cell.fill = HEADER_FILL;
    cell.border = HEADER_BORDER;
    cell.alignment = {
      vertical: "middle",
      horizontal: idx === 1 ? "left" : "center",
      wrapText: true,
    };
  });
  tableHeaderRow.height = 28;

  // Set widths
  worksheet.getColumn(1).width = 6;  // No
  worksheet.getColumn(2).width = 32; // Nama Siswa
  worksheet.getColumn(3).width = 20; // Status Pengerjaan
  worksheet.getColumn(4).width = 18; // Nilai
  worksheet.getColumn(5).width = 16; // KKM
  worksheet.getColumn(6).width = 22; // Waktu
  worksheet.getColumn(7).width = 16; // Catatan

  let currentRowIdx = headerRowIdx + 1;
  roster.forEach((student, index) => {
    let statusText = "Belum Mengerjakan";
    if (student.attemptStatus === "SUBMITTED") statusText = "Selesai";
    else if (student.attemptStatus === "IN_PROGRESS") statusText = "Sedang Mengerjakan";

    let kkmText = "-";
    if (student.score !== null && standardScore != null) {
      kkmText = student.score >= standardScore ? "Tuntas" : "Remedial";
    }

    const submittedDateText = student.submittedAt
      ? new Date(student.submittedAt).toLocaleString("id-ID")
      : "-";

    const note = student.isRemedial ? "Remedial" : "";

    const row = worksheet.getRow(currentRowIdx);
    const rowValues = [
      index + 1,
      student.fullName,
      statusText,
      student.score !== null ? student.score : "-",
      kkmText,
      submittedDateText,
      note,
    ];

    rowValues.forEach((val, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = val;
      cell.font = { name: "Arial", size: 9 };
      cell.border = THIN_BORDER;
      cell.alignment = {
        vertical: "middle",
        horizontal: cIdx === 1 ? "left" : "center",
      };

      if (cIdx === 3 && typeof val === "number") {
        cell.font = { name: "Arial", size: 9, bold: true };
      }
      if (cIdx === 4) {
        if (val === "Tuntas") {
          cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF059669" } };
        } else if (val === "Remedial") {
          cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFDC2626" } };
        }
      }
    });

    row.height = 20;
    currentRowIdx++;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const safeFilename = `Rekap_Nilai_${quizTitle.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F]/g, "_")}.xlsx`;

  // Browser download trigger
  if (typeof window !== "undefined") {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
