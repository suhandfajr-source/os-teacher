import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import {
  getTeachingJournalReport,
  getAttendanceRecapReport,
  getScoreRecapReport,
  getMonitoringReport,
  getAcademicCoverageReport,
} from "@/modules/reporting/reporting.actions";
import { ReportType } from "@/modules/reporting/reporting.types";
import { PrintButton } from "./PrintButton";

export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: ReportType;
    contextId?: string;
    startDate?: string;
    endDate?: string;
    studentSearch?: string;
  }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const params = await searchParams;
  const { type = "JOURNAL", contextId, startDate, endDate, studentSearch } = params;

  if (!contextId) {
    return <div className="p-8 text-center text-red-600">Parameter contextId tidak ditemukan.</div>;
  }

  // Server-side authorization
  const { context } = await verifyTeachingContextAccess(contextId);

  let journalData = null;
  let attendanceData = null;
  let scoreData = null;
  let monitoringData = null;
  let coverageData = null;

  if (type === "JOURNAL") {
    journalData = await getTeachingJournalReport(context.id, { startDate, endDate });
  } else if (type === "ATTENDANCE") {
    attendanceData = await getAttendanceRecapReport(context.id, { startDate, endDate, studentSearch });
  } else if (type === "SCORE") {
    scoreData = await getScoreRecapReport(context.id, { studentSearch });
  } else if (type === "MONITORING") {
    monitoringData = await getMonitoringReport(context.id, { studentSearch });
  } else if (type === "COVERAGE") {
    coverageData = await getAcademicCoverageReport(context.id);
  }

  const contextInfo =
    journalData?.contextInfo ||
    attendanceData?.contextInfo ||
    scoreData?.contextInfo ||
    monitoringData?.contextInfo ||
    coverageData?.contextInfo;

  return (
    <div className="min-h-screen bg-white text-black p-8 font-sans print:p-0">
      {/* Top action bar (hidden during print) */}
      <div className="mb-6 flex items-center justify-between border-b pb-4 print:hidden">
        <div>
          <h2 className="text-lg font-bold">Pratinjau Cetak Laporan</h2>
          <p className="text-xs text-gray-500">Gunakan dialog cetak browser untuk mencetak atau menyimpan sebagai PDF.</p>
        </div>
        <PrintButton />
      </div>

      {/* Header Info */}
      <div className="border-b-2 border-black pb-4 mb-6 text-center">
        <h1 className="text-xl font-bold uppercase tracking-wider">
          {type === "JOURNAL" && "JURNAL MENGAJAR GURU"}
          {type === "ATTENDANCE" && "REKAPITULASI PRESENSI SISWA"}
          {type === "SCORE" && "REKAPITULASI PENILAIAN & NILAI SISWA"}
          {type === "MONITORING" && "LAPORAN MONITORING SISWA"}
          {type === "COVERAGE" && "LAPORAN CAKUPAN AKADEMIK (TUJUAN PEMBELAJARAN)"}
        </h1>
        <p className="text-base font-semibold mt-1">{contextInfo?.schoolName}</p>
        <div className="grid grid-cols-2 text-xs mt-3 text-left max-w-xl mx-auto border-t pt-2 gap-1">
          <div><span className="font-semibold">Kelas:</span> {contextInfo?.className}</div>
          <div><span className="font-semibold">Mata Pelajaran:</span> {contextInfo?.subjectName}</div>
          <div><span className="font-semibold">Tahun / Semester:</span> {contextInfo?.academicPeriodYear} (Semester {contextInfo?.academicPeriodSemester})</div>
          <div><span className="font-semibold">Guru Pengampu:</span> {contextInfo?.teacherName}</div>
        </div>
      </div>

      {/* JURNAL PRINT */}
      {type === "JOURNAL" && journalData && (
        <table className="w-full text-xs border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-400 font-semibold">
              <th className="border border-gray-400 p-2 text-center w-8">No</th>
              <th className="border border-gray-400 p-2 text-left w-24">Tanggal</th>
              <th className="border border-gray-400 p-2 text-left w-16">Status</th>
              <th className="border border-gray-400 p-2 text-left">Materi / Topik</th>
              <th className="border border-gray-400 p-2 text-left">Aktivitas & Refleksi</th>
              <th className="border border-gray-400 p-2 text-left w-28">Presensi</th>
              <th className="border border-gray-400 p-2 text-left">Tujuan Pembelajaran</th>
            </tr>
          </thead>
          <tbody>
            {journalData.sessions.map((s, idx) => (
              <tr key={s.id} className="border-b border-gray-300">
                <td className="border border-gray-400 p-2 text-center">{idx + 1}</td>
                <td className="border border-gray-400 p-2 whitespace-nowrap">
                  {new Date(s.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td className="border border-gray-400 p-2">{s.status === "COMPLETED" ? "Selesai" : "Draft"}</td>
                <td className="border border-gray-400 p-2 font-medium">{s.actualTopic || s.plannedTopic || "-"}</td>
                <td className="border border-gray-400 p-2">
                  {s.activitySummary && <div>{s.activitySummary}</div>}
                  {s.reflection && <div className="italic text-[11px] text-gray-600 mt-1">Refleksi: {s.reflection}</div>}
                  {!s.activitySummary && !s.reflection && "-"}
                </td>
                <td className="border border-gray-400 p-2 font-mono">
                  {s.attendanceCounts.present}H / {s.attendanceCounts.late}T / {s.attendanceCounts.sick}S / {s.attendanceCounts.permission}I / {s.attendanceCounts.absent}A
                </td>
                <td className="border border-gray-400 p-2">
                  {s.objectives.length > 0
                    ? s.objectives.map((o) => (o.code ? `[${o.code}] ${o.description}` : o.description)).join("; ")
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ATTENDANCE PRINT */}
      {type === "ATTENDANCE" && attendanceData && (
        <table className="w-full text-xs border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-400 font-semibold">
              <th className="border border-gray-400 p-2 text-center w-8">No</th>
              <th className="border border-gray-400 p-2 text-left w-20">NIS</th>
              <th className="border border-gray-400 p-2 text-left">Nama Siswa</th>
              <th className="border border-gray-400 p-2 text-left w-24">Status</th>
              {attendanceData.sessions.map((s) => (
                <th key={s.id} className="border border-gray-400 p-1 text-center font-mono w-8">
                  {new Date(s.date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" })}
                </th>
              ))}
              <th className="border border-gray-400 p-1 text-center w-8">H</th>
              <th className="border border-gray-400 p-1 text-center w-8">T</th>
              <th className="border border-gray-400 p-1 text-center w-8">S</th>
              <th className="border border-gray-400 p-1 text-center w-8">I</th>
              <th className="border border-gray-400 p-1 text-center w-8">A</th>
            </tr>
          </thead>
          <tbody>
            {attendanceData.students.map((student, idx) => (
              <tr key={student.studentId} className="border-b border-gray-300">
                <td className="border border-gray-400 p-1 text-center">{idx + 1}</td>
                <td className="border border-gray-400 p-1 font-mono">{student.nis || "-"}</td>
                <td className="border border-gray-400 p-1 font-medium">{student.fullName}</td>
                <td className="border border-gray-400 p-1 text-[11px]">{student.rosterStatusLabel}</td>
                {attendanceData.sessions.map((s) => {
                  const rec = student.recordsBySessionId[s.id];
                  let label = "-";
                  if (rec) {
                    if (rec.status === "PRESENT") label = "H";
                    else if (rec.status === "LATE") label = "T";
                    else if (rec.status === "SICK") label = "S";
                    else if (rec.status === "PERMISSION") label = "I";
                    else if (rec.status === "ABSENT") label = "A";
                    else if (rec.status === "NOT_ENROLLED") label = "—";
                  }
                  return (
                    <td key={s.id} className="border border-gray-400 p-1 text-center font-mono">
                      {label}
                    </td>
                  );
                })}
                <td className="border border-gray-400 p-1 text-center font-mono font-semibold">{student.summary.presentCount}</td>
                <td className="border border-gray-400 p-1 text-center font-mono font-semibold">{student.summary.lateCount}</td>
                <td className="border border-gray-400 p-1 text-center font-mono font-semibold">{student.summary.sickCount}</td>
                <td className="border border-gray-400 p-1 text-center font-mono font-semibold">{student.summary.permissionCount}</td>
                <td className="border border-gray-400 p-1 text-center font-mono font-semibold">{student.summary.absentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* SCORE PRINT */}
      {type === "SCORE" && scoreData && (
        <table className="w-full text-xs border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-400 font-semibold">
              <th className="border border-gray-400 p-2 text-center w-8">No</th>
              <th className="border border-gray-400 p-2 text-left w-20">NIS</th>
              <th className="border border-gray-400 p-2 text-left">Nama Siswa</th>
              <th className="border border-gray-400 p-2 text-left w-24">Status</th>
              {scoreData.assessments.map((a) => (
                <th key={a.id} className="border border-gray-400 p-2 text-center">
                  <div>{a.title}</div>
                  <div className="text-[10px] font-normal">Max {a.maxScore}</div>
                </th>
              ))}
              {scoreData.hasActiveGradePolicy && (
                <>
                  <th className="border border-gray-400 p-2 text-center w-20">Bobot</th>
                  <th className="border border-gray-400 p-2 text-center w-24">Performa</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {scoreData.students.map((student, idx) => (
              <tr key={student.studentId} className="border-b border-gray-300">
                <td className="border border-gray-400 p-2 text-center">{idx + 1}</td>
                <td className="border border-gray-400 p-2 font-mono">{student.nis || "-"}</td>
                <td className="border border-gray-400 p-2 font-medium">{student.fullName}</td>
                <td className="border border-gray-400 p-2 text-[11px]">{student.rosterStatusLabel}</td>
                {scoreData.assessments.map((a) => {
                  const res = student.scoresByAssessmentId[a.id];
                  let label = "-";
                  if (res) {
                    if (res.status === "NOT_ENROLLED") label = "—";
                    else if (res.status === "ABSENT") label = "ABSEN";
                    else if (res.status === "EXCUSED") label = "DISPEN";
                    else if (res.status === "PENDING") label = "BELUM";
                    else if (res.finalScore !== null && res.finalScore !== undefined) {
                      label = String(res.finalScore);
                    }
                  }
                  return (
                    <td key={a.id} className="border border-gray-400 p-2 text-center font-mono font-semibold">
                      {label}
                    </td>
                  );
                })}
                {scoreData.hasActiveGradePolicy && (
                  <>
                    <td className="border border-gray-400 p-2 text-center font-mono">{student.availableWeight !== null ? `${student.availableWeight}%` : "-"}</td>
                    <td className="border border-gray-400 p-2 text-center font-mono font-bold">{student.runningPerformance !== null ? student.runningPerformance : "-"}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* MONITORING PRINT */}
      {type === "MONITORING" && monitoringData && (
        <table className="w-full text-xs border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-400 font-semibold">
              <th className="border border-gray-400 p-2 text-center w-8">No</th>
              <th className="border border-gray-400 p-2 text-left">Nama Siswa</th>
              <th className="border border-gray-400 p-2 text-left w-24">Status</th>
              <th className="border border-gray-400 p-2 text-center w-28">Presensi</th>
              <th className="border border-gray-400 p-2 text-center w-28">Penilaian</th>
              <th className="border border-gray-400 p-2 text-center w-28">Tindak Lanjut</th>
              <th className="border border-gray-400 p-2 text-left">Catatan Guru</th>
            </tr>
          </thead>
          <tbody>
            {monitoringData.students.map((student, idx) => (
              <tr key={student.studentId} className="border-b border-gray-300">
                <td className="border border-gray-400 p-2 text-center">{idx + 1}</td>
                <td className="border border-gray-400 p-2 font-medium">{student.fullName}</td>
                <td className="border border-gray-400 p-2 text-[11px]">{student.rosterStatusLabel}</td>
                <td className="border border-gray-400 p-2 text-center font-mono">
                  {student.attendance.present}H / {student.attendance.sick + student.attendance.permission + student.attendance.absent} Absen
                </td>
                <td className="border border-gray-400 p-2 text-center font-mono">
                  {student.assessment.completedGradedCount} selesai {student.assessment.belowKktpCount > 0 ? `(${student.assessment.belowKktpCount} < KKTP)` : ""}
                </td>
                <td className="border border-gray-400 p-2 text-center">
                  {student.notesSummary.openFollowUpCount > 0 ? `${student.notesSummary.openFollowUpCount} Terbuka` : `${student.notesSummary.totalNotes} Catatan`}
                </td>
                <td className="border border-gray-400 p-2">
                  {student.notes.length > 0 ? student.notes[0].content : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* COVERAGE PRINT */}
      {type === "COVERAGE" && coverageData && (
        <table className="w-full text-xs border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-400 font-semibold">
              <th className="border border-gray-400 p-2 text-center w-8">No</th>
              <th className="border border-gray-400 p-2 text-left w-20">Kode TP</th>
              <th className="border border-gray-400 p-2 text-left">Deskripsi Tujuan Pembelajaran</th>
              <th className="border border-gray-400 p-2 text-left w-20">Status</th>
              <th className="border border-gray-400 p-2 text-center w-32">Pertemuan Terkait Selesai</th>
              <th className="border border-gray-400 p-2 text-center w-32">Tanggal Terakhir Diajarkan</th>
              <th className="border border-gray-400 p-2 text-center w-32">Penilaian Terkait Selesai</th>
            </tr>
          </thead>
          <tbody>
            {coverageData.objectives.map((obj, idx) => (
              <tr key={obj.id} className="border-b border-gray-300">
                <td className="border border-gray-400 p-2 text-center">{idx + 1}</td>
                <td className="border border-gray-400 p-2 font-mono font-semibold">{obj.code || "-"}</td>
                <td className="border border-gray-400 p-2 font-medium">{obj.description}</td>
                <td className="border border-gray-400 p-2">{obj.status === "ACTIVE" ? "Aktif" : "Arsip"}</td>
                <td className="border border-gray-400 p-2 text-center font-mono font-semibold">{obj.completedTeachingSessionsCount} Sesi</td>
                <td className="border border-gray-400 p-2 text-center">
                  {obj.latestTaughtDate
                    ? new Date(obj.latestTaughtDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
                    : "-"}
                </td>
                <td className="border border-gray-400 p-2 text-center font-mono font-semibold">{obj.completedAssessmentsCount} Asesmen</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Footer Info */}
      <div className="mt-8 pt-4 border-t border-gray-300 text-[11px] text-gray-500 flex justify-between items-center print:mt-6">
        <div>AI Teacher Assistant — Laporan Pembelajaran Guru</div>
        <div>Tanggal Cetak: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
      </div>
    </div>
  );
}
