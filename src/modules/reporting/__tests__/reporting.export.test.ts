import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  exportTeachingJournalToXlsx,
  exportAttendanceRecapToXlsx,
  exportScoreRecapToXlsx,
  exportMonitoringReportToXlsx,
  exportAcademicCoverageToXlsx,
} from "../reporting.export";
import { generateSafeExportFilename } from "../reporting.service";
import {
  TeachingJournalReportData,
  AttendanceRecapReportData,
  ScoreRecapReportData,
  MonitoringReportData,
  AcademicCoverageReportData,
} from "../reporting.types";

describe("Stage 07: XLSX Artifact & Export Verification", () => {
  const baseContextInfo = {
    id: "ctx-1",
    className: "X-MIPA-1",
    subjectName: "Matematika",
    academicPeriodYear: "2026/2027",
    academicPeriodSemester: "1",
    teacherName: "Budi Guru",
    schoolName: "SMA Negeri 1",
  };

  it("1. exports Teaching Journal and parses workbook cleanly with sanitized formula text", () => {
    const mockJournal: TeachingJournalReportData = {
      contextInfo: baseContextInfo,
      totalSessions: 1,
      completedSessionsCount: 1,
      inProgressSessionsCount: 0,
      sessions: [
        {
          id: "sess-1",
          date: new Date("2026-08-15"),
          status: "COMPLETED",
          actualTopic: "=1+1 Formula Topic",
          plannedTopic: "Normal Topic",
          activitySummary: "+cmd /c calc Note",
          reflection: "@Reflection note",
          attendanceCounts: { total: 21, present: 20, late: 1, sick: 0, permission: 0, absent: 0 },
          assignments: [],
          objectives: [{ id: "obj-1", code: "TP 1.1", description: "Memahami Eksponen" }],
        },
      ],
    };

    const buf = exportTeachingJournalToXlsx(mockJournal);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);

    // Parse workbook
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toContain("Jurnal Mengajar");

    const ws = wb.Sheets["Jurnal Mengajar"];
    const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(ws, { header: 1 });

    // Header checks
    expect(rows[0][0]).toContain("JURNAL MENGAJAR GURU");
    expect(rows[2][0]).toContain("X-MIPA-1");
    expect(rows[7]).toEqual([
      "No",
      "Tanggal",
      "Status",
      "Materi / Topik",
      "Ringkasan Aktivitas",
      "Refleksi",
      "Presensi (H / T / S / I / A)",
      "Tugas",
      "Tujuan Pembelajaran Terkait",
    ]);

    // Data row check — Formula-like values sanitized with prepended single quote (')
    const dataRow = rows[8];
    expect(dataRow[0]).toBe(1);
    expect(dataRow[3]).toBe("'=1+1 Formula Topic");
    expect(dataRow[4]).toBe("'+cmd /c calc Note");
    expect(dataRow[5]).toBe("'@Reflection note");
    expect(dataRow[6]).toBe("20H / 1T / 0S / 0I / 0A");
    expect(dataRow[8]).toContain("[TP 1.1]");
  });

  it("2. exports Attendance Recap workbook and parses tabular layout", () => {
    const mockAttendance: AttendanceRecapReportData = {
      contextInfo: baseContextInfo,
      sessions: [
        { id: "sess-1", date: new Date("2026-08-15"), status: "COMPLETED", actualTopic: "Bab 1", plannedTopic: "Bab 1" },
        { id: "sess-2", date: new Date("2026-08-22"), status: "COMPLETED", actualTopic: "Bab 2", plannedTopic: "Bab 2" },
      ],
      students: [
        {
          studentId: "s-1",
          fullName: "Ahmad Santoso",
          nis: "1001",
          isCurrentRoster: true,
          rosterStatusLabel: "Aktif di kelas",
          recordsBySessionId: {
            "sess-1": { status: "PRESENT", note: null },
            "sess-2": { status: "LATE", note: null },
          },
          summary: { recordedSessionsCount: 2, presentCount: 1, lateCount: 1, sickCount: 0, permissionCount: 0, absentCount: 0 },
        },
        {
          studentId: "s-2",
          fullName: "Citra Dewi",
          nis: "1002",
          isCurrentRoster: false,
          rosterStatusLabel: "Tidak di roster saat ini",
          recordsBySessionId: {
            "sess-1": { status: "PRESENT", note: null },
          },
          summary: { recordedSessionsCount: 1, presentCount: 1, lateCount: 0, sickCount: 0, permissionCount: 0, absentCount: 0 },
        },
      ],
    };

    const buf = exportAttendanceRecapToXlsx(mockAttendance);
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toContain("Rekap Presensi");

    const ws = wb.Sheets["Rekap Presensi"];
    const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(ws, { header: 1 });

    expect(rows[0][0]).toContain("REKAPITULASI PRESENSI SISWA");
    const headerRow = rows[7];
    expect(headerRow[0]).toBe("No");
    expect(headerRow[1]).toBe("NIS");
    expect(headerRow[2]).toBe("Nama Siswa");
    expect(headerRow[3]).toBe("Status Roster");

    // Former roster student has correct label
    const student2Row = rows[9];
    expect(student2Row[2]).toBe("Citra Dewi");
    expect(student2Row[3]).toBe("Tidak di roster saat ini");
  });

  it("3. exports Score Recap, Monitoring, and Coverage reports", () => {
    // Score Recap
    const mockScore: ScoreRecapReportData = {
      contextInfo: baseContextInfo,
      hasActiveGradePolicy: true,
      gradePolicyStatus: "ACTIVE",
      assessments: [
        {
          id: "a-1",
          title: "UH 1",
          maxScore: 100,
          minimumPassingScore: 75,
          assessmentDate: new Date(),
          assessmentTypeName: "Ulangan Harian",
        },
      ],
      students: [
        {
          studentId: "s-1",
          fullName: "Ahmad Santoso",
          nis: "1001",
          isCurrentRoster: true,
          rosterStatusLabel: "Aktif di kelas",
          scoresByAssessmentId: {
            "a-1": {
              status: "GRADED",
              rawScore: 85,
              normalizedScore: 85,
              finalScore: 85,
              remedialAttemptsCount: 0,
            },
          },
          availableWeight: 20,
          runningPerformance: 85,
        },
      ],
    };
    const bufScore = exportScoreRecapToXlsx(mockScore);
    expect(bufScore.length).toBeGreaterThan(500);

    // Monitoring Report
    const mockMonitoring: MonitoringReportData = {
      contextInfo: baseContextInfo,
      students: [
        {
          studentId: "s-1",
          fullName: "Ahmad Santoso",
          nis: "1001",
          isCurrentRoster: true,
          rosterStatusLabel: "Aktif di kelas",
          attendance: { totalRecorded: 10, present: 9, late: 1, sick: 0, permission: 0, absent: 0 },
          assessment: { completedGradedCount: 2, belowKktpCount: 0, remedialAttemptsCount: 0, latestGradedScore: 85 },
          notesSummary: { totalNotes: 1, openFollowUpCount: 0, resolvedFollowUpCount: 1 },
          notes: [
            {
              id: "n-1",
              content: "Sangat aktif",
              requiresFollowUp: false,
              resolvedAt: null,
              isArchived: false,
              createdAt: new Date(),
            },
          ],
        },
      ],
    };
    const bufMonitoring = exportMonitoringReportToXlsx(mockMonitoring);
    expect(bufMonitoring.length).toBeGreaterThan(500);

    const wbMonitoring = XLSX.read(bufMonitoring, { type: "buffer" });
    expect(wbMonitoring.SheetNames).toContain("Rekap Monitoring");
    const wsMonitoring = wbMonitoring.Sheets["Rekap Monitoring"];
    const monitoringRows = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(wsMonitoring, { header: 1 });
    const monitoringHeaders = monitoringRows[7];

    // Assert NO percentage / fabricated formula in monitoring headers
    expect(monitoringHeaders).not.toContain("Presensi %");
    expect(monitoringHeaders).not.toContain("% Kehadiran");
    expect(monitoringHeaders).toContain("Total Presensi");
    expect(monitoringHeaders).toContain("Hadir");
    expect(monitoringHeaders).toContain("Terlambat");
    expect(monitoringHeaders).toContain("Sakit");
    expect(monitoringHeaders).toContain("Izin");
    expect(monitoringHeaders).toContain("Alpa");
    expect(monitoringHeaders).toContain("Total Ketidakhadiran");

    // Assert student data row uses factual integer counts only
    const studentMonitoringRow = monitoringRows[8];
    expect(studentMonitoringRow[4]).toBe(10); // Total Presensi
    expect(studentMonitoringRow[5]).toBe(9);  // Hadir
    expect(studentMonitoringRow[6]).toBe(1);  // Terlambat
    expect(studentMonitoringRow[7]).toBe(0);  // Sakit
    expect(studentMonitoringRow[8]).toBe(0);  // Izin
    expect(studentMonitoringRow[9]).toBe(0);  // Alpa
    expect(studentMonitoringRow[10]).toBe(0); // Total Ketidakhadiran (S+I+A)

    // Academic Coverage
    const mockCoverage: AcademicCoverageReportData = {
      contextInfo: {
        ...baseContextInfo,
        curriculumName: "Kurikulum Merdeka",
        phase: "E",
        academicNote: null,
        cpText: null,
      },
      totalObjectivesCount: 1,
      activeObjectivesCount: 1,
      archivedObjectivesCount: 0,
      objectives: [
        {
          id: "tp-1",
          code: "TP 1.1",
          description: "Eksponen",
          orderIndex: 0,
          status: "ACTIVE",
          completedTeachingSessionsCount: 2,
          latestTaughtDate: new Date("2026-08-10"),
          completedAssessmentsCount: 1,
        },
      ],
    };
    const bufCoverage = exportAcademicCoverageToXlsx(mockCoverage);
    expect(bufCoverage.length).toBeGreaterThan(500);

    const wbCoverage = XLSX.read(bufCoverage, { type: "buffer" });
    // Factual naming: "Cakupan Akademik", NOT "Ketercapaian Kurikulum"
    expect(wbCoverage.SheetNames).toContain("Cakupan Akademik");
    expect(wbCoverage.SheetNames).not.toContain("Ketercapaian TP");
    expect(wbCoverage.SheetNames).not.toContain("Ketercapaian Kurikulum");

    const wsCoverage = wbCoverage.Sheets["Cakupan Akademik"];
    const coverageRows = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(wsCoverage, { header: 1 });
    expect(coverageRows[0][0]).toBe("LAPORAN CAKUPAN AKADEMIK (TUJUAN PEMBELAJARAN)");
    expect(coverageRows[9]).toEqual([
      "No",
      "Kode TP",
      "Deskripsi Tujuan Pembelajaran",
      "Status",
      "Jumlah Pertemuan Selesai Terkait",
      "Tanggal Terakhir Diajarkan",
      "Jumlah Penilaian Selesai Terkait",
    ]);
  });

  it("4. generates safe filename", () => {
    const fn1 = generateSafeExportFilename("rekap_presensi", "X-MIPA-1");
    expect(fn1).toMatch(/^rekap_presensi_x-mipa-1_\d{4}-\d{2}-\d{2}\.xlsx$/);

    const fn2 = generateSafeExportFilename("cakupan_akademik", "X-MIPA-1_Matematika");
    expect(fn2).toMatch(/^cakupan_akademik_x-mipa-1_matematika_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});
