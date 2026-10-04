"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  Clock,
  BookOpen,
  RefreshCw,
  Sparkles,
  Layers,
  HeartPulse,
  TrendingUp,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getKlassaPulseAnalyticsAction,
  seedKlassaPulseDemoDataAction,
} from "@/modules/agent/pulse/pulse.actions";
import { KlassaPulseAnalyticsResponse } from "@/modules/agent/pulse/pulse.types";

interface KlassaPulseTabProps {
  selectedSchoolFilter?: string;
}

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function KlassaPulseTab({ selectedSchoolFilter }: KlassaPulseTabProps) {
  const [analytics, setAnalytics] = useState<KlassaPulseAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await getKlassaPulseAnalyticsAction({
        schoolId: selectedSchoolFilter || undefined,
      });
      if (res.success && res.data) {
        setAnalytics(res.data);
      }
    } catch (err) {
      console.error("Failed to load Klassa Pulse analytics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedSchoolFilter]);

  const handleSeedDemoData = async () => {
    setIsSeeding(true);
    try {
      const res = await seedKlassaPulseDemoDataAction(
        selectedSchoolFilter || undefined
      );
      if (res.success) {
        setToastMessage(`Berhasil menginisialisasi ${res.count} data agregat sampel.`);
        await fetchAnalytics();
      } else {
        setToastMessage(res.error || "Gagal melakukan seeding data.");
      }
    } catch {
      setToastMessage("Terjadi kesalahan jaringan.");
    } finally {
      setIsSeeding(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 rounded-xl text-xs flex items-center justify-between">
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-teal-600 dark:text-teal-400 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* UU PDP Compliance & Privacy Banner */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 rounded-xl shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Jaminan Privasi Penuh UU PDP (Zero-PII Anonymization)
              <span className="text-[10px] bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 font-extrabold px-2 py-0.5 rounded-full border border-teal-300 dark:border-teal-700">
                Terproteksi
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Superadmin tidak memiliki akses ke percakapan obrolan guru perorangan. Seluruh analitik di bawah diekstraksi di latar belakang dan diagregasikan tanpa menyimpan nama guru, nama siswa, NISN, atau teks bebas pribadi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            disabled={isLoading}
            className="text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Segarkan
          </Button>

          <Button
            size="sm"
            onClick={handleSeedDemoData}
            disabled={isSeeding}
            className="text-xs bg-[#0F766E] hover:bg-teal-800 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isSeeding ? "Memproses..." : "Inisialisasi Sampel"}
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Insights */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              Total Interaksi Teranonim
              <Activity className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isLoading ? "..." : (analytics?.summary.totalInsights || 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Periode analitik: <span className="font-semibold text-slate-700 dark:text-slate-300">{analytics?.period || "Bulan Ini"}</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Burnout Risk Index */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              Indeks Beban Kerja Guru
              <HeartPulse className="h-4 w-4 text-rose-500" />
            </CardDescription>
            <div className="flex items-baseline gap-2">
              <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {isLoading ? "..." : `${analytics?.summary.burnoutIndex || 28}%`}
              </CardTitle>
              {analytics?.summary && (
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    analytics.summary.burnoutLevel === "AMAN"
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                      : analytics.summary.burnoutLevel === "WASPADA"
                      ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                      : "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                  }`}
                >
                  {analytics.summary.burnoutLevel}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Estimasi sentimen & beban administrasi
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Peak Overtime Hours */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              Jam Puncak Aktivitas Guru
              <Clock className="h-4 w-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-lg font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              {isLoading ? "..." : analytics?.summary.peakActiveHours || "20:00 - 22:00 WIB"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Waktu lembur & persiapan materi ajar
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Top Struggle Topic */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              Isu Ruang Kelas Dominan
              <BookOpen className="h-4 w-4 text-indigo-500" />
            </CardDescription>
            <CardTitle className="text-sm font-bold tracking-tight text-slate-900 dark:text-white line-clamp-1 mt-1">
              {isLoading ? "..." : analytics?.summary.topStruggleTopic || "Literasi Siswa"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Frekuensi konsultasi tertinggi
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2-Column Section: Top Struggles vs Curriculum Bottlenecks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Top Classroom Struggles */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              Isu Ruang Kelas Terbanyak Dikeluhkan Guru
            </CardTitle>
            <CardDescription className="text-xs">
              Distribusi tantangan belajar & disiplin siswa yang paling sering dikonsultasikan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">Memuat data analitik...</div>
            ) : analytics?.topStruggles && analytics.topStruggles.length > 0 ? (
              analytics.topStruggles.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] flex items-center justify-center font-bold text-slate-600 dark:text-slate-400">
                        {idx + 1}
                      </span>
                      {item.topic}
                    </span>
                    <span className="font-bold text-teal-700 dark:text-teal-400 shrink-0 ml-2">
                      {item.percentage}% ({item.frequency})
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#0F766E] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, item.percentage))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Kategori: {item.category}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">Belum ada data isu kelas.</div>
            )}
          </CardContent>
        </Card>

        {/* Column 2: Curriculum Bottlenecks */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Titik Rawan Materi Ajar (Curriculum Bottlenecks)
            </CardTitle>
            <CardDescription className="text-xs">
              Materi ajar yang paling sering membuat guru mencari alternatif metode pedagogis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">Memuat data materi ajar...</div>
            ) : analytics?.curriculumBottlenecks && analytics.curriculumBottlenecks.length > 0 ? (
              analytics.curriculumBottlenecks.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-700">
                        {item.subject}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {item.gradeLevel}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1 line-clamp-1">
                      {item.topic}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      {item.struggleRate}% Kesulitan
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {item.frequency} konsultasi
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">Belum ada titik rawan kurikulum.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Heatmap Section: Activity Peak Heatmap 7 Hari x 24 Jam */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Matriks Jam Kerja Guru (Activity Peak Grid — 7 Hari × 24 Jam)
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Visualisasi intensitas konsultasi asisten untuk memetakan jam lembur dan persiapan ajar di luar jam sekolah.
              </CardDescription>
            </div>

            {/* Heatmap Legend */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
              <span>Rendah</span>
              <div className="w-3 h-3 rounded-xs bg-slate-100 dark:bg-slate-800" />
              <div className="w-3 h-3 rounded-xs bg-teal-200 dark:bg-teal-900/60" />
              <div className="w-3 h-3 rounded-xs bg-teal-400 dark:bg-teal-700" />
              <div className="w-3 h-3 rounded-xs bg-[#0F766E]" />
              <span>Tinggi</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[680px]">
              {/* Hours Header */}
              <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-1 mb-1 text-[10px] text-slate-400 font-mono text-center">
                <div />
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className={h >= 19 || h <= 5 ? "font-bold text-amber-600 dark:text-amber-400" : ""}>
                    {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
                  </div>
                ))}
              </div>

              {/* 7 Days Grid */}
              {DAY_NAMES.map((dayName, dayIdx) => {
                return (
                  <div key={dayIdx} className="grid grid-cols-[40px_repeat(24,1fr)] gap-1 mb-1 items-center">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 text-right pr-2">
                      {dayName}
                    </span>
                    {Array.from({ length: 24 }).map((_, hour) => {
                      const slot = analytics?.heatmap.find(
                        (s) => s.dayOfWeek === dayIdx && s.hour === hour
                      );
                      const intensity = slot?.intensity || 0;
                      const count = slot?.count || 0;

                      let bgClass = "bg-slate-100 dark:bg-slate-800/80";
                      if (intensity === 1) bgClass = "bg-teal-100 dark:bg-teal-950 border border-teal-200/50 dark:border-teal-800/50";
                      if (intensity === 2) bgClass = "bg-teal-300 dark:bg-teal-800";
                      if (intensity === 3) bgClass = "bg-teal-500 dark:bg-teal-600 text-white";
                      if (intensity === 4) bgClass = "bg-[#0F766E] dark:bg-teal-500 text-white";

                      const isOvertimeHour = hour >= 19 || hour <= 2;

                      return (
                        <div
                          key={hour}
                          title={`${dayName}, Pukul ${String(hour).padStart(2, "0")}:00 WIB (${count} aktivitas)${isOvertimeHour ? " [Jam Lembur]" : ""}`}
                          className={`h-5 rounded-xs transition-all hover:scale-110 cursor-pointer ${bgClass}`}
                        />
                      );
                    })}
                  </div>
                );
              })}

              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>
                  <strong>Catatan Jam Lembur:</strong> Pukul 19:00 - 02:00 WIB mencatat frekuensi interaksi persiapan guru tertinggi di rumah.
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
