import ExcelJS from "exceljs";
import {
  AttendanceRecapReportData,
  ScoreRecapReportData,
  MonitoringReportData,
  TeachingJournalReportData,
  AcademicCoverageReportData,
} from "./reporting.types";
import { sanitizeSpreadsheetCell } from "./reporting.service";

// Shared border styles
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCBD5E1" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

const HEADER_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF94A3B8" } },
  left: { style: "thin", color: { argb: "FF94A3B8" } },
  bottom: { style: "medium", color: { argb: "FF475569" } },
  right: { style: "thin", color: { argb: "FF94A3B8" } },
};

// Pastel Color Palette
const COLOR_PALETTE = {
  headerBg: "FFF1F5F9",       // slate-100
  headerBgAccent: "FFE0E7FF", // indigo-100 for summary columns
  headerText: "FF0F172A",     // slate-900
  rowEven: "FFFFFFFF",        // pure white
  rowOdd: "FFF8FAFC",         // slate-50
  // Attendance colors
  presentBg: "FFECFDF5",      // emerald-50
  presentText: "FF047857",    // emerald-700
  lateBg: "FFFFF7ED",         // orange-50
  lateText: "FFC2410C",       // orange-700
  sickBg: "FFF0F9FF",         // sky-50
  sickText: "FF0369A1",       // sky-700
  permissionBg: "FFF5F3FF",   // violet-50
  permissionText: "FF6D28D9", // violet-700
  absentBg: "FFFEE2E2",       // red-100
  absentText: "FFB91C1C",     // red-700
  // Performance / below KKM
  belowKkmBg: "FFFEE2E2",
  belowKkmText: "FFDC2626",
  summaryBg: "FFF1F5F9",
  summaryText: "FF1E3A8A",
};

interface ReportHeaderContext {
  schoolName: string;
  className: string;
  subjectName: string;
  academicPeriodYear: string;
  academicPeriodSemester: string;
  teacherName: string;
  curriculumName?: string | null;
  phase?: string | null;
}

function setupWorksheetHeader(
  worksheet: ExcelJS.Worksheet,
  title: string,
  ctx: ReportHeaderContext,
  maxColLetter: string
): number {
  const titleRow = worksheet.getRow(1);
  titleRow.getCell(1).value = title;
  titleRow.getCell(1).font = { name: "Arial", size: 13, bold: true, color: { argb: "FF0F172A" } };
  titleRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
  titleRow.height = 24;

  const schoolRow = worksheet.getRow(2);
  schoolRow.getCell(1).value = ctx.schoolName.toUpperCase();
  schoolRow.getCell(1).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
  schoolRow.height = 18;

  worksheet.getRow(3).height = 6;

  const row4 = worksheet.getRow(4);
  row4.getCell(1).value = "Kelas";
  row4.getCell(1).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF64748B" } };
  row4.getCell(2).value = `: ${ctx.className}`;
  row4.getCell(2).font = { name: "Arial", size: 9, bold: false, color: { argb: "FF0F172A" } };

  row4.getCell(4).value = "Mata Pelajaran";
  row4.getCell(4).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF64748B" } };
  row4.getCell(5).value = `: ${ctx.subjectName}`;
  row4.getCell(5).font = { name: "Arial", size: 9, bold: false, color: { argb: "FF0F172A" } };
  row4.height = 18;

  const row5 = worksheet.getRow(5);
  row5.getCell(1).value = "Tahun / Semester";
  row5.getCell(1).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF64748B" } };
  row5.getCell(2).value = `: ${ctx.academicPeriodYear} (Semester ${ctx.academicPeriodSemester})`;
  row5.getCell(2).font = { name: "Arial", size: 9, bold: false, color: { argb: "FF0F172A" } };

  row5.getCell(4).value = "Guru Pengampu";
  row5.getCell(4).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF64748B" } };
  row5.getCell(5).value = `: ${ctx.teacherName}`;
  row5.getCell(5).font = { name: "Arial", size: 9, bold: false, color: { argb: "FF0F172A" } };
  row5.height = 18;

  let nextRow = 7;
  if (ctx.curriculumName || ctx.phase) {
    const row6 = worksheet.getRow(6);
    row6.getCell(1).value = "Kurikulum";
    row6.getCell(1).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF64748B" } };
    row6.getCell(2).value = `: ${ctx.curriculumName || "-"}`;
    row6.getCell(2).font = { name: "Arial", size: 9, bold: false, color: { argb: "FF0F172A" } };

    row6.getCell(4).value = "Fase";
    row6.getCell(4).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF64748B" } };
    row6.getCell(5).value = `: ${ctx.phase || "-"}`;
    row6.getCell(5).font = { name: "Arial", size: 9, bold: false, color: { argb: "FF0F172A" } };
    row6.height = 18;
    nextRow = 8;
  }

  worksheet.getRow(nextRow).height = 10;
  return nextRow + 1;
}

function appendSignatures(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  teacherName: string,
  teacherColLetter: string
): void {
  const sigRow1 = startRow + 2;
  const sigRow2 = sigRow1 + 1;
  const sigRow3 = sigRow1 + 5;
  const sigRow4 = sigRow1 + 6;

  worksheet.getCell(`B${sigRow1}`).value = "Mengetahui,";
  worksheet.getCell(`B${sigRow1}`).font = { name: "Arial", size: 9 };
  worksheet.getCell(`B${sigRow2}`).value = "Kepala Sekolah,";
  worksheet.getCell(`B${sigRow2}`).font = { name: "Arial", size: 9, bold: true };
  worksheet.getCell(`B${sigRow3}`).value = "( ............................................................ )";
  worksheet.getCell(`B${sigRow3}`).font = { name: "Arial", size: 9, bold: true };
  worksheet.getCell(`B${sigRow4}`).value = "NIP. ........................................................";
  worksheet.getCell(`B${sigRow4}`).font = { name: "Arial", size: 9 };

  worksheet.getCell(`${teacherColLetter}${sigRow1}`).value = "Ditetapkan tanggal: ....................";
  worksheet.getCell(`${teacherColLetter}${sigRow1}`).font = { name: "Arial", size: 9 };
  worksheet.getCell(`${teacherColLetter}${sigRow2}`).value = "Guru Mata Pelajaran,";
  worksheet.getCell(`${teacherColLetter}${sigRow2}`).font = { name: "Arial", size: 9, bold: true };
  worksheet.getCell(`${teacherColLetter}${sigRow3}`).value = `( ${teacherName} )`;
  worksheet.getCell(`${teacherColLetter}${sigRow3}`).font = { name: "Arial", size: 9, bold: true };
  worksheet.getCell(`${teacherColLetter}${sigRow4}`).value = "NIP. ........................................................";
  worksheet.getCell(`${teacherColLetter}${sigRow4}`).font = { name: "Arial", size: 9 };
}

/**
 * Generates XLSX workbook binary buffer for Attendance Recap.
 */
export async function exportAttendanceRecapToXlsx(data: AttendanceRecapReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KLASSA";
  workbook.lastModifiedBy = data.contextInfo.teacherName;

  const worksheet = workbook.addWorksheet("Rekap Presensi", {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const headerRowIdx = setupWorksheetHeader(
    worksheet,
    "REKAPITULASI PRESENSI SISWA",
    data.contextInfo,
    "N"
  );

  const baseHeaders = ["No", "NIS", "Nama Siswa", "Status Roster"];
  const sessionHeaders = data.sessions.map((s) =>
    new Date(s.date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" })
  );
  const statHeaders = ["Total Pertemuan", "Hadir (H)", "Terlambat (T)", "Sakit (S)", "Izin (I)", "Alpa (A)"];

  const allHeaders = [...baseHeaders, ...sessionHeaders, ...statHeaders];
  const tableHeaderRow = worksheet.getRow(headerRowIdx);
  const statStartColIdx = baseHeaders.length + sessionHeaders.length;

  allHeaders.forEach((title, idx) => {
    const colNumber = idx + 1;
    const cell = tableHeaderRow.getCell(colNumber);
    cell.value = title;
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.headerText } };

    // Accent fill for summary columns
    const isStatCol = idx >= statStartColIdx;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isStatCol ? COLOR_PALETTE.headerBgAccent : COLOR_PALETTE.headerBg },
    };
    cell.border = HEADER_BORDER;
    cell.alignment = {
      vertical: "middle",
      horizontal: idx === 2 ? "left" : "center",
      wrapText: true,
    };
  });
  tableHeaderRow.height = 28;

  worksheet.getColumn(1).width = 5;  // No
  worksheet.getColumn(2).width = 12; // NIS
  worksheet.getColumn(3).width = 28; // Nama
  worksheet.getColumn(4).width = 16; // Status Roster

  for (let s = 0; s < data.sessions.length; s++) {
    worksheet.getColumn(5 + s).width = 7;
  }

  const statStartCol = 5 + data.sessions.length;
  worksheet.getColumn(statStartCol).width = 14;     // Total Pertemuan
  worksheet.getColumn(statStartCol + 1).width = 10; // H
  worksheet.getColumn(statStartCol + 2).width = 11; // T
  worksheet.getColumn(statStartCol + 3).width = 10; // S
  worksheet.getColumn(statStartCol + 4).width = 10; // I
  worksheet.getColumn(statStartCol + 5).width = 10; // A

  let currentRowIdx = headerRowIdx + 1;
  data.students.forEach((student, sIdx) => {
    const row = worksheet.getRow(currentRowIdx);
    const rowValues: Array<string | number> = [
      sIdx + 1,
      student.nis || "-",
      student.fullName,
      student.rosterStatusLabel,
    ];

    for (const session of data.sessions) {
      const rec = student.recordsBySessionId[session.id];
      if (!rec || rec.status === "NOT_ENROLLED") rowValues.push("—");
      else if (rec.status === "PRESENT") rowValues.push("H");
      else if (rec.status === "LATE") rowValues.push("T");
      else if (rec.status === "SICK") rowValues.push("S");
      else if (rec.status === "PERMISSION") rowValues.push("I");
      else if (rec.status === "ABSENT") rowValues.push("A");
      else rowValues.push("-");
    }

    rowValues.push(
      student.summary.recordedSessionsCount,
      student.summary.presentCount,
      student.summary.lateCount,
      student.summary.sickCount,
      student.summary.permissionCount,
      student.summary.absentCount
    );

    const isOdd = sIdx % 2 === 1;
    const baseRowBg = isOdd ? COLOR_PALETTE.rowOdd : COLOR_PALETTE.rowEven;

    rowValues.forEach((val, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = typeof val === "string" ? sanitizeSpreadsheetCell(val) : val;
      cell.font = { name: "Arial", size: 9 };
      cell.border = THIN_BORDER;

      const isTextCol = cIdx === 2; // Nama
      cell.alignment = {
        vertical: "middle",
        horizontal: isTextCol ? "left" : "center",
      };

      // Default zebra striping
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: baseRowBg } };

      // Vibrant, soft pastel status coloring
      if (val === "H") {
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.presentText } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.presentBg } };
      } else if (val === "T") {
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.lateText } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.lateBg } };
      } else if (val === "S") {
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.sickText } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.sickBg } };
      } else if (val === "I") {
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.permissionText } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.permissionBg } };
      } else if (val === "A") {
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.absentText } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.absentBg } };
      }

      // Summary columns styling
      if (cIdx >= statStartColIdx) {
        if (cIdx === statStartColIdx) {
          cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.summaryText } };
        } else if (cIdx === statStartColIdx + 5 && typeof val === "number" && val > 0) {
          // Absent count in summary
          cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.absentText } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.absentBg } };
        }
      }
    });

    row.height = 20;
    currentRowIdx++;
  });

  const teacherCol = data.sessions.length > 3 ? "J" : "F";
  appendSignatures(worksheet, currentRowIdx, data.contextInfo.teacherName, teacherCol);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generates XLSX workbook binary buffer for Assessment & Score Recap.
 */
export async function exportScoreRecapToXlsx(data: ScoreRecapReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KLASSA";
  workbook.lastModifiedBy = data.contextInfo.teacherName;

  const worksheet = workbook.addWorksheet("Rekap Nilai", {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const headerRowIdx = setupWorksheetHeader(
    worksheet,
    "REKAPITULASI PENILAIAN & NILAI SISWA",
    data.contextInfo,
    "M"
  );

  const baseHeaders = ["No", "NIS", "Nama Siswa", "Status Roster"];
  const assessmentHeaders = data.assessments.map(
    (a) => `${a.title}\n(Max ${a.maxScore}${a.minimumPassingScore != null ? ` • KKM ${a.minimumPassingScore}` : ""})`
  );
  const gradePolicyHeaders = data.hasActiveGradePolicy
    ? ["Bobot Tersedia (%)", "Performa Akhir"]
    : [];

  const allHeaders = [...baseHeaders, ...assessmentHeaders, ...gradePolicyHeaders];
  const tableHeaderRow = worksheet.getRow(headerRowIdx);
  const policyStartIdx = baseHeaders.length + assessmentHeaders.length;

  allHeaders.forEach((title, idx) => {
    const colNumber = idx + 1;
    const cell = tableHeaderRow.getCell(colNumber);
    cell.value = title;
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.headerText } };

    const isPolicyCol = idx >= policyStartIdx;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isPolicyCol ? COLOR_PALETTE.headerBgAccent : COLOR_PALETTE.headerBg },
    };
    cell.border = HEADER_BORDER;
    cell.alignment = {
      vertical: "middle",
      horizontal: idx === 2 ? "left" : "center",
      wrapText: true,
    };
  });
  tableHeaderRow.height = 32;

  worksheet.getColumn(1).width = 5;  // No
  worksheet.getColumn(2).width = 12; // NIS
  worksheet.getColumn(3).width = 28; // Nama
  worksheet.getColumn(4).width = 16; // Status

  for (let a = 0; a < data.assessments.length; a++) {
    worksheet.getColumn(5 + a).width = 16;
  }

  if (data.hasActiveGradePolicy) {
    const policyStartCol = 5 + data.assessments.length;
    worksheet.getColumn(policyStartCol).width = 18;
    worksheet.getColumn(policyStartCol + 1).width = 20;
  }

  let currentRowIdx = headerRowIdx + 1;
  data.students.forEach((student, sIdx) => {
    const row = worksheet.getRow(currentRowIdx);
    const rowValues: Array<string | number> = [
      sIdx + 1,
      student.nis || "-",
      student.fullName,
      student.rosterStatusLabel,
    ];

    for (const assessment of data.assessments) {
      const res = student.scoresByAssessmentId[assessment.id];
      if (!res || res.status === "NOT_ENROLLED") {
        rowValues.push("—");
      } else if (res.status === "ABSENT") {
        rowValues.push("ABSEN");
      } else if (res.status === "EXCUSED") {
        rowValues.push("DISPEN");
      } else if (res.status === "PENDING") {
        rowValues.push("BELUM");
      } else if (res.finalScore !== null && res.finalScore !== undefined) {
        rowValues.push(res.finalScore);
      } else {
        rowValues.push("-");
      }
    }

    if (data.hasActiveGradePolicy) {
      rowValues.push(
        student.availableWeight !== null ? student.availableWeight : "-",
        student.runningPerformance !== null ? student.runningPerformance : "-"
      );
    }

    const isOdd = sIdx % 2 === 1;
    const baseRowBg = isOdd ? COLOR_PALETTE.rowOdd : COLOR_PALETTE.rowEven;

    rowValues.forEach((val, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = typeof val === "string" ? sanitizeSpreadsheetCell(val) : val;
      cell.font = { name: "Arial", size: 9 };
      cell.border = THIN_BORDER;

      const isTextCol = cIdx === 2;
      const isPolicyCol = data.hasActiveGradePolicy && cIdx >= 4 + data.assessments.length;

      cell.alignment = {
        vertical: "middle",
        horizontal: isTextCol ? "left" : "center",
      };

      // Base zebra striping
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: baseRowBg } };

      // Highlight below KKM or absent
      const assessmentIdx = cIdx - 4;
      if (assessmentIdx >= 0 && assessmentIdx < data.assessments.length) {
        const kkm = data.assessments[assessmentIdx].minimumPassingScore;
        if (typeof val === "number" && kkm != null && val < kkm) {
          cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.belowKkmText } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.belowKkmBg } };
        } else if (val === "ABSEN") {
          cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.absentText } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.absentBg } };
        } else if (typeof val === "number" && val === 100) {
          cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.presentText } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.presentBg } };
        }
      }

      if (isPolicyCol) {
        if (typeof val === "number") {
          cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.summaryText } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.summaryBg } };
        }
      }
    });

    row.height = 20;
    currentRowIdx++;
  });

  const teacherCol = data.assessments.length > 2 ? "H" : "E";
  appendSignatures(worksheet, currentRowIdx, data.contextInfo.teacherName, teacherCol);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generates XLSX workbook binary buffer for Monitoring & Follow-Up Report.
 */
export async function exportMonitoringReportToXlsx(data: MonitoringReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KLASSA";
  workbook.lastModifiedBy = data.contextInfo.teacherName;

  const worksheet = workbook.addWorksheet("Rekap Monitoring", {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const headerRowIdx = setupWorksheetHeader(
    worksheet,
    "LAPORAN MONITORING & TINDAK LANJUT SISWA",
    data.contextInfo,
    "Q"
  );

  const headers = [
    "No",
    "NIS",
    "Nama Siswa",
    "Status Roster",
    "Total Presensi",
    "Hadir",
    "Terlambat",
    "Sakit",
    "Izin",
    "Alpa",
    "Total Ketidakhadiran",
    "Penilaian Selesai",
    "Di Bawah KKTP",
    "Remedial",
    "Nilai Terakhir",
    "Total Catatan",
    "Tindak Lanjut Terbuka",
  ];

  const tableHeaderRow = worksheet.getRow(headerRowIdx);
  headers.forEach((title, idx) => {
    const cell = tableHeaderRow.getCell(idx + 1);
    cell.value = title;
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.headerText } };

    const isRiskCol = idx === 10 || idx === 12 || idx === 16;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isRiskCol ? "FFFEE2E2" : COLOR_PALETTE.headerBg },
    };
    cell.border = HEADER_BORDER;
    cell.alignment = {
      vertical: "middle",
      horizontal: idx === 2 ? "left" : "center",
      wrapText: true,
    };
  });
  tableHeaderRow.height = 28;

  const colWidths = [5, 12, 28, 16, 12, 8, 9, 8, 8, 8, 14, 14, 13, 10, 12, 12, 16];
  colWidths.forEach((w, idx) => {
    worksheet.getColumn(idx + 1).width = w;
  });

  let currentRowIdx = headerRowIdx + 1;
  data.students.forEach((student, sIdx) => {
    const totalAbsence = student.attendance.sick + student.attendance.permission + student.attendance.absent;
    const rowValues: Array<string | number> = [
      sIdx + 1,
      student.nis || "-",
      student.fullName,
      student.rosterStatusLabel,
      student.attendance.totalRecorded,
      student.attendance.present,
      student.attendance.late,
      student.attendance.sick,
      student.attendance.permission,
      student.attendance.absent,
      totalAbsence,
      student.assessment.completedGradedCount,
      student.assessment.belowKktpCount,
      student.assessment.remedialAttemptsCount,
      student.assessment.latestGradedScore !== null ? student.assessment.latestGradedScore : "-",
      student.notesSummary.totalNotes,
      student.notesSummary.openFollowUpCount,
    ];

    const isOdd = sIdx % 2 === 1;
    const baseRowBg = isOdd ? COLOR_PALETTE.rowOdd : COLOR_PALETTE.rowEven;

    const row = worksheet.getRow(currentRowIdx);
    rowValues.forEach((val, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = typeof val === "string" ? sanitizeSpreadsheetCell(val) : val;
      cell.font = { name: "Arial", size: 9 };
      cell.border = THIN_BORDER;
      cell.alignment = {
        vertical: "middle",
        horizontal: cIdx === 2 ? "left" : "center",
      };

      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: baseRowBg } };

      // Presence columns soft indicators
      if (cIdx === 5 && typeof val === "number" && val > 0) { // Hadir
        cell.font = { name: "Arial", size: 9, color: { argb: COLOR_PALETTE.presentText } };
      } else if (cIdx === 9 && typeof val === "number" && val > 0) { // Alpa
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.absentText } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.absentBg } };
      }

      // Attention needed: Below KKTP > 0
      if (cIdx === 12 && typeof val === "number" && val > 0) {
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.belowKkmText } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.belowKkmBg } };
      }

      // Soft warning if student has open follow-up
      if (cIdx === 16 && typeof val === "number" && val > 0) {
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFB45309" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      }
    });

    row.height = 20;
    currentRowIdx++;
  });

  appendSignatures(worksheet, currentRowIdx, data.contextInfo.teacherName, "K");

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generates XLSX workbook binary buffer for Teaching Journal.
 */
export async function exportTeachingJournalToXlsx(data: TeachingJournalReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KLASSA";
  workbook.lastModifiedBy = data.contextInfo.teacherName;

  const worksheet = workbook.addWorksheet("Jurnal Mengajar", {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const headerRowIdx = setupWorksheetHeader(
    worksheet,
    "JURNAL MENGAJAR GURU",
    data.contextInfo,
    "I"
  );

  const headers = [
    "No",
    "Tanggal",
    "Status",
    "Materi / Topik",
    "Ringkasan Aktivitas",
    "Refleksi",
    "Presensi (H / T / S / I / A)",
    "Tugas",
    "Tujuan Pembelajaran Terkait",
  ];

  const tableHeaderRow = worksheet.getRow(headerRowIdx);
  headers.forEach((title, idx) => {
    const cell = tableHeaderRow.getCell(idx + 1);
    cell.value = title;
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.headerBg } };
    cell.border = HEADER_BORDER;
    cell.alignment = {
      vertical: "middle",
      horizontal: idx === 0 || idx === 1 || idx === 2 ? "center" : "left",
      wrapText: true,
    };
  });
  tableHeaderRow.height = 28;

  worksheet.getColumn(1).width = 5;  // No
  worksheet.getColumn(2).width = 16; // Tanggal
  worksheet.getColumn(3).width = 12; // Status
  worksheet.getColumn(4).width = 24; // Materi
  worksheet.getColumn(5).width = 30; // Aktivitas
  worksheet.getColumn(6).width = 24; // Refleksi
  worksheet.getColumn(7).width = 22; // Presensi
  worksheet.getColumn(8).width = 18; // Tugas
  worksheet.getColumn(9).width = 30; // TP

  let currentRowIdx = headerRowIdx + 1;
  data.sessions.forEach((session, sIdx) => {
    const sDate = new Date(session.date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const topic = session.actualTopic || session.plannedTopic || "-";
    const attSummary = `${session.attendanceCounts.present}H / ${session.attendanceCounts.late}T / ${session.attendanceCounts.sick}S / ${session.attendanceCounts.permission}I / ${session.attendanceCounts.absent}A`;
    const assignmentsText = (session.assignments || []).map((a) => a.title).join(", ") || "-";
    const objectivesText =
      (session.objectives || [])
        .map((o) => (o.code ? `[${o.code}] ${o.description}` : o.description))
        .join("; ") || "-";

    const rowValues: Array<string | number> = [
      sIdx + 1,
      sDate,
      session.status === "COMPLETED" ? "Selesai" : "Sedang Berjalan",
      topic,
      session.activitySummary || "-",
      session.reflection || "-",
      attSummary,
      assignmentsText,
      objectivesText,
    ];

    const isOdd = sIdx % 2 === 1;
    const baseRowBg = isOdd ? COLOR_PALETTE.rowOdd : COLOR_PALETTE.rowEven;

    const row = worksheet.getRow(currentRowIdx);
    rowValues.forEach((val, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = typeof val === "string" ? sanitizeSpreadsheetCell(val) : val;
      cell.font = { name: "Arial", size: 9 };
      cell.border = THIN_BORDER;

      const isCenterCol = cIdx === 0 || cIdx === 1 || cIdx === 2;
      cell.alignment = {
        vertical: "top",
        horizontal: isCenterCol ? "center" : "left",
        wrapText: true,
      };

      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: baseRowBg } };

      if (cIdx === 2 && val === "Selesai") {
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.presentText } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.presentBg } };
      } else if (cIdx === 2 && val === "Sedang Berjalan") {
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.lateText } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.lateBg } };
      }
    });

    row.height = 36;
    currentRowIdx++;
  });

  appendSignatures(worksheet, currentRowIdx, data.contextInfo.teacherName, "G");

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generates XLSX workbook binary buffer for Academic Coverage.
 */
export async function exportAcademicCoverageToXlsx(data: AcademicCoverageReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KLASSA";
  workbook.lastModifiedBy = data.contextInfo.teacherName;

  const worksheet = workbook.addWorksheet("Cakupan Akademik", {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: "portrait",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const headerRowIdx = setupWorksheetHeader(
    worksheet,
    "LAPORAN CAKUPAN AKADEMIK (TUJUAN PEMBELAJARAN)",
    data.contextInfo,
    "G"
  );

  const headers = [
    "No",
    "Kode TP",
    "Deskripsi Tujuan Pembelajaran",
    "Status",
    "Jumlah Pertemuan Selesai Terkait",
    "Tanggal Terakhir Diajarkan",
    "Jumlah Penilaian Selesai Terkait",
  ];

  const tableHeaderRow = worksheet.getRow(headerRowIdx);
  headers.forEach((title, idx) => {
    const cell = tableHeaderRow.getCell(idx + 1);
    cell.value = title;
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.headerBg } };
    cell.border = HEADER_BORDER;
    cell.alignment = {
      vertical: "middle",
      horizontal: idx === 2 ? "left" : "center",
      wrapText: true,
    };
  });
  tableHeaderRow.height = 28;

  worksheet.getColumn(1).width = 5;  // No
  worksheet.getColumn(2).width = 12; // Kode TP
  worksheet.getColumn(3).width = 38; // Deskripsi TP
  worksheet.getColumn(4).width = 12; // Status
  worksheet.getColumn(5).width = 16; // Pertemuan Selesai
  worksheet.getColumn(6).width = 18; // Tanggal Terakhir
  worksheet.getColumn(7).width = 16; // Penilaian Selesai

  let currentRowIdx = headerRowIdx + 1;
  data.objectives.forEach((obj, oIdx) => {
    const lastDate = obj.latestTaughtDate
      ? new Date(obj.latestTaughtDate).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "-";

    const rowValues: Array<string | number> = [
      oIdx + 1,
      obj.code || "-",
      obj.description,
      obj.status === "ACTIVE" ? "Aktif" : "Diarsipkan",
      obj.completedTeachingSessionsCount,
      lastDate,
      obj.completedAssessmentsCount,
    ];

    const isOdd = oIdx % 2 === 1;
    const baseRowBg = isOdd ? COLOR_PALETTE.rowOdd : COLOR_PALETTE.rowEven;

    const row = worksheet.getRow(currentRowIdx);
    rowValues.forEach((val, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = typeof val === "string" ? sanitizeSpreadsheetCell(val) : val;
      cell.font = { name: "Arial", size: 9 };
      cell.border = THIN_BORDER;
      cell.alignment = {
        vertical: "middle",
        horizontal: cIdx === 2 ? "left" : "center",
        wrapText: true,
      };

      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: baseRowBg } };

      if (cIdx === 1) {
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.summaryText } };
      } else if (cIdx === 3 && val === "Aktif") {
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLOR_PALETTE.presentText } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_PALETTE.presentBg } };
      }
    });

    row.height = 24;
    currentRowIdx++;
  });

  appendSignatures(worksheet, currentRowIdx, data.contextInfo.teacherName, "E");

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
