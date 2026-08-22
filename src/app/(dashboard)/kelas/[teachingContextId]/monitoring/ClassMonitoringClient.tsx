"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { StudentMonitoringRow, ClassMonitoringSummaryMetrics } from "@/modules/monitoring/monitoring.types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Users,
  AlertCircle,
  AlertTriangle,
  Search,
  ChevronRight,
  Award,
  Calendar,
} from "lucide-react";

type FilterMode = "ALL" | "BELOW_KKTP" | "REMEDIAL" | "ABSENCE" | "OPEN_FOLLOWUP";

interface ClassMonitoringClientProps {
  initialData: {
    context: {
      id: string;
      class: { name: string };
      subject: { name: string };
      academicPeriod: { year: string; semester: string };
    };
    rows: StudentMonitoringRow[];
    metrics: ClassMonitoringSummaryMetrics;
    hasActiveGradePolicy: boolean;
  };
}

export function ClassMonitoringClient({ initialData }: ClassMonitoringClientProps) {
  const { context, rows, metrics, hasActiveGradePolicy } = initialData;

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("ALL");

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Search match
      const matchSearch =
        row.fullName.toLowerCase().includes(search.toLowerCase()) ||
        (row.nis && row.nis.toLowerCase().includes(search.toLowerCase()));

      if (!matchSearch) return false;

      // Filter match
      if (filterMode === "BELOW_KKTP") {
        return row.assessment.belowKktpCount > 0;
      }
      if (filterMode === "REMEDIAL") {
        return row.assessment.remedialCount > 0;
      }
      if (filterMode === "ABSENCE") {
        return row.attendance.absentCount + row.attendance.sickCount + row.attendance.permissionCount > 0;
      }
      if (filterMode === "OPEN_FOLLOWUP") {
        return row.openFollowUpCount > 0;
      }

      return true;
    });
  }, [rows, search, filterMode]);

  return (
    <div className="space-y-6 pb-16">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monitoring Kelas: {context.class.name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Mata Pelajaran: <span className="font-semibold text-foreground">{context.subject.name}</span> &bull; Tahun
            Ajaran: <span className="font-semibold text-foreground">{context.academicPeriod.year}</span> (Semester{" "}
            {context.academicPeriod.semester})
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/kelas/${context.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Kembali ke Dashboard Kelas
          </Link>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <Card
          className={`cursor-pointer transition-all ${
            filterMode === "ALL" ? "ring-2 ring-primary border-primary bg-primary/5" : "hover:border-slate-300"
          }`}
          onClick={() => setFilterMode("ALL")}
        >
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              Total Siswa
            </div>
            <div className="text-2xl font-bold">{metrics.totalCurrentStudents}</div>
            <div className="text-[11px] text-muted-foreground">Anggota aktif</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            filterMode === "OPEN_FOLLOWUP"
              ? "ring-2 ring-amber-500 border-amber-500 bg-amber-50/50"
              : "hover:border-slate-300"
          }`}
          onClick={() => setFilterMode("OPEN_FOLLOWUP")}
        >
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-amber-800 font-medium flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Tindak Lanjut
            </div>
            <div className="text-2xl font-bold text-amber-700">{metrics.studentsWithOpenFollowUp}</div>
            <div className="text-[11px] text-muted-foreground">Siswa perlu respon</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            filterMode === "BELOW_KKTP"
              ? "ring-2 ring-rose-500 border-rose-500 bg-rose-50/50"
              : "hover:border-slate-300"
          }`}
          onClick={() => setFilterMode("BELOW_KKTP")}
        >
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-rose-800 font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              Di Bawah KKTP
            </div>
            <div className="text-2xl font-bold text-rose-700">{metrics.studentsWithBelowKktp}</div>
            <div className="text-[11px] text-muted-foreground">Siswa perlu perbaikan</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            filterMode === "REMEDIAL"
              ? "ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/50"
              : "hover:border-slate-300"
          }`}
          onClick={() => setFilterMode("REMEDIAL")}
        >
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-indigo-800 font-medium flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-indigo-600" />
              Pernah Remedial
            </div>
            <div className="text-2xl font-bold text-indigo-700">{metrics.studentsWithRemedial}</div>
            <div className="text-[11px] text-muted-foreground">Siswa ada riwayat</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all col-span-2 sm:col-span-1 ${
            filterMode === "ABSENCE"
              ? "ring-2 ring-slate-700 border-slate-700 bg-slate-100/50"
              : "hover:border-slate-300"
          }`}
          onClick={() => setFilterMode("ABSENCE")}
        >
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Ketidakhadiran
            </div>
            <div className="text-2xl font-bold text-slate-800">{metrics.studentsWithAbsence}</div>
            <div className="text-[11px] text-muted-foreground">Sakit / Izin / Alpa</div>
          </CardContent>
        </Card>
      </div>

      {/* Grade Policy Status Info Banner */}
      {!hasActiveGradePolicy && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Belum ada bobot nilai aktif</strong> untuk kelas ini. Monitoring kehadiran dan hasil penilaian tetap
              berfungsi penuh.
            </span>
          </div>
          <Link
            href={`/kelas/${context.id}/pengaturan-nilai`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 text-xs bg-white shrink-0")}
          >
            Atur Bobot
          </Link>
        </div>
      )}

      {/* Controls: Search and Filter Pills */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama siswa atau NIS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>

        {/* Factual Filter Pills */}
        <div className="flex flex-wrap gap-1.5 items-center w-full md:w-auto">
          <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Filter:</span>
          <Button
            size="sm"
            variant={filterMode === "ALL" ? "default" : "outline"}
            onClick={() => setFilterMode("ALL")}
            className="text-xs h-8"
          >
            Semua ({rows.length})
          </Button>
          <Button
            size="sm"
            variant={filterMode === "OPEN_FOLLOWUP" ? "default" : "outline"}
            onClick={() => setFilterMode("OPEN_FOLLOWUP")}
            className="text-xs h-8"
          >
            Tindak Lanjut ({metrics.studentsWithOpenFollowUp})
          </Button>
          <Button
            size="sm"
            variant={filterMode === "BELOW_KKTP" ? "default" : "outline"}
            onClick={() => setFilterMode("BELOW_KKTP")}
            className="text-xs h-8"
          >
            Di Bawah KKTP ({metrics.studentsWithBelowKktp})
          </Button>
          <Button
            size="sm"
            variant={filterMode === "REMEDIAL" ? "default" : "outline"}
            onClick={() => setFilterMode("REMEDIAL")}
            className="text-xs h-8"
          >
            Remedial ({metrics.studentsWithRemedial})
          </Button>
          <Button
            size="sm"
            variant={filterMode === "ABSENCE" ? "default" : "outline"}
            onClick={() => setFilterMode("ABSENCE")}
            className="text-xs h-8"
          >
            Ketidakhadiran ({metrics.studentsWithAbsence})
          </Button>
        </div>
      </div>

      {/* Main Roster Monitoring View */}
      {filteredRows.length === 0 ? (
        <Card className="p-8 text-center bg-slate-50 border-dashed">
          <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <h3 className="font-semibold text-base">Tidak Ada Siswa Sesuai Kriteria</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {rows.length === 0
              ? "Belum ada siswa terdaftar pada kelas ini. Silakan kelola anggota kelas terlebih dahulu."
              : "Tidak ada siswa yang cocok dengan filter atau kata kunci pencarian yang dipilih."}
          </p>
          {filterMode !== "ALL" && (
            <Button variant="outline" size="sm" onClick={() => setFilterMode("ALL")} className="mt-3 text-xs">
              Tampilkan Semua Siswa
            </Button>
          )}
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block border rounded-lg overflow-hidden bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b text-xs font-semibold text-slate-700">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4 min-w-[200px]">Siswa</th>
                  <th className="py-3 px-4 min-w-[180px]">Kehadiran</th>
                  <th className="py-3 px-4 min-w-[180px]">Penilaian / Performa</th>
                  <th className="py-3 px-4 text-center">KKTP</th>
                  <th className="py-3 px-4 text-center">Remedial</th>
                  <th className="py-3 px-4 text-center">Tindak Lanjut</th>
                  <th className="py-3 px-4 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row, idx) => {
                  const hasAbsence =
                    row.attendance.absentCount + row.attendance.sickCount + row.attendance.permissionCount > 0;

                  return (
                    <tr key={row.studentId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-center text-xs text-muted-foreground">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{row.fullName}</div>
                        <div className="text-xs text-muted-foreground">{row.nis ? `NIS: ${row.nis}` : "—"}</div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {row.attendance.totalRecordedSessions === 0 ? (
                          <span className="text-muted-foreground italic">Belum ada data</span>
                        ) : (
                          <div className="space-y-1">
                            <div className="font-medium text-slate-800">
                              {row.attendance.presentCount} Hadir / {row.attendance.totalRecordedSessions} Pertemuan
                            </div>
                            {hasAbsence && (
                              <div className="flex flex-wrap gap-1 text-[10px]">
                                {row.attendance.absentCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-medium">
                                    {row.attendance.absentCount} Alpa
                                  </span>
                                )}
                                {row.attendance.sickCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                                    {row.attendance.sickCount} Sakit
                                  </span>
                                )}
                                {row.attendance.permissionCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                                    {row.attendance.permissionCount} Izin
                                  </span>
                                )}
                                {row.attendance.lateCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-medium">
                                    {row.attendance.lateCount} Telat
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {row.assessment.gradedResultCount === 0 ? (
                          <span className="text-muted-foreground italic">Belum ada nilai</span>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-slate-800">
                              <span className="font-semibold">{row.assessment.gradedResultCount}</span> Nilai Tercatat
                            </div>
                            {row.runningPerformance && row.runningPerformance.score !== null ? (
                              <div className="text-[11px] text-emerald-800 font-medium bg-emerald-50 px-1.5 py-0.5 rounded inline-block">
                                Performa: {row.runningPerformance.score.toFixed(1)}{" "}
                                <span className="text-emerald-600 font-normal">
                                  ({row.runningPerformance.availableWeight}%)
                                </span>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-xs">
                        {row.assessment.gradedResultCount === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : row.assessment.belowKktpCount > 0 ? (
                          <Badge variant="destructive" className="font-bold text-[11px]">
                            {row.assessment.belowKktpCount} Di Bawah
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]"
                          >
                            Tuntas
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-xs">
                        {row.assessment.remedialCount > 0 ? (
                          <Badge variant="secondary" className="font-semibold text-[11px]">
                            {row.assessment.remedialCount}x
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-xs">
                        {row.openFollowUpCount > 0 ? (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">
                            {row.openFollowUpCount} Terbuka
                          </Badge>
                        ) : row.notesCount > 0 ? (
                          <Badge variant="outline" className="text-slate-500 text-[11px]">
                            {row.notesCount} Catatan
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/kelas/${context.id}/monitoring/${row.studentId}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs font-medium")}
                        >
                          <span>Detail</span>
                          <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards View */}
          <div className="md:hidden space-y-3">
            {filteredRows.map((row) => (
              <Card key={row.studentId} className="border-slate-200">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-base text-slate-900">{row.fullName}</div>
                      <div className="text-xs text-muted-foreground">{row.nis ? `NIS: ${row.nis}` : "—"}</div>
                    </div>
                    {row.openFollowUpCount > 0 && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold text-xs">
                        {row.openFollowUpCount} Follow-up
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2 rounded bg-slate-50">
                      <div className="text-muted-foreground text-[11px]">Kehadiran</div>
                      <div className="font-semibold text-slate-800">
                        {row.attendance.totalRecordedSessions === 0
                          ? "Belum ada"
                          : `${row.attendance.presentCount} / ${row.attendance.totalRecordedSessions} Hadir`}
                      </div>
                    </div>

                    <div className="p-2 rounded bg-slate-50">
                      <div className="text-muted-foreground text-[11px]">Nilai Tercatat</div>
                      <div className="font-semibold text-slate-800">
                        {row.assessment.gradedResultCount === 0
                          ? "Belum ada"
                          : `${row.assessment.gradedResultCount} Penilaian`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {row.assessment.belowKktpCount > 0 ? (
                      <Badge variant="destructive" className="text-xs">
                        {row.assessment.belowKktpCount} Di Bawah KKTP
                      </Badge>
                    ) : (
                      row.assessment.gradedResultCount > 0 && (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                          Semua Tuntas
                        </Badge>
                      )
                    )}

                    {row.assessment.remedialCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {row.assessment.remedialCount}x Remedial
                      </Badge>
                    )}

                    {row.runningPerformance && row.runningPerformance.score !== null && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs">
                        Performa: {row.runningPerformance.score.toFixed(1)}
                      </Badge>
                    )}
                  </div>

                  <Link
                    href={`/kelas/${context.id}/monitoring/${row.studentId}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-between mt-2")}
                  >
                    <span>Lihat Detail Monitoring</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
