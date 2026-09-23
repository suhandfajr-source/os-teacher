"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  BookOpen,
} from "lucide-react";
import {
  getStudentProgressDataAction,
  type StudentProgressPageData,
} from "@/modules/student-portal/student-progress.actions";
import type { SubjectProgress, MonthlyAttendanceRecap, TpMasteryItem } from "@/modules/student-portal/student-progress.service";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function TpStatusBadge({ tp }: { tp: TpMasteryItem }) {
  if (tp.status === "TUNTAS") {
    return (
      <span className="shrink-0 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        ✓ {tp.masteredCount}/{tp.assessedCount} Tuntas
      </span>
    );
  }
  if (tp.status === "BELUM_TUNTAS") {
    return (
      <span className="shrink-0 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
        {tp.masteredCount}/{tp.assessedCount} Tuntas
      </span>
    );
  }
  if (tp.status === "TANPA_KKTP") {
    return (
      <span className="shrink-0 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
        Dinilai
      </span>
    );
  }
  return (
    <span className="shrink-0 text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
      Belum Dinilai
    </span>
  );
}

function SubjectCard({ subject }: { subject: SubjectProgress }) {
  const [open, setOpen] = useState(false);
  const hasData = subject.finalCount > 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full p-4 flex items-start justify-between gap-3 text-left"
      >
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-black text-slate-900 truncate">{subject.subjectName}</h3>
          </div>
          <p className="text-[11px] text-slate-500 truncate">
            {subject.teacherName || "Guru Pengampu"} • {subject.finalCount} nilai final
          </p>
          {hasData ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xl font-black text-[#0F766E]">
                {subject.runningScore !== null ? subject.runningScore : "–"}
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                  subject.scoringMode === "WEIGHTED"
                    ? "text-teal-700 bg-teal-50 border-teal-200/70"
                    : "text-slate-500 bg-slate-50 border-slate-200"
                }`}
                title={
                  subject.scoringMode === "WEIGHTED"
                    ? `Rata-rata berbobot guru (bobot terpasang: ${subject.availableWeight ?? 0}%)`
                    : undefined
                }
              >
                {subject.scoringMode === "WEIGHTED" ? "rata-rata berbobot" : "rata-rata sederhana — bobot belum diatur guru"}
              </span>
            </div>
          ) : (
            <span className="text-[11px] font-medium text-slate-400">Belum ada nilai final</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">
          {/* Tren nilai */}
          {subject.trend.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Tren Nilai</h4>
              <div className="flex items-end gap-1.5 h-20">
                {subject.trend.slice(-8).map((t) => (
                  <div key={t.assessmentId} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-[#0F766E] to-teal-400 min-h-[4px]"
                      style={{ height: `${Math.max(6, (t.percent / 100) * 64)}px` }}
                      title={`${t.title}: ${t.score}`}
                    />
                    <span className="text-[9px] font-bold text-slate-500 truncate w-full text-center">
                      {t.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pohon ketuntasan TP */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Ketuntasan TP (Tujuan Pembelajaran)
            </h4>
            {subject.tpTree.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-1">
                Guru belum menetapkan TP untuk mapel ini.
              </p>
            ) : (
              <div className="space-y-1.5">
                {subject.tpTree.map((tp) => (
                  <div
                    key={tp.learningObjectiveId}
                    className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[11px] font-bold text-slate-800 leading-snug">
                        {tp.code ? `${tp.code} — ` : ""}
                        {tp.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-500">
                        {tp.averageScore !== null && <span>rata-rata {tp.averageScore}</span>}
                        {tp.remedialCount > 0 && (
                          <span className="text-amber-600">remedial: {tp.remedialCount}×</span>
                        )}
                      </div>
                    </div>
                    <TpStatusBadge tp={tp} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AttendanceTab({ attendance }: { attendance: MonthlyAttendanceRecap[] }) {
  const [idx, setIdx] = useState(0);
  const current = attendance[idx];

  if (attendance.length === 0) {
    return (
      <div className="p-5 bg-white rounded-3xl border border-slate-200/80 text-center space-y-1.5">
        <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
          <CalendarCheck className="w-5 h-5" />
        </div>
        <h3 className="text-xs font-bold text-slate-800">Belum Ada Data Presensi</h3>
        <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
          Rekap kehadiran muncul setelah guru mencatat presensi pada sesi pembelajaran.
        </p>
      </div>
    );
  }

  const items: Array<{ label: string; value: number; color: string }> = [
    { label: "Hadir", value: current.hadir, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    { label: "Sakit", value: current.sakit, color: "text-sky-600 bg-sky-50 border-sky-200" },
    { label: "Izin", value: current.izin, color: "text-amber-600 bg-amber-50 border-amber-200" },
    { label: "Alpa", value: current.alpa, color: "text-rose-600 bg-rose-50 border-rose-200" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIdx((i) => Math.min(attendance.length - 1, i + 1))}
          disabled={idx >= attendance.length - 1}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 disabled:opacity-30"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="text-xs font-black text-slate-800">
          {MONTH_NAMES[current.month - 1]} {current.year}
        </h3>
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx <= 0}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 disabled:opacity-30"
          aria-label="Bulan berikutnya"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {items.map((it) => (
          <div key={it.label} className={`p-3 rounded-2xl border text-center space-y-1 ${it.color}`}>
            <p className="text-xl font-black">{it.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide">{it.label}</p>
          </div>
        ))}
      </div>

      {current.lateCount > 0 && (
        <p className="text-[11px] text-amber-600 font-medium px-1">
          Termasuk {current.lateCount}× hadir terlambat.
        </p>
      )}
    </div>
  );
}

export default function StudentProgressPage() {
  const [data, setData] = useState<StudentProgressPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"nilai" | "presensi">("nilai");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentProgressDataAction();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || "Gagal memuat capaian belajar.");
      }
    } catch {
      setError("Terjadi kesalahan saat memuat data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 pt-2">
        <div className="h-16 bg-white/70 rounded-3xl animate-pulse border border-slate-200/60"></div>
        <div className="h-44 bg-white/70 rounded-3xl animate-pulse border border-slate-200/60"></div>
        <div className="h-32 bg-white/70 rounded-3xl animate-pulse border border-slate-200/60"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-white rounded-3xl border border-slate-200 text-center space-y-3 mt-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="font-bold text-slate-800 text-sm">Gagal Memuat Capaian Belajar</h3>
        <p className="text-xs text-slate-500">{error || "Data tidak dapat diakses."}</p>
        <Button onClick={loadData} variant="outline" size="sm" className="rounded-xl">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Coba Lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 bg-gradient-to-br from-[#0F766E] to-[#115E59] rounded-3xl text-white shadow-lg shadow-teal-900/10 space-y-1 relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-start">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-teal-200 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-teal-300" />
              {data.student.className} • {data.student.academicYear}
            </span>
            <h1 className="text-base font-black tracking-tight">Capaian Belajarku</h1>
            <p className="text-[11px] text-teal-100/90 font-medium">
              Nilai final & ketuntasan TP per mata pelajaran
            </p>
          </div>
          <button
            onClick={loadData}
            title="Muat ulang"
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        {!data.hasActivePeriod && (
          <div className="p-2 bg-amber-500/20 border border-amber-300/40 rounded-xl text-[11px] text-amber-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Tahun ajaran belum aktif. Data capaian belum tersedia.</span>
          </div>
        )}
      </div>

      {/* Tab switch */}
      <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
        <button
          onClick={() => setTab("nilai")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === "nilai" ? "bg-white text-[#0F766E] shadow-sm" : "text-slate-500"
          }`}
        >
          Nilai & Ketuntasan
        </button>
        <button
          onClick={() => setTab("presensi")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === "presensi" ? "bg-white text-[#0F766E] shadow-sm" : "text-slate-500"
          }`}
        >
          Presensi Saya
        </button>
      </div>

      {tab === "nilai" ? (
        data.subjects.length === 0 ? (
          <div className="p-5 bg-white rounded-3xl border border-slate-200/80 text-center space-y-1.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">Belum Ada Mapel</h3>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              Mapel rombelmu akan muncul di sini setelah guru mengelolanya.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.subjects.map((s) => (
              <SubjectCard key={s.teachingContextId} subject={s} />
            ))}
          </div>
        )
      ) : (
        <AttendanceTab attendance={data.attendance} />
      )}

      <p className="text-[10px] text-slate-400 text-center px-4 leading-relaxed">
        Hanya nilai final (assessment selesai & sudah dinilai guru) yang ditampilkan.
        Nilai sedang berlangsung tidak akan muncul sampai guru memfinalisasinya.
      </p>
    </div>
  );
}
