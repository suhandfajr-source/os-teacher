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
    <div className="min-h-screen bg-white text-slate-900 p-8 font-sans print:p-0">
      {/* Top action bar (hidden during print) */}
      <div className="mb-6 flex items-center justify-between border-b pb-4 print:hidden">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Pratinjau Cetak Laporan</h2>
          <p className="text-xs text-slate-500">Gunakan dialog cetak browser untuk mencetak atau menyimpan sebagai PDF.</p>
        </div>
        <PrintButton />
      </div>

      {/* Header Info */}
      <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center">
        <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
          {type === "JOURNAL" && "JURNAL MENGAJAR GURU"}
          {type === "ATTENDANCE" && "REKAPITULASI PRESENSI SISWA"}
          {type === "SCORE" && "REKAPITULASI PENILAIAN & NILAI SISWA"}
          {type === "MONITORING" && "LAPORAN MONITORING SISWA"}
          {type === "COVERAGE" && "LAPORAN CAKUPAN AKADEMIK (TUJUAN PEMBELAJARAN)"}
        </h1>
        <p className="text-base font-semibold mt-1 text-slate-700">{contextInfo?.schoolName}</p>
        <div className="grid grid-cols-2 text-xs mt-3 text-left max-w-xl mx-auto border-t border-slate-200 pt-2 gap-1.5">
          <div><span className="font-semibold text-slate-600">Kelas:</span> {contextInfo?.className}</div>
          <div><span className="font-semibold text-slate-600">Mata Pelajaran:</span> {contextInfo?.subjectName}</div>
          <div><span className="font-semibold text-slate-600">Tahun / Semester:</span> {contextInfo?.academicPeriodYear} (Semester {contextInfo?.academicPeriodSemester})</div>
          <div><span className="font-semibold text-slate-600">Guru Pengampu:</span> {contextInfo?.teacherName}</div>
        </div>
      </div>

      {/* JURNAL PRINT */}
      {type === "JOURNAL" && journalData && (
        <table className="w-full text-xs border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-400 font-semibold text-slate-800">
              <th className="border border-slate-300 p-2 text-center w-8">No</th>
              <th className="border border-slate-300 p-2 text-left w-24">Tanggal</th>
              <th className="border border-slate-300 p-2 text-left w-16">Status</th>
              <th className="border border-slate-300 p-2 text-left">Materi / Topik</th>
              <th className="border border-slate-300 p-2 text-left">Aktivitas & Refleksi</th>
              <th className="border border-slate-300 p-2 text-left w-28">Presensi</th>
              <th className="border border-slate-300 p-2 text-left">Tujuan Pembelajaran</th>
            </tr>
          </thead>
          <tbody>
            {journalData.sessions.map((s, idx) => (
              <tr key={s.id} className={`border-b border-slate-200 ${idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}`}>
                <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                <td className="border border-slate-300 p-2 whitespace-nowrap font-medium">
                  {new Date(s.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td className="border border-slate-300 p-2">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      s.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {s.status === "COMPLETED" ? "Selesai" : "Draft"}
                  </span>
                </td>
                <td className="border border-slate-300 p-2 font-medium text-slate-900">{s.actualTopic || s.plannedTopic || "-"}</td>
                <td className="border border-slate-300 p-2">
                  {s.activitySummary && <div>{s.activitySummary}</div>}
                  {s.reflection && <div className="italic text-[11px] text-slate-500 mt-1">Refleksi: {s.reflection}</div>}
                  {!s.activitySummary && !s.reflection && "-"}
                </td>
                <td className="border border-slate-300 p-2 font-mono text-[11px]">
                  <span className="text-emerald-700 font-bold">{s.attendanceCounts.present}H</span> /{" "}
                  <span className="text-amber-700">{s.attendanceCounts.late}T</span> /{" "}
                  <span className="text-sky-700">{s.attendanceCounts.sick}S</span> /{" "}
                  <span className="text-violet-700">{s.attendanceCounts.permission}I</span> /{" "}
                  <span className="text-red-700 font-bold">{s.attendanceCounts.absent}A</span>
                </td>
                <td className="border border-slate-300 p-2">
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
        <table className="w-full text-xs border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-400 font-semibold text-slate-800">
              <th className="border border-slate-300 p-2 text-center w-8">No</th>
              <th className="border border-slate-300 p-2 text-left w-20">NIS</th>
              <th className="border border-slate-300 p-2 text-left">Nama Siswa</th>
              <th className="border border-slate-300 p-2 text-left w-24">Status</th>
              {attendanceData.sessions.map((s) => (
                <th key={s.id} className="border border-slate-300 p-1 text-center font-mono w-8">
                  {new Date(s.date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" })}
                </th>
              ))}
              <th className="border border-slate-300 p-1 text-center w-8 bg-emerald-50 text-emerald-800">H</th>
              <th className="border border-slate-300 p-1 text-center w-8 bg-amber-50 text-amber-800">T</th>
              <th className="border border-slate-300 p-1 text-center w-8 bg-sky-50 text-sky-800">S</th>
              <th className="border border-slate-300 p-1 text-center w-8 bg-violet-50 text-violet-800">I</th>
              <th className="border border-slate-300 p-1 text-center w-8 bg-red-50 text-red-800">A</th>
            </tr>
          </thead>
          <tbody>
            {attendanceData.students.map((student, idx) => (
              <tr key={student.studentId} className={`border-b border-slate-200 ${idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}`}>
                <td className="border border-slate-300 p-1 text-center">{idx + 1}</td>
                <td className="border border-slate-300 p-1 font-mono text-slate-600">{student.nis || "-"}</td>
                <td className="border border-slate-300 p-1 font-medium text-slate-900">{student.fullName}</td>
                <td className="border border-slate-300 p-1 text-[11px] text-slate-600">{student.rosterStatusLabel}</td>
                {attendanceData.sessions.map((s) => {
                  const rec = student.recordsBySessionId[s.id];
                  let label = "-";
                  let badgeClass = "text-slate-400";
                  if (rec) {
                    if (rec.status === "PRESENT") { label = "H"; badgeClass = "bg-emerald-100 text-emerald-800 font-bold"; }
                    else if (rec.status === "LATE") { label = "T"; badgeClass = "bg-amber-100 text-amber-800 font-bold"; }
                    else if (rec.status === "SICK") { label = "S"; badgeClass = "bg-sky-100 text-sky-800 font-bold"; }
                    else if (rec.status === "PERMISSION") { label = "I"; badgeClass = "bg-violet-100 text-violet-800 font-bold"; }
                    else if (rec.status === "ABSENT") { label = "A"; badgeClass = "bg-red-100 text-red-800 font-bold"; }
                    else if (rec.status === "NOT_ENROLLED") { label = "—"; badgeClass = "text-slate-300"; }
                  }
                  return (
                    <td key={s.id} className="border border-slate-300 p-1 text-center font-mono">
                      <span className={`inline-block w-5 h-5 leading-5 rounded text-[11px] ${badgeClass}`}>
                        {label}
                      </span>
                    </td>
                  );
                })}
                <td className="border border-slate-300 p-1 text-center font-mono font-bold text-emerald-700 bg-emerald-50/50">
                  {student.summary.presentCount}
                </td>
                <td className="border border-slate-300 p-1 text-center font-mono text-amber-700 bg-amber-50/50">
                  {student.summary.lateCount}
                </td>
                <td className="border border-slate-300 p-1 text-center font-mono text-sky-700 bg-sky-50/50">
                  {student.summary.sickCount}
                </td>
                <td className="border border-slate-300 p-1 text-center font-mono text-violet-700 bg-violet-50/50">
                  {student.summary.permissionCount}
                </td>
                <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${
                  student.summary.absentCount > 0 ? "bg-red-100 text-red-700" : "text-slate-400 bg-red-50/30"
                }`}>
                  {student.summary.absentCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* SCORE PRINT */}
      {type === "SCORE" && scoreData && (
        <table className="w-full text-xs border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-400 font-semibold text-slate-800">
              <th className="border border-slate-300 p-2 text-center w-8">No</th>
              <th className="border border-slate-300 p-2 text-left w-20">NIS</th>
              <th className="border border-slate-300 p-2 text-left">Nama Siswa</th>
              <th className="border border-slate-300 p-2 text-left w-24">Status</th>
              {scoreData.assessments.map((a) => (
                <th key={a.id} className="border border-slate-300 p-2 text-center">
                  <div>{a.title}</div>
                  <div className="text-[10px] font-normal text-slate-500">
                    Max {a.maxScore}{a.minimumPassingScore != null ? ` • KKM ${a.minimumPassingScore}` : ""}
                  </div>
                </th>
              ))}
              {scoreData.hasActiveGradePolicy && (
                <>
                  <th className="border border-slate-300 p-2 text-center w-20 bg-indigo-50 text-indigo-900">Bobot</th>
                  <th className="border border-slate-300 p-2 text-center w-24 bg-indigo-50 text-indigo-900">Performa</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {scoreData.students.map((student, idx) => (
              <tr key={student.studentId} className={`border-b border-slate-200 ${idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}`}>
                <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                <td className="border border-slate-300 p-2 font-mono text-slate-600">{student.nis || "-"}</td>
                <td className="border border-slate-300 p-2 font-medium text-slate-900">{student.fullName}</td>
                <td className="border border-slate-300 p-2 text-[11px] text-slate-600">{student.rosterStatusLabel}</td>
                {scoreData.assessments.map((a) => {
                  const res = student.scoresByAssessmentId[a.id];
                  let label = "-";
                  let isBelowKkm = false;
                  let isAbsent = false;
                  if (res) {
                    if (res.status === "NOT_ENROLLED") label = "—";
                    else if (res.status === "ABSENT") { label = "ABSEN"; isAbsent = true; }
                    else if (res.status === "EXCUSED") label = "DISPEN";
                    else if (res.status === "PENDING") label = "BELUM";
                    else if (res.finalScore !== null && res.finalScore !== undefined) {
                      label = String(res.finalScore);
                      if (a.minimumPassingScore != null && res.finalScore < a.minimumPassingScore) {
                        isBelowKkm = true;
                      }
                    }
                  }
                  return (
                    <td
                      key={a.id}
                      className={`border border-slate-300 p-2 text-center font-mono font-semibold ${
                        isBelowKkm || isAbsent
                          ? "bg-red-100 text-red-700 font-bold"
                          : res?.finalScore === 100
                          ? "bg-emerald-100 text-emerald-800 font-bold"
                          : "text-slate-800"
                      }`}
                    >
                      {label}
                    </td>
                  );
                })}
                {scoreData.hasActiveGradePolicy && (
                  <>
                    <td className="border border-slate-300 p-2 text-center font-mono text-slate-600 bg-indigo-50/30">
                      {student.availableWeight !== null ? `${student.availableWeight}%` : "-"}
                    </td>
                    <td className="border border-slate-300 p-2 text-center font-mono font-bold text-indigo-900 bg-indigo-50/50">
                      {student.runningPerformance !== null ? student.runningPerformance : "-"}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* MONITORING PRINT */}
      {type === "MONITORING" && monitoringData && (
        <table className="w-full text-xs border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-400 font-semibold text-slate-800">
              <th className="border border-slate-300 p-2 text-center w-8">No</th>
              <th className="border border-slate-300 p-2 text-left">Nama Siswa</th>
              <th className="border border-slate-300 p-2 text-left w-24">Status</th>
              <th className="border border-slate-300 p-2 text-center w-28">Presensi</th>
              <th className="border border-slate-300 p-2 text-center w-28">Penilaian</th>
              <th className="border border-slate-300 p-2 text-center w-28">Tindak Lanjut</th>
              <th className="border border-slate-300 p-2 text-left">Catatan Guru</th>
            </tr>
          </thead>
          <tbody>
            {monitoringData.students.map((student, idx) => {
              const totalAbsence = student.attendance.sick + student.attendance.permission + student.attendance.absent;
              const hasAlert = student.notesSummary.openFollowUpCount > 0 || student.assessment.belowKktpCount > 0;
              return (
                <tr key={student.studentId} className={`border-b border-slate-200 ${idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}`}>
                  <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                  <td className="border border-slate-300 p-2 font-medium text-slate-900">{student.fullName}</td>
                  <td className="border border-slate-300 p-2 text-[11px] text-slate-600">{student.rosterStatusLabel}</td>
                  <td className="border border-slate-300 p-2 text-center font-mono">
                    <span className="text-emerald-700 font-semibold">{student.attendance.present}H</span> /{" "}
                    <span className={totalAbsence > 0 ? "text-red-700 font-semibold" : "text-slate-500"}>
                      {totalAbsence} Absen
                    </span>
                  </td>
                  <td className="border border-slate-300 p-2 text-center font-mono">
                    <span>{student.assessment.completedGradedCount} selesai</span>{" "}
                    {student.assessment.belowKktpCount > 0 && (
                      <span className="inline-block px-1 py-0.2 rounded text-[10px] bg-red-100 text-red-700 font-bold ml-1">
                        {student.assessment.belowKktpCount} &lt; KKTP
                      </span>
                    )}
                  </td>
                  <td className="border border-slate-300 p-2 text-center">
                    {student.notesSummary.openFollowUpCount > 0 ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">
                        {student.notesSummary.openFollowUpCount} Terbuka
                      </span>
                    ) : (
                      <span className="text-slate-500">{student.notesSummary.totalNotes} Catatan</span>
                    )}
                  </td>
                  <td className={`border border-slate-300 p-2 ${hasAlert ? "bg-amber-50/40" : ""}`}>
                    {student.notes.length > 0 ? student.notes[0].content : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* COVERAGE PRINT */}
      {type === "COVERAGE" && coverageData && (
        <table className="w-full text-xs border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-400 font-semibold text-slate-800">
              <th className="border border-slate-300 p-2 text-center w-8">No</th>
              <th className="border border-slate-300 p-2 text-left w-20">Kode TP</th>
              <th className="border border-slate-300 p-2 text-left">Deskripsi Tujuan Pembelajaran</th>
              <th className="border border-slate-300 p-2 text-left w-20">Status</th>
              <th className="border border-slate-300 p-2 text-center w-32">Pertemuan Terkait</th>
              <th className="border border-slate-300 p-2 text-center w-32">Tanggal Terakhir</th>
              <th className="border border-slate-300 p-2 text-center w-32">Penilaian Terkait</th>
            </tr>
          </thead>
          <tbody>
            {coverageData.objectives.map((obj, idx) => (
              <tr key={obj.id} className={`border-b border-slate-200 ${idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}`}>
                <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                <td className="border border-slate-300 p-2 font-mono font-bold text-indigo-900">{obj.code || "-"}</td>
                <td className="border border-slate-300 p-2 font-medium text-slate-900">{obj.description}</td>
                <td className="border border-slate-300 p-2">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      obj.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {obj.status === "ACTIVE" ? "Aktif" : "Arsip"}
                  </span>
                </td>
                <td className="border border-slate-300 p-2 text-center font-mono font-semibold text-slate-800">
                  {obj.completedTeachingSessionsCount} Sesi
                </td>
                <td className="border border-slate-300 p-2 text-center text-slate-600">
                  {obj.latestTaughtDate
                    ? new Date(obj.latestTaughtDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
                    : "-"}
                </td>
                <td className="border border-slate-300 p-2 text-center font-mono font-semibold text-slate-800">
                  {obj.completedAssessmentsCount} Asesmen
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Signature & Official Validation Block */}
      <div className="mt-10 pt-6 border-t border-slate-300 grid grid-cols-2 text-xs">
        <div className="text-left space-y-1">
          <p>Mengetahui,</p>
          <p className="font-bold">Kepala Sekolah,</p>
          <div className="h-16"></div>
          <p className="font-bold underline">( ............................................................ )</p>
          <p className="text-slate-500">NIP. ........................................................</p>
        </div>
        <div className="text-right space-y-1">
          <p>Ditetapkan tanggal: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p className="font-bold">Guru Mata Pelajaran,</p>
          <div className="h-16"></div>
          <p className="font-bold underline">( {contextInfo?.teacherName} )</p>
          <p className="text-slate-500">NIP. ........................................................</p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 pt-4 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between items-center print:mt-6">
        <div>KLASSA — Laporan Pembelajaran Guru</div>
        <div>Dicetak otomatis melalui Sistem Informasi Akademik KLASSA</div>
      </div>
    </div>
  );
}
