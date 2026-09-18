import * as XLSX from "xlsx";

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

/**
 * Generates and downloads a clean, professional Excel (.xlsx) spreadsheet
 * containing full student quiz results, class statistics, and KKM status.
 */
export function exportQuizRecapToExcel(options: QuizRecapExportOptions): void {
  const {
    quizTitle,
    contextLabel,
    standardScore,
    durationMinutes,
    questionCount,
    roster,
  } = options;

  const wb = XLSX.utils.book_new();

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

  const rows: (string | number)[][] = [
    ["REKAP NILAI KUIS ONLINE — KLASSA"],
    [],
    ["Judul Kuis", quizTitle],
    ["Kelas & Mapel", contextLabel],
    ["Jumlah Soal", `${questionCount} Soal Pilihan Ganda`],
    ["KKM / Standar Nilai", standardScore != null ? standardScore : "Tidak diatur"],
    ["Durasi Pengerjaan", durationMinutes ? `${durationMinutes} Menit` : "Bebas"],
    ["Tanggal Unduh", new Date().toLocaleDateString("id-ID", { dateStyle: "full" })],
    [],
    ["RINGKASAN HASIL KELAS"],
    ["Total Siswa", totalStudents],
    ["Sudah Mengerjakan", submittedCount],
    ["Belum Selesai", totalStudents - submittedCount],
    ["Tuntas (≥ KKM)", standardScore != null ? passedStudents.length : "-"],
    ["Remedial (< KKM)", standardScore != null ? remedialStudents.length : "-"],
    ["Rata-Rata Kelas", submittedCount > 0 ? averageScore : "-"],
    [],
    [
      "No",
      "Nama Siswa",
      "Status Pengerjaan",
      "Nilai Akhir (0-100)",
      "Keterangan KKM",
      "Waktu Selesai",
      "Catatan",
    ],
  ];

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

    rows.push([
      index + 1,
      student.fullName,
      statusText,
      student.score !== null ? student.score : "-",
      kkmText,
      submittedDateText,
      note,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Auto-fit column widths
  ws["!cols"] = [
    { wch: 6 },  // No
    { wch: 30 }, // Nama Siswa
    { wch: 22 }, // Status Pengerjaan
    { wch: 20 }, // Nilai Akhir
    { wch: 18 }, // Keterangan KKM
    { wch: 24 }, // Waktu Selesai
    { wch: 16 }, // Catatan
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Rekap Nilai");

  const safeFilename = `Rekap_Nilai_${quizTitle.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F]/g, "_")}.xlsx`;
  XLSX.writeFile(wb, safeFilename);
}
