"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Sparkles, 
  CalendarDays, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  BookOpen, 
  FileQuestion, 
  User, 
  MapPin, 
  RefreshCw 
} from "lucide-react";
import { 
  getStudentDashboardDataAction, 
  type StudentDashboardData 
} from "@/modules/student-portal/student-portal.actions";
import { Button } from "@/components/ui/button";

export default function StudentPortalHomePage() {
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentDashboardDataAction();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || "Gagal memuat informasi beranda.");
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
        <div className="h-24 bg-white/70 rounded-3xl animate-pulse border border-slate-200/60"></div>
        <div className="h-44 bg-white/70 rounded-3xl animate-pulse border border-slate-200/60"></div>
        <div className="h-32 bg-white/70 rounded-3xl animate-pulse border border-slate-200/60"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-white rounded-3xl border border-slate-200 text-center space-y-3 mt-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="font-bold text-slate-800 text-sm">Gagal Memuat Beranda</h3>
        <p className="text-xs text-slate-500">{error || "Data tidak dapat diakses."}</p>
        <Button onClick={loadData} variant="outline" size="sm" className="rounded-xl">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Coba Lagi
        </Button>
      </div>
    );
  }

  const { student, today, urgentQuizzes, hasActivePeriod } = data;

  return (
    <div className="space-y-4">
      
      {/* 1. KARTU SAMBUTAN & STATUS */}
      <div className="p-4 bg-gradient-to-br from-[#0F766E] to-[#115E59] rounded-3xl text-white shadow-lg shadow-teal-900/10 space-y-2 relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-start">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-teal-200 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-teal-300" />
              {today.dayName} • {today.currentTime} WIB
            </span>
            <h1 className="text-base font-black tracking-tight">
              Semangat Belajar, {student.fullName.split(" ")[0]}! 👋
            </h1>
            <p className="text-[11px] text-teal-100/90 font-medium">
              {student.className} • NIS: {student.nis}
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

        {!hasActivePeriod && (
          <div className="p-2 bg-amber-500/20 border border-amber-300/40 rounded-xl text-[11px] text-amber-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Tahun ajaran belum diaktifkan oleh sekolah. Jadwal mungkin belum tersedia.</span>
          </div>
        )}
      </div>

      {/* 2. PELAJARAN HARI INI (DAILY STREAM) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-[#0F766E]" />
            <h2 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Pelajaran Hari Ini
            </h2>
          </div>
          <Link
            href="/siswa/portal/jadwal"
            className="text-[11px] font-bold text-teal-700 hover:underline flex items-center gap-0.5"
          >
            Lihat Jadwal <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {today.schedules.length === 0 ? (
          <div className="p-5 bg-white rounded-3xl border border-slate-200/80 text-center space-y-1.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">Tidak Ada Jadwal Hari Ini</h3>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              Selamat beristirahat atau gunakan waktu untuk memeriksa kuis dan tugas mandiri.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {today.schedules.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  item.isLive
                    ? "bg-teal-50/90 border-teal-300 shadow-sm ring-1 ring-teal-400"
                    : "bg-white border-slate-200/80 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-black text-slate-900 truncate">
                        {item.subjectName}
                      </h4>
                      {item.isLive && (
                        <span className="px-1.5 py-0.5 rounded-full bg-teal-600 text-white text-[9px] font-black tracking-wider uppercase animate-pulse">
                          LIVE
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{item.teacherName}</span>
                      </span>
                      {item.room && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{item.room}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-xl shrink-0">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{item.startTime} - {item.endTime}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. KUIS & UJIAN MENDESAK */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <FileQuestion className="w-4 h-4 text-[#0F766E]" />
            <h2 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Kuis & Ujian Rombel
            </h2>
          </div>
          <Link
            href="/siswa/portal/quiz"
            className="text-[11px] font-bold text-teal-700 hover:underline flex items-center gap-0.5"
          >
            Pusat Kuis <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {urgentQuizzes.length === 0 ? (
          <div className="p-4 bg-white rounded-3xl border border-slate-200/80 text-center space-y-1">
            <p className="text-xs font-semibold text-slate-700">Tidak ada kuis aktif</p>
            <p className="text-[11px] text-slate-400">
              Gurumu belum mempublikasikan kuis baru untuk rombel ini.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {urgentQuizzes.slice(0, 3).map((quiz) => (
              <div
                key={quiz.id}
                className="p-3.5 bg-white rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold uppercase text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-md border border-teal-200/60">
                      {quiz.subjectName}
                    </span>
                    {quiz.attemptStatus === "SUBMITTED" ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                        Selesai • Nilai: {quiz.score ?? 0}
                      </span>
                    ) : quiz.attemptStatus === "IN_PROGRESS" ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md">
                        Sedang Dikerjakan
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">
                        Belum Dikerjakan
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 truncate">
                    {quiz.title}
                  </h4>
                  {quiz.deadline && (
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Batas: {new Date(quiz.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </p>
                  )}
                </div>

                <Link
                  href={
                    quiz.attemptStatus === "SUBMITTED"
                      ? `/siswa/portal/quiz/${quiz.shareToken}/review`
                      : `/siswa/portal/quiz/${quiz.shareToken}`
                  }
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
                    quiz.attemptStatus === "SUBMITTED"
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      : "bg-[#0F766E] hover:bg-[#0D655E] text-white shadow-sm"
                  }`}
                >
                  {quiz.attemptStatus === "SUBMITTED" ? "Pembahasan" : "Kerjakan"}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
