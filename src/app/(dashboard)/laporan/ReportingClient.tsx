"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Printer,
  Search,
  FileText,
  Users,
  CheckSquare,
  UserCheck,
  GraduationCap,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ReportType,
  TeachingJournalReportData,
  AttendanceRecapReportData,
  ScoreRecapReportData,
  MonitoringReportData,
  AcademicCoverageReportData,
} from "@/modules/reporting/reporting.types";

interface ContextOption {
  id: string;
  className: string;
  subjectName: string;
  academicPeriodYear: string;
  academicPeriodSemester: string;
}

interface Props {
  contexts: ContextOption[];
  initialContextId?: string;
  initialReportType?: ReportType;
  journalData?: TeachingJournalReportData | null;
  attendanceData?: AttendanceRecapReportData | null;
  scoreData?: ScoreRecapReportData | null;
  monitoringData?: MonitoringReportData | null;
  coverageData?: AcademicCoverageReportData | null;
}

export default function ReportingClient({
  contexts,
  initialContextId,
  initialReportType = "JOURNAL",
  journalData,
  attendanceData,
  scoreData,
  monitoringData,
  coverageData,
}: Props) {
  const router = useRouter();

  const [selectedContextId, setSelectedContextId] = useState<string>(
    initialContextId || (contexts.length > 0 ? contexts[0].id : "")
  );

  const [reportType, setReportType] = useState<ReportType>(initialReportType);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [studentSearch, setStudentSearch] = useState<string>("");

  const handleContextChange = (newContextId: string) => {
    setSelectedContextId(newContextId);
    router.push(`/laporan?contextId=${newContextId}&type=${reportType}`);
  };

  const handleReportTypeChange = (type: ReportType) => {
    setReportType(type);
    router.push(`/laporan?contextId=${selectedContextId}&type=${type}`);
  };

  const handleApplyFilter = () => {
    const params = new URLSearchParams();
    if (selectedContextId) params.set("contextId", selectedContextId);
    if (reportType) params.set("type", reportType);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (studentSearch) params.set("studentSearch", studentSearch);
    router.push(`/laporan?${params.toString()}`);
  };

  // Build Export & Print URLs
  const buildExportUrl = () => {
    const params = new URLSearchParams();
    params.set("type", reportType);
    params.set("contextId", selectedContextId);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (studentSearch) params.set("studentSearch", studentSearch);
    return `/api/reports/export/xlsx?${params.toString()}`;
  };

  const buildPrintUrl = () => {
    const params = new URLSearchParams();
    params.set("type", reportType);
    params.set("contextId", selectedContextId);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (studentSearch) params.set("studentSearch", studentSearch);
    return `/laporan/print?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laporan & Rekapitulasi Guru</h1>
          <p className="text-sm text-muted-foreground">
            Laporan pembelajaran factual yang diturunkan langsung dari aktivitas harian kelas Anda.
          </p>
        </div>

        {/* Context Selector */}
        {contexts.length > 0 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="report-context-select" className="text-xs font-semibold uppercase text-muted-foreground whitespace-nowrap">
              Kelas:
            </Label>
            <select
              id="report-context-select"
              value={selectedContextId}
              onChange={(e) => handleContextChange(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {contexts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.className} • {c.subjectName} ({c.academicPeriodYear})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {contexts.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent className="space-y-3">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">Belum Ada Kelas Pembelajaran</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Silakan buat kelas atau hubungkan mata pelajaran terlebih dahulu untuk melihat laporan.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Report Type Selector Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <button
              onClick={() => handleReportTypeChange("JOURNAL")}
              className={`p-3 rounded-lg border text-left transition-all flex flex-col gap-1.5 ${
                reportType === "JOURNAL"
                  ? "bg-primary/10 border-primary text-primary font-semibold shadow-sm"
                  : "bg-card hover:bg-muted/50 border-border text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-xs">Jurnal Mengajar</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-normal">Aktivitas pertemuan guru</span>
            </button>

            <button
              onClick={() => handleReportTypeChange("ATTENDANCE")}
              className={`p-3 rounded-lg border text-left transition-all flex flex-col gap-1.5 ${
                reportType === "ATTENDANCE"
                  ? "bg-primary/10 border-primary text-primary font-semibold shadow-sm"
                  : "bg-card hover:bg-muted/50 border-border text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-xs">Rekap Presensi</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-normal">Matriks kehadiran siswa</span>
            </button>

            <button
              onClick={() => handleReportTypeChange("SCORE")}
              className={`p-3 rounded-lg border text-left transition-all flex flex-col gap-1.5 ${
                reportType === "SCORE"
                  ? "bg-primary/10 border-primary text-primary font-semibold shadow-sm"
                  : "bg-card hover:bg-muted/50 border-border text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                <span className="text-xs">Rekap Nilai</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-normal">Nilai asesmen & performa</span>
            </button>

            <button
              onClick={() => handleReportTypeChange("MONITORING")}
              className={`p-3 rounded-lg border text-left transition-all flex flex-col gap-1.5 ${
                reportType === "MONITORING"
                  ? "bg-primary/10 border-primary text-primary font-semibold shadow-sm"
                  : "bg-card hover:bg-muted/50 border-border text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                <span className="text-xs">Monitoring Siswa</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-normal">Catatan tindak lanjut</span>
            </button>

            <button
              onClick={() => handleReportTypeChange("COVERAGE")}
              className={`p-3 rounded-lg border text-left transition-all flex flex-col gap-1.5 ${
                reportType === "COVERAGE"
                  ? "bg-primary/10 border-primary text-primary font-semibold shadow-sm"
                  : "bg-card hover:bg-muted/50 border-border text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                <span className="text-xs">Cakupan Akademik</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-normal">Cakupan tujuan kurikulum</span>
            </button>
          </div>

          {/* Action & Filter Bar */}
          <Card className="bg-muted/30 border">
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {(reportType === "JOURNAL" || reportType === "ATTENDANCE") && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Tanggal:</span>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-8 w-32 text-xs"
                    />
                    <span>s/d</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-8 w-32 text-xs"
                    />
                  </div>
                )}

                {(reportType === "ATTENDANCE" || reportType === "SCORE" || reportType === "MONITORING") && (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Cari nama siswa / NIS..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="h-8 pl-8 w-48 text-xs"
                      />
                    </div>
                  </div>
                )}

                <Button size="sm" variant="secondary" onClick={handleApplyFilter} className="h-8 text-xs">
                  Terapkan Filter
                </Button>
              </div>

              {/* Export & Print Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <a href={buildExportUrl()} download>
                  <Button size="sm" variant="outline" className="h-8 text-xs flex items-center gap-1.5 bg-background">
                    <Download className="h-3.5 w-3.5 text-emerald-600" />
                    Unduh Excel (.xlsx)
                  </Button>
                </a>
                <a href={buildPrintUrl()} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="h-8 text-xs flex items-center gap-1.5 bg-background">
                    <Printer className="h-3.5 w-3.5" />
                    Cetak / Simpan PDF
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* REPORT VIEWPORT */}

          {/* 1. JURNAL MENGAJAR */}
          {reportType === "JOURNAL" && journalData && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">Jurnal Pembelajaran Guru</CardTitle>
                    <CardDescription className="text-xs">
                      {journalData.contextInfo.className} • {journalData.contextInfo.subjectName} • Tahun {journalData.contextInfo.academicPeriodYear} (Semester {journalData.contextInfo.academicPeriodSemester})
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      Total: {journalData.totalSessions} Pertemuan
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      {journalData.completedSessionsCount} Selesai
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {journalData.sessions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Belum ada pertemuan pembelajaran yang tercatat pada rentang waktu ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                          <th className="px-3 py-3 text-left w-10">No</th>
                          <th className="px-3 py-3 text-left w-24">Tanggal</th>
                          <th className="px-3 py-3 text-left w-20">Status</th>
                          <th className="px-3 py-3 text-left">Materi / Topik</th>
                          <th className="px-3 py-3 text-left">Aktivitas & Refleksi</th>
                          <th className="px-3 py-3 text-left w-36">Presensi</th>
                          <th className="px-3 py-3 text-left">Tujuan Pembelajaran</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {journalData.sessions.map((s, idx: number) => (
                          <tr key={s.id} className="hover:bg-muted/10">
                            <td className="px-3 py-3 text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="px-3 py-3 font-medium whitespace-nowrap">
                              {new Date(s.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-3 py-3">
                              {s.status === "COMPLETED" ? (
                                <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                  Selesai
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                                  Draft
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-3 font-medium">
                              {s.actualTopic || s.plannedTopic || "-"}
                            </td>
                            <td className="px-3 py-3 space-y-1 max-w-xs">
                              {s.activitySummary && <p className="text-muted-foreground">{s.activitySummary}</p>}
                              {s.reflection && (
                                <p className="text-[11px] italic text-muted-foreground/80">Refleksi: {s.reflection}</p>
                              )}
                              {!s.activitySummary && !s.reflection && <span className="text-muted-foreground">-</span>}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="font-mono text-[11px]">
                                <span className="text-emerald-600 font-semibold">{s.attendanceCounts.present}H</span> /{" "}
                                <span className="text-amber-600">{s.attendanceCounts.late}T</span> /{" "}
                                <span className="text-blue-600">{s.attendanceCounts.sick}S</span> /{" "}
                                <span className="text-indigo-600">{s.attendanceCounts.permission}I</span> /{" "}
                                <span className="text-red-600 font-semibold">{s.attendanceCounts.absent}A</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              {s.objectives.length === 0 ? (
                                <span className="text-muted-foreground">-</span>
                              ) : (
                                <div className="space-y-1">
                                  {s.objectives.map((obj) => (
                                    <div key={obj.id} className="text-[11px]">
                                      {obj.code && <span className="font-semibold text-primary">[{obj.code}] </span>}
                                      <span>{obj.description}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 2. REKAP PRESENSI */}
          {reportType === "ATTENDANCE" && attendanceData && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">Rekapitulasi Presensi Siswa</CardTitle>
                    <CardDescription className="text-xs">
                      {attendanceData.contextInfo.className} • {attendanceData.contextInfo.subjectName} • {attendanceData.sessions.length} Pertemuan Tercatat
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {attendanceData.students.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Belum ada data siswa atau presensi pertemuan yang tercatat.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                          <th className="px-3 py-2 text-left w-8">No</th>
                          <th className="px-3 py-2 text-left w-20">NIS</th>
                          <th className="px-3 py-2 text-left min-w-[150px]">Nama Siswa</th>
                          <th className="px-3 py-2 text-left w-28">Status</th>
                          {attendanceData.sessions.map((s) => (
                            <th key={s.id} className="px-2 py-2 text-center w-10 font-mono" title={s.actualTopic || s.plannedTopic || ""}>
                              {new Date(s.date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" })}
                            </th>
                          ))}
                          <th className="px-2 py-2 text-center w-10 font-semibold text-emerald-700 bg-emerald-50/50">H</th>
                          <th className="px-2 py-2 text-center w-10 font-semibold text-amber-700 bg-amber-50/50">T</th>
                          <th className="px-2 py-2 text-center w-10 font-semibold text-blue-700 bg-blue-50/50">S</th>
                          <th className="px-2 py-2 text-center w-10 font-semibold text-indigo-700 bg-indigo-50/50">I</th>
                          <th className="px-2 py-2 text-center w-10 font-semibold text-red-700 bg-red-50/50">A</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {attendanceData.students.map((student, idx: number) => (
                          <tr key={student.studentId} className={`hover:bg-muted/10 ${!student.isCurrentRoster ? "bg-muted/5" : ""}`}>
                            <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">{student.nis || "-"}</td>
                            <td className="px-3 py-2 font-medium">{student.fullName}</td>
                            <td className="px-3 py-2">
                              {student.isCurrentRoster ? (
                                <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200">
                                  Aktif di kelas
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                                  {student.rosterStatusLabel}
                                </Badge>
                              )}
                            </td>
                            {attendanceData.sessions.map((s) => {
                              const rec = student.recordsBySessionId[s.id];
                              let label = "-";
                              let color = "text-muted-foreground";

                              if (rec) {
                                if (rec.status === "PRESENT") {
                                  label = "H";
                                  color = "text-emerald-700 font-semibold";
                                } else if (rec.status === "LATE") {
                                  label = "T";
                                  color = "text-amber-700 font-semibold";
                                } else if (rec.status === "SICK") {
                                  label = "S";
                                  color = "text-blue-700 font-semibold";
                                } else if (rec.status === "PERMISSION") {
                                  label = "I";
                                  color = "text-indigo-700 font-semibold";
                                } else if (rec.status === "ABSENT") {
                                  label = "A";
                                  color = "text-red-700 font-semibold";
                                } else if (rec.status === "NOT_ENROLLED") {
                                  label = "—";
                                  color = "text-muted-foreground/50";
                                }
                              }

                              return (
                                <td key={s.id} className={`px-2 py-2 text-center font-mono ${color}`}>
                                  {label}
                                </td>
                              );
                            })}
                            <td className="px-2 py-2 text-center font-mono font-semibold text-emerald-700 bg-emerald-50/20">
                              {student.summary.presentCount}
                            </td>
                            <td className="px-2 py-2 text-center font-mono font-semibold text-amber-700 bg-amber-50/20">
                              {student.summary.lateCount}
                            </td>
                            <td className="px-2 py-2 text-center font-mono font-semibold text-blue-700 bg-blue-50/20">
                              {student.summary.sickCount}
                            </td>
                            <td className="px-2 py-2 text-center font-mono font-semibold text-indigo-700 bg-indigo-50/20">
                              {student.summary.permissionCount}
                            </td>
                            <td className="px-2 py-2 text-center font-mono font-semibold text-red-700 bg-red-50/20">
                              {student.summary.absentCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 3. REKAP NILAI */}
          {reportType === "SCORE" && scoreData && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">Rekapitulasi Penilaian Siswa</CardTitle>
                    <CardDescription className="text-xs">
                      {scoreData.contextInfo.className} • {scoreData.contextInfo.subjectName} • {scoreData.assessments.length} Penilaian Selesai
                    </CardDescription>
                  </div>
                  {scoreData.hasActiveGradePolicy ? (
                    <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      Skema Bobot Aktif
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Tanpa Skema Bobot
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {scoreData.students.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Belum ada penilaian selesai atau siswa pada kelas ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                          <th className="px-3 py-2 text-left w-8">No</th>
                          <th className="px-3 py-2 text-left w-20">NIS</th>
                          <th className="px-3 py-2 text-left min-w-[150px]">Nama Siswa</th>
                          <th className="px-3 py-2 text-left w-28">Status</th>
                          {scoreData.assessments.map((a) => (
                            <th key={a.id} className="px-3 py-2 text-center min-w-[100px]">
                              <div className="font-semibold">{a.title}</div>
                              <div className="text-[10px] text-muted-foreground font-normal">
                                Max {a.maxScore} {a.minimumPassingScore ? `• KKTP ${a.minimumPassingScore}` : ""}
                              </div>
                            </th>
                          ))}
                          {scoreData.hasActiveGradePolicy && (
                            <>
                              <th className="px-3 py-2 text-center w-24 bg-muted/20">Bobot Tersedia</th>
                              <th className="px-3 py-2 text-center w-28 bg-primary/5 text-primary font-semibold">
                                Performa Berdasarkan Komponen
                              </th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {scoreData.students.map((student, idx: number) => (
                          <tr key={student.studentId} className={`hover:bg-muted/10 ${!student.isCurrentRoster ? "bg-muted/5" : ""}`}>
                            <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">{student.nis || "-"}</td>
                            <td className="px-3 py-2 font-medium">{student.fullName}</td>
                            <td className="px-3 py-2">
                              {student.isCurrentRoster ? (
                                <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200">
                                  Aktif di kelas
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                                  {student.rosterStatusLabel}
                                </Badge>
                              )}
                            </td>
                            {scoreData.assessments.map((a) => {
                              const res = student.scoresByAssessmentId[a.id];
                              let label = "-";
                              let subText = "";
                              let color = "text-foreground";

                              if (res) {
                                if (res.status === "NOT_ENROLLED") {
                                  label = "—";
                                  color = "text-muted-foreground/50";
                                } else if (res.status === "ABSENT") {
                                  label = "ABSEN";
                                  color = "text-red-600 font-semibold";
                                } else if (res.status === "EXCUSED") {
                                  label = "DISPEN";
                                  color = "text-blue-600 font-semibold";
                                } else if (res.status === "PENDING") {
                                  label = "BELUM";
                                  color = "text-amber-600";
                                } else if (res.finalScore !== null && res.finalScore !== undefined) {
                                  label = String(res.finalScore);
                                  if (a.minimumPassingScore && res.finalScore < a.minimumPassingScore) {
                                    color = "text-red-600 font-semibold";
                                  } else {
                                    color = "text-emerald-700 font-semibold";
                                  }
                                  if (res.remedialAttemptsCount > 0) {
                                    subText = `(R${res.remedialAttemptsCount})`;
                                  }
                                }
                              }

                              return (
                                <td key={a.id} className={`px-3 py-2 text-center font-mono ${color}`}>
                                  <div>{label}</div>
                                  {subText && <div className="text-[9px] text-muted-foreground">{subText}</div>}
                                </td>
                              );
                            })}
                            {scoreData.hasActiveGradePolicy && (
                              <>
                                <td className="px-3 py-2 text-center font-mono text-muted-foreground bg-muted/10">
                                  {student.availableWeight !== null ? `${student.availableWeight}%` : "-"}
                                </td>
                                <td className="px-3 py-2 text-center font-mono font-bold text-primary bg-primary/5">
                                  {student.runningPerformance !== null ? student.runningPerformance : "-"}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 4. MONITORING SISWA */}
          {reportType === "MONITORING" && monitoringData && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base">Laporan Monitoring & Tindak Lanjut Siswa</CardTitle>
                <CardDescription className="text-xs">
                  {monitoringData.contextInfo.className} • {monitoringData.contextInfo.subjectName} • Catatan bersifat privat bagi guru
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {monitoringData.students.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Belum ada siswa pada kelas ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                          <th className="px-3 py-2 text-left w-8">No</th>
                          <th className="px-3 py-2 text-left min-w-[150px]">Nama Siswa</th>
                          <th className="px-3 py-2 text-left w-28">Status Roster</th>
                          <th className="px-3 py-2 text-center w-28">Presensi</th>
                          <th className="px-3 py-2 text-center w-28">Penilaian</th>
                          <th className="px-3 py-2 text-center w-28">Catatan Tindak Lanjut</th>
                          <th className="px-3 py-2 text-left">Catatan Guru Terbaru</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {monitoringData.students.map((student, idx: number) => {
                          const totalAbsence = student.attendance.sick + student.attendance.permission + student.attendance.absent;
                          return (
                            <tr key={student.studentId} className="hover:bg-muted/10">
                              <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                              <td className="px-3 py-2 font-medium">{student.fullName}</td>
                              <td className="px-3 py-2">
                                {student.isCurrentRoster ? (
                                  <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200">
                                    Aktif di kelas
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                                    {student.rosterStatusLabel}
                                  </Badge>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="font-mono text-emerald-700 font-semibold">{student.attendance.present}H</span>
                                {totalAbsence > 0 && (
                                  <span className="font-mono text-red-600 font-semibold"> / {totalAbsence} absen</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="font-mono">{student.assessment.completedGradedCount} selesai</span>
                                {student.assessment.belowKktpCount > 0 && (
                                  <span className="font-mono text-red-600 block text-[10px]">
                                    {student.assessment.belowKktpCount} &lt; KKTP
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {student.notesSummary.openFollowUpCount > 0 ? (
                                  <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">
                                    {student.notesSummary.openFollowUpCount} Butuh TL
                                  </Badge>
                                ) : student.notesSummary.totalNotes > 0 ? (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                    {student.notesSummary.totalNotes} Catatan
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2 max-w-sm">
                                {student.notes.length > 0 ? (
                                  <div className="space-y-0.5">
                                    <p className="line-clamp-1">{student.notes[0].content}</p>
                                    <span className="text-[10px] text-muted-foreground">
                                      {new Date(student.notes[0].createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 5. CAKUPAN AKADEMIK (TUJUAN PEMBELAJARAN) */}
          {reportType === "COVERAGE" && coverageData && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">Laporan Cakupan Akademik (Tujuan Pembelajaran)</CardTitle>
                    <CardDescription className="text-xs">
                      {coverageData.contextInfo.className} • {coverageData.contextInfo.subjectName} • {coverageData.totalObjectivesCount} Tujuan Pembelajaran Terdaftar
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {coverageData.objectives.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Belum ada Tujuan Pembelajaran yang ditambahkan pada kelas ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                          <th className="px-3 py-2 text-left w-8">No</th>
                          <th className="px-3 py-2 text-left w-20">Kode TP</th>
                          <th className="px-3 py-2 text-left">Deskripsi Tujuan Pembelajaran</th>
                          <th className="px-3 py-2 text-left w-20">Status</th>
                          <th className="px-3 py-2 text-center w-36">Pertemuan Terkait Selesai</th>
                          <th className="px-3 py-2 text-center w-36">Tanggal Terakhir Diajarkan</th>
                          <th className="px-3 py-2 text-center w-36">Penilaian Terkait Selesai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {coverageData.objectives.map((obj, idx: number) => (
                          <tr key={obj.id} className="hover:bg-muted/10">
                            <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono font-semibold text-primary">{obj.code || "-"}</td>
                            <td className="px-3 py-2 font-medium">{obj.description}</td>
                            <td className="px-3 py-2">
                              {obj.status === "ACTIVE" ? (
                                <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200">
                                  Aktif
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                                  Arsip
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-semibold">
                              {obj.completedTeachingSessionsCount > 0 ? (
                                <span className="text-emerald-700">{obj.completedTeachingSessionsCount} Sesi</span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center text-muted-foreground">
                              {obj.latestTaughtDate
                                ? new Date(obj.latestTaughtDate).toLocaleDateString("id-ID", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "-"}
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-semibold">
                              {obj.completedAssessmentsCount > 0 ? (
                                <span className="text-primary">{obj.completedAssessmentsCount} Asesmen</span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
