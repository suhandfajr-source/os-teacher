"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Plus, BarChart3, ListOrdered, CheckCircle2, AlertCircle, FileText, ArrowRight } from "lucide-react";
import type { Prisma } from "@prisma/client";

interface AssessmentItem {
  id: string;
  title: string;
  date: Date;
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
  maxScore: Prisma.Decimal | number;
  minimumPassingScore: Prisma.Decimal | number | null;
  typeName: string;
  typeCategory: string;
  stats: {
    totalParticipants: number;
    gradedCount: number;
    pendingCount: number;
    absentCount: number;
    excusedCount: number;
    averageScore: Prisma.Decimal | number | null;
    highestScore: Prisma.Decimal | number | null;
    lowestScore: Prisma.Decimal | number | null;
    tuntasCount: number | null;
    perluRemedialCount: number | null;
    masteryPercentage: Prisma.Decimal | number | null;
  };
}

interface RunningGradeData {
  studentId: string;
  studentName: string;
  nis: string | null;
  availableWeight: Prisma.Decimal | number;
  runningPerformance: Prisma.Decimal | number | null;
  categories: {
    assessmentTypeId: string;
    assessmentTypeName: string;
    category: string;
    weight: Prisma.Decimal | number;
    categoryAverage: Prisma.Decimal | number | null;
    completedAssessmentCount: number;
  }[];
}

interface Props {
  teachingContextId: string;
  assessments: AssessmentItem[];
  gradePolicy: {
    id: string;
    status: "DRAFT" | "ACTIVE";
    items: Array<{
      id: string;
      weight: Prisma.Decimal | number;
      assessmentType: { name: string };
    }>;
  } | null;
  runningGrades: RunningGradeData[];
}

export default function PenilaianClient({
  teachingContextId,
  assessments,
  gradePolicy,
  runningGrades,
}: Props) {
  const [activeTab, setActiveTab] = useState<"LIST" | "AGGREGATION">("LIST");

  const isPolicyActive = gradePolicy?.status === "ACTIVE" && gradePolicy.items.length > 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Penilaian & Nilai Siswa</h2>
          <p className="text-sm text-muted-foreground">
            Kelola ulangan, tugas, ujian, input nilai, dan pantau performa berjalan siswa.
          </p>
        </div>

        <div className="flex gap-2">
          <Link href={`/kelas/${teachingContextId}/pengaturan-nilai`}>
            <Button variant="outline" size="sm">
              Pengaturan Bobot
            </Button>
          </Link>
          <Link href={`/assessment/new?teachingContextId=${teachingContextId}`}>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              + Buat Penilaian Baru
            </Button>
          </Link>
        </div>
      </div>

      {/* Sub-view Switcher */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("LIST")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 ${
            activeTab === "LIST"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          Daftar Penilaian ({assessments.length})
        </button>
        <button
          onClick={() => setActiveTab("AGGREGATION")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 ${
            activeTab === "AGGREGATION"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Rekapitulasi Performa Berjalan
          {isPolicyActive && (
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              Bobot Aktif
            </Badge>
          )}
        </button>
      </div>

      {/* TAB 1: LIST OF ASSESSMENTS */}
      {activeTab === "LIST" && (
        <div className="space-y-4">
          {assessments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-4">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
                <h3 className="text-lg font-semibold">Belum Ada Penilaian</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Buat penilaian baru untuk mulai mencatat skor siswa pada tugas, ulangan harian, UTS, atau UAS.
                </p>
                <Link href={`/assessment/new?teachingContextId=${teachingContextId}`}>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Buat Penilaian Pertama
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {assessments.map((a) => (
                <Card key={a.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{a.typeName}</Badge>
                        {a.status === "COMPLETED" && (
                          <Badge className="bg-green-600 hover:bg-green-700">Selesai (COMPLETED)</Badge>
                        )}
                        {a.status === "IN_PROGRESS" && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            Sedang Berlangsung
                          </Badge>
                        )}
                        {a.status === "DRAFT" && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Draft (Belum Dimulai)
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-bold">
                        <Link href={`/assessment/${a.id}`} className="hover:underline text-primary">
                          {a.title}
                        </Link>
                      </h3>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        <span>Tanggal: {format(new Date(a.date), "dd MMMM yyyy", { locale: localeId })}</span>
                        <span>Skor Maks: {Number(a.maxScore)}</span>
                        {a.minimumPassingScore !== null && (
                          <span>KKTP: {Number(a.minimumPassingScore)}</span>
                        )}
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex flex-wrap md:flex-nowrap items-center gap-4 text-xs border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-5">
                      <div className="text-center min-w-[70px]">
                        <div className="text-muted-foreground">Dinilai</div>
                        <div className="font-semibold text-sm">
                          {a.stats.gradedCount} / {a.stats.totalParticipants}
                        </div>
                      </div>

                      <div className="text-center min-w-[70px]">
                        <div className="text-muted-foreground">Rata-rata</div>
                        <div className="font-semibold text-sm">
                          {a.stats.averageScore ? Number(a.stats.averageScore).toFixed(1) : "—"}
                        </div>
                      </div>

                      {a.minimumPassingScore !== null && (
                        <div className="text-center min-w-[80px]">
                          <div className="text-muted-foreground">Ketuntasan</div>
                          <div className="font-semibold text-sm text-green-600">
                            {a.stats.masteryPercentage ? `${Number(a.stats.masteryPercentage).toFixed(0)}%` : "—"}
                          </div>
                        </div>
                      )}

                      <Link href={`/assessment/${a.id}`}>
                        <Button variant="outline" size="sm">
                          Buka Penilaian
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WEIGHTED RUNNING GRADE AGGREGATION */}
      {activeTab === "AGGREGATION" && (
        <div className="space-y-4">
          {!isPolicyActive ? (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="py-8 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
                <h3 className="text-lg font-bold text-slate-900">Pengaturan Bobot Nilai Belum Aktif</h3>
                <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                  Untuk melihat perhitungan rekapitulasi performa berjalan siswa secara otomatis, atur dan aktifkan konfigurasi bobot nilai (total tepat 100.00%).
                </p>
                <Link href={`/kelas/${teachingContextId}/pengaturan-nilai`}>
                  <Button className="mt-2 font-semibold">
                    Buka Pengaturan Bobot Nilai
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <CardTitle>Rekapitulasi Performa Berjalan</CardTitle>
                    <CardDescription>
                      Dihitung dari rata-rata jenis penilaian yang telah selesai (COMPLETED) berdasarkan bobot yang tersedia.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-slate-50 text-xs">
                    Hanya Penilaian Selesai (COMPLETED)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Disclaimer Banner */}
                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-md text-xs text-blue-900 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <span>
                    <strong>Informasi Performa Berjalan:</strong> Nilai ini merupakan akumulasi performa sementara berdasarkan komponen penilaian yang sudah selesai. <strong>Bukan nilai rapor resmi.</strong>
                  </span>
                </div>

                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="py-3 px-3 text-center font-semibold w-12">No</th>
                        <th className="py-3 px-4 text-left font-semibold">Nama Siswa</th>
                        <th className="py-3 px-3 text-left font-semibold w-24">NIS</th>
                        {gradePolicy.items.map((item) => (
                          <th key={item.id} className="py-3 px-3 text-center font-semibold">
                            {item.assessmentType.name}
                            <span className="block text-[10px] text-muted-foreground font-normal">
                              ({Number(item.weight)}%)
                            </span>
                          </th>
                        ))}
                        <th className="py-3 px-3 text-center font-semibold bg-slate-100/70">
                          Bobot Tersedia
                        </th>
                        <th className="py-3 px-4 text-center font-bold bg-primary/10 text-primary">
                          Performa Berjalan
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {runningGrades.length === 0 ? (
                        <tr>
                          <td colSpan={5 + gradePolicy.items.length} className="py-8 text-center text-muted-foreground">
                            Tidak ada data siswa aktif.
                          </td>
                        </tr>
                      ) : (
                        runningGrades.map((rg, idx) => (
                          <tr key={rg.studentId} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 text-center text-xs text-muted-foreground">{idx + 1}</td>
                            <td className="py-2.5 px-4 font-medium">
                              <Link href={`/siswa/${rg.studentId}`} className="hover:underline text-primary">
                                {rg.studentName}
                              </Link>
                            </td>
                            <td className="py-2.5 px-3 text-xs text-muted-foreground">{rg.nis || "—"}</td>
                            {rg.categories.map((cat) => (
                              <td key={cat.assessmentTypeId} className="py-2.5 px-3 text-center">
                                {cat.categoryAverage !== null ? (
                                  <span className="font-semibold">{Number(cat.categoryAverage).toFixed(1)}</span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                            ))}
                            <td className="py-2.5 px-3 text-center text-xs font-semibold bg-slate-50">
                              {Number(rg.availableWeight).toFixed(0)}%
                            </td>
                            <td className="py-2.5 px-4 text-center font-bold text-sm bg-primary/5 text-primary">
                              {rg.runningPerformance !== null ? (
                                Number(rg.runningPerformance).toFixed(1)
                              ) : (
                                <span className="text-muted-foreground text-xs font-normal">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
