import { utils, write } from "xlsx";
import {
  AttendanceRecapReportData,
  ScoreRecapReportData,
  MonitoringReportData,
  TeachingJournalReportData,
  AcademicCoverageReportData,
} from "./reporting.types";
import { sanitizeSpreadsheetCell } from "./reporting.service";

/**
 * Generates XLSX workbook binary buffer for Attendance Recap.
 */
export function exportAttendanceRecapToXlsx(data: AttendanceRecapReportData): Buffer {
  const wb = utils.book_new();

  // Header rows
  const rows: Array<Array<string | number | boolean | null>> = [
    [sanitizeSpreadsheetCell(`REKAPITULASI PRESENSI SISWA`)],
    [sanitizeSpreadsheetCell(`Sekolah: ${data.contextInfo.schoolName}`)],
    [sanitizeSpreadsheetCell(`Kelas: ${data.contextInfo.className}`)],
    [sanitizeSpreadsheetCell(`Mata Pelajaran: ${data.contextInfo.subjectName}`)],
    [
      sanitizeSpreadsheetCell(
        `Tahun Ajaran / Semester: ${data.contextInfo.academicPeriodYear} (Semester ${data.contextInfo.academicPeriodSemester})`
      ),
    ],
    [sanitizeSpreadsheetCell(`Guru: ${data.contextInfo.teacherName}`)],
    [],
  ];

  // Column Headers
  const colHeaders: Array<string | number | boolean | null> = [
    sanitizeSpreadsheetCell("No"),
    sanitizeSpreadsheetCell("NIS"),
    sanitizeSpreadsheetCell("Nama Siswa"),
    sanitizeSpreadsheetCell("Status Roster"),
  ];

  for (const session of data.sessions) {
    const sDate = new Date(session.date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" });
    colHeaders.push(sanitizeSpreadsheetCell(sDate));
  }

  colHeaders.push(
    sanitizeSpreadsheetCell("Total Pertemuan"),
    sanitizeSpreadsheetCell("Hadir (H)"),
    sanitizeSpreadsheetCell("Terlambat (T)"),
    sanitizeSpreadsheetCell("Sakit (S)"),
    sanitizeSpreadsheetCell("Izin (I)"),
    sanitizeSpreadsheetCell("Alpa (A)")
  );

  rows.push(colHeaders);

  // Student Rows
  data.students.forEach((student, index) => {
    const studentRow: Array<string | number | boolean | null> = [
      index + 1,
      sanitizeSpreadsheetCell(student.nis || "-"),
      sanitizeSpreadsheetCell(student.fullName),
      sanitizeSpreadsheetCell(student.rosterStatusLabel),
    ];

    for (const session of data.sessions) {
      const rec = student.recordsBySessionId[session.id];
      if (!rec || rec.status === "NOT_ENROLLED") {
        studentRow.push(sanitizeSpreadsheetCell("—"));
      } else if (rec.status === "PRESENT") {
        studentRow.push(sanitizeSpreadsheetCell("H"));
      } else if (rec.status === "LATE") {
        studentRow.push(sanitizeSpreadsheetCell("T"));
      } else if (rec.status === "SICK") {
        studentRow.push(sanitizeSpreadsheetCell("S"));
      } else if (rec.status === "PERMISSION") {
        studentRow.push(sanitizeSpreadsheetCell("I"));
      } else if (rec.status === "ABSENT") {
        studentRow.push(sanitizeSpreadsheetCell("A"));
      } else {
        studentRow.push(sanitizeSpreadsheetCell("-"));
      }
    }

    studentRow.push(
      student.summary.recordedSessionsCount,
      student.summary.presentCount,
      student.summary.lateCount,
      student.summary.sickCount,
      student.summary.permissionCount,
      student.summary.absentCount
    );

    rows.push(studentRow);
  });

  const ws = utils.aoa_to_sheet(rows);
  utils.book_append_sheet(wb, ws, "Rekap Presensi");

  return write(wb, { type: "buffer", bookType: "xlsx" });
}

/**
 * Generates XLSX workbook binary buffer for Assessment & Score Recap.
 */
export function exportScoreRecapToXlsx(data: ScoreRecapReportData): Buffer {
  const wb = utils.book_new();

  const rows: Array<Array<string | number | boolean | null>> = [
    [sanitizeSpreadsheetCell(`REKAPITULASI PENILAIAN & NILAI SISWA`)],
    [sanitizeSpreadsheetCell(`Sekolah: ${data.contextInfo.schoolName}`)],
    [sanitizeSpreadsheetCell(`Kelas: ${data.contextInfo.className}`)],
    [sanitizeSpreadsheetCell(`Mata Pelajaran: ${data.contextInfo.subjectName}`)],
    [
      sanitizeSpreadsheetCell(
        `Tahun Ajaran / Semester: ${data.contextInfo.academicPeriodYear} (Semester ${data.contextInfo.academicPeriodSemester})`
      ),
    ],
    [sanitizeSpreadsheetCell(`Guru: ${data.contextInfo.teacherName}`)],
    [],
  ];

  const colHeaders: Array<string | number | boolean | null> = [
    sanitizeSpreadsheetCell("No"),
    sanitizeSpreadsheetCell("NIS"),
    sanitizeSpreadsheetCell("Nama Siswa"),
    sanitizeSpreadsheetCell("Status Roster"),
  ];

  for (const assessment of data.assessments) {
    colHeaders.push(sanitizeSpreadsheetCell(`${assessment.title} (Max ${assessment.maxScore})`));
  }

  if (data.hasActiveGradePolicy) {
    colHeaders.push(
      sanitizeSpreadsheetCell("Bobot Tersedia (%)"),
      sanitizeSpreadsheetCell("Performa Berdasarkan Komponen Tersedia")
    );
  }

  rows.push(colHeaders);

  data.students.forEach((student, index) => {
    const studentRow: Array<string | number | boolean | null> = [
      index + 1,
      sanitizeSpreadsheetCell(student.nis || "-"),
      sanitizeSpreadsheetCell(student.fullName),
      sanitizeSpreadsheetCell(student.rosterStatusLabel),
    ];

    for (const assessment of data.assessments) {
      const res = student.scoresByAssessmentId[assessment.id];
      if (!res || res.status === "NOT_ENROLLED") {
        studentRow.push(sanitizeSpreadsheetCell("—"));
      } else if (res.status === "ABSENT") {
        studentRow.push(sanitizeSpreadsheetCell("ABSEN"));
      } else if (res.status === "EXCUSED") {
        studentRow.push(sanitizeSpreadsheetCell("DISPENSASI"));
      } else if (res.status === "PENDING") {
        studentRow.push(sanitizeSpreadsheetCell("BELUM DINILAI"));
      } else if (res.finalScore !== null && res.finalScore !== undefined) {
        studentRow.push(res.finalScore);
      } else {
        studentRow.push(sanitizeSpreadsheetCell("-"));
      }
    }

    if (data.hasActiveGradePolicy) {
      studentRow.push(
        student.availableWeight !== null ? student.availableWeight : "-",
        student.runningPerformance !== null ? student.runningPerformance : "-"
      );
    }

    rows.push(studentRow);
  });

  const ws = utils.aoa_to_sheet(rows);
  utils.book_append_sheet(wb, ws, "Rekap Nilai");

  return write(wb, { type: "buffer", bookType: "xlsx" });
}

/**
 * Generates XLSX workbook binary buffer for Monitoring & Follow-Up Report.
 */
export function exportMonitoringReportToXlsx(data: MonitoringReportData): Buffer {
  const wb = utils.book_new();

  const rows: Array<Array<string | number | boolean | null>> = [
    [sanitizeSpreadsheetCell(`LAPORAN MONITORING & TINDAK LANJUT SISWA`)],
    [sanitizeSpreadsheetCell(`Sekolah: ${data.contextInfo.schoolName}`)],
    [sanitizeSpreadsheetCell(`Kelas: ${data.contextInfo.className}`)],
    [sanitizeSpreadsheetCell(`Mata Pelajaran: ${data.contextInfo.subjectName}`)],
    [
      sanitizeSpreadsheetCell(
        `Tahun Ajaran / Semester: ${data.contextInfo.academicPeriodYear} (Semester ${data.contextInfo.academicPeriodSemester})`
      ),
    ],
    [sanitizeSpreadsheetCell(`Guru: ${data.contextInfo.teacherName}`)],
    [],
    [
      sanitizeSpreadsheetCell("No"),
      sanitizeSpreadsheetCell("NIS"),
      sanitizeSpreadsheetCell("Nama Siswa"),
      sanitizeSpreadsheetCell("Status Roster"),
      sanitizeSpreadsheetCell("Total Presensi"),
      sanitizeSpreadsheetCell("Hadir"),
      sanitizeSpreadsheetCell("Terlambat"),
      sanitizeSpreadsheetCell("Sakit"),
      sanitizeSpreadsheetCell("Izin"),
      sanitizeSpreadsheetCell("Alpa"),
      sanitizeSpreadsheetCell("Total Ketidakhadiran"),
      sanitizeSpreadsheetCell("Penilaian Selesai"),
      sanitizeSpreadsheetCell("Di Bawah KKTP"),
      sanitizeSpreadsheetCell("Remedial"),
      sanitizeSpreadsheetCell("Nilai Terakhir"),
      sanitizeSpreadsheetCell("Total Catatan"),
      sanitizeSpreadsheetCell("Tindak Lanjut Terbuka"),
    ],
  ];

  data.students.forEach((student, index) => {
    const totalAbsence = student.attendance.sick + student.attendance.permission + student.attendance.absent;
    rows.push([
      index + 1,
      sanitizeSpreadsheetCell(student.nis || "-"),
      sanitizeSpreadsheetCell(student.fullName),
      sanitizeSpreadsheetCell(student.rosterStatusLabel),
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
    ]);
  });

  const ws = utils.aoa_to_sheet(rows);
  utils.book_append_sheet(wb, ws, "Rekap Monitoring");

  return write(wb, { type: "buffer", bookType: "xlsx" });
}

/**
 * Generates XLSX workbook binary buffer for Teaching Journal.
 */
export function exportTeachingJournalToXlsx(data: TeachingJournalReportData): Buffer {
  const wb = utils.book_new();

  const rows: Array<Array<string | number | boolean | null>> = [
    [sanitizeSpreadsheetCell(`JURNAL MENGAJAR GURU`)],
    [sanitizeSpreadsheetCell(`Sekolah: ${data.contextInfo.schoolName}`)],
    [sanitizeSpreadsheetCell(`Kelas: ${data.contextInfo.className}`)],
    [sanitizeSpreadsheetCell(`Mata Pelajaran: ${data.contextInfo.subjectName}`)],
    [
      sanitizeSpreadsheetCell(
        `Tahun Ajaran / Semester: ${data.contextInfo.academicPeriodYear} (Semester ${data.contextInfo.academicPeriodSemester})`
      ),
    ],
    [sanitizeSpreadsheetCell(`Guru: ${data.contextInfo.teacherName}`)],
    [],
    [
      sanitizeSpreadsheetCell("No"),
      sanitizeSpreadsheetCell("Tanggal"),
      sanitizeSpreadsheetCell("Status"),
      sanitizeSpreadsheetCell("Materi / Topik"),
      sanitizeSpreadsheetCell("Ringkasan Aktivitas"),
      sanitizeSpreadsheetCell("Refleksi"),
      sanitizeSpreadsheetCell("Presensi (H / T / S / I / A)"),
      sanitizeSpreadsheetCell("Tugas"),
      sanitizeSpreadsheetCell("Tujuan Pembelajaran Terkait"),
    ],
  ];

  data.sessions.forEach((session, index) => {
    const sDate = new Date(session.date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const topic = session.actualTopic || session.plannedTopic || "-";
    const attSummary = `${session.attendanceCounts.present}H / ${session.attendanceCounts.late}T / ${session.attendanceCounts.sick}S / ${session.attendanceCounts.permission}I / ${session.attendanceCounts.absent}A`;
    const assignmentsText = (session.assignments || []).map((a) => a.title).join(", ") || "-";
    const objectivesText = (session.objectives || []).map((o) => (o.code ? `[${o.code}] ${o.description}` : o.description)).join("; ") || "-";

    rows.push([
      index + 1,
      sanitizeSpreadsheetCell(sDate),
      sanitizeSpreadsheetCell(session.status === "COMPLETED" ? "Selesai" : "Sedang Berjalan"),
      sanitizeSpreadsheetCell(topic),
      sanitizeSpreadsheetCell(session.activitySummary || "-"),
      sanitizeSpreadsheetCell(session.reflection || "-"),
      sanitizeSpreadsheetCell(attSummary),
      sanitizeSpreadsheetCell(assignmentsText),
      sanitizeSpreadsheetCell(objectivesText),
    ]);
  });

  const ws = utils.aoa_to_sheet(rows);
  utils.book_append_sheet(wb, ws, "Jurnal Mengajar");

  return write(wb, { type: "buffer", bookType: "xlsx" });
}

/**
 * Generates XLSX workbook binary buffer for Academic Coverage.
 */
export function exportAcademicCoverageToXlsx(data: AcademicCoverageReportData): Buffer {
  const wb = utils.book_new();

  const rows: Array<Array<string | number | boolean | null>> = [
    [sanitizeSpreadsheetCell(`LAPORAN CAKUPAN AKADEMIK (TUJUAN PEMBELAJARAN)`)],
    [sanitizeSpreadsheetCell(`Sekolah: ${data.contextInfo.schoolName}`)],
    [sanitizeSpreadsheetCell(`Kelas: ${data.contextInfo.className}`)],
    [sanitizeSpreadsheetCell(`Mata Pelajaran: ${data.contextInfo.subjectName}`)],
    [
      sanitizeSpreadsheetCell(
        `Tahun Ajaran / Semester: ${data.contextInfo.academicPeriodYear} (Semester ${data.contextInfo.academicPeriodSemester})`
      ),
    ],
    [sanitizeSpreadsheetCell(`Kurikulum: ${data.contextInfo.curriculumName || "-"}`)],
    [sanitizeSpreadsheetCell(`Fase: ${data.contextInfo.phase || "-"}`)],
    [sanitizeSpreadsheetCell(`Guru: ${data.contextInfo.teacherName}`)],
    [],
    [
      sanitizeSpreadsheetCell("No"),
      sanitizeSpreadsheetCell("Kode TP"),
      sanitizeSpreadsheetCell("Deskripsi Tujuan Pembelajaran"),
      sanitizeSpreadsheetCell("Status"),
      sanitizeSpreadsheetCell("Jumlah Pertemuan Selesai Terkait"),
      sanitizeSpreadsheetCell("Tanggal Terakhir Diajarkan"),
      sanitizeSpreadsheetCell("Jumlah Penilaian Selesai Terkait"),
    ],
  ];

  data.objectives.forEach((obj, index) => {
    const lastDate = obj.latestTaughtDate
      ? new Date(obj.latestTaughtDate).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "-";

    rows.push([
      index + 1,
      sanitizeSpreadsheetCell(obj.code || "-"),
      sanitizeSpreadsheetCell(obj.description),
      sanitizeSpreadsheetCell(obj.status === "ACTIVE" ? "Aktif" : "Diarsipkan"),
      obj.completedTeachingSessionsCount,
      sanitizeSpreadsheetCell(lastDate),
      obj.completedAssessmentsCount,
    ]);
  });

  const ws = utils.aoa_to_sheet(rows);
  utils.book_append_sheet(wb, ws, "Cakupan Akademik");

  return write(wb, { type: "buffer", bookType: "xlsx" });
}
