"use client";

import React, { useState } from "react";
import Link from "next/link";
import { GlobalContextMonitoringOverview } from "@/modules/monitoring/monitoring.types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Users, AlertCircle, CheckCircle2, ChevronRight, Search, BookOpen, AlertTriangle } from "lucide-react";

interface MonitoringOverviewClientProps {
  overviews: GlobalContextMonitoringOverview[];
}

export function MonitoringOverviewClient({ overviews }: MonitoringOverviewClientProps) {
  const [search, setSearch] = useState("");

  const filtered = overviews.filter(
    (o) =>
      o.className.toLowerCase().includes(search.toLowerCase()) ||
      o.subjectName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {overviews.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari kelas atau mata pelajaran..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Menampilkan {filtered.length} dari {overviews.length} kelas mengajar
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="p-8 text-center bg-slate-50 border-dashed">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-3">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">Belum Ada Data Monitoring Kelas</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
            {overviews.length === 0
              ? "Anda belum memiliki konteks kelas mengajar aktif. Buat kelas pada menu pengaturan atau kelola kelas Anda."
              : "Tidak ada kelas yang sesuai dengan kata kunci pencarian Anda."}
          </p>
          {overviews.length === 0 && (
            <Link href="/classes" className={cn(buttonVariants({ variant: "default" }))}>
              Buka Daftar Kelas
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <Card
              key={item.teachingContextId}
              className="flex flex-col justify-between hover:shadow-md transition-shadow border-slate-200"
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-900">{item.className}</CardTitle>
                    <CardDescription className="text-sm font-medium text-primary mt-0.5">
                      {item.subjectName}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0 font-normal">
                    {item.academicYear} &bull; Sem {item.semester}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-1">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50">
                    <Users className="w-4 h-4 text-slate-500 shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Siswa Aktif</div>
                      <div className="font-semibold">{item.currentStudentCount} Siswa</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50">
                    <BookOpen className="w-4 h-4 text-slate-500 shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Bobot Nilai</div>
                      <div className="font-semibold text-xs">
                        {item.hasActiveGradePolicy ? (
                          <span className="text-emerald-700 font-medium">Aktif</span>
                        ) : (
                          <span className="text-slate-500">Draft / Belum</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  {item.studentsWithOpenFollowUp > 0 ? (
                    <div className="flex items-center justify-between p-2 rounded-md bg-amber-50 border border-amber-200/60 text-xs">
                      <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        Tindak Lanjut Terbuka
                      </div>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">
                        {item.studentsWithOpenFollowUp} Siswa
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2 rounded-md bg-slate-50 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                        Tindak Lanjut
                      </div>
                      <span>Semua selesai</span>
                    </div>
                  )}

                  {item.studentsWithBelowKktp > 0 && (
                    <div className="flex items-center justify-between p-2 rounded-md bg-rose-50 border border-rose-200/60 text-xs">
                      <div className="flex items-center gap-1.5 text-rose-900 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Nilai di Bawah KKTP
                      </div>
                      <Badge variant="destructive" className="font-bold">
                        {item.studentsWithBelowKktp} Siswa
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <Link
                    href={`/kelas/${item.teachingContextId}/monitoring`}
                    className={cn(buttonVariants({ variant: "default" }), "w-full justify-between")}
                  >
                    <span>Buka Monitoring Kelas</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
