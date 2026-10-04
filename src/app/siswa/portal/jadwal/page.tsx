"use client";

import React, { useEffect, useState } from "react";
import { 
  CalendarDays, 
  Clock, 
  MapPin, 
  User, 
  RefreshCw, 
  AlertCircle, 
  BookOpen,
  LayoutGrid,
  ListFilter
} from "lucide-react";
import { 
  getStudentWeeklyScheduleAction, 
  type DayWeeklySchedule 
} from "@/modules/student-portal/student-portal.actions";
import { getNormalizedDayOfWeek } from "@/lib/schedule-date-utils";
import { Button } from "@/components/ui/button";

export default function StudentWeeklySchedulePage() {
  const [scheduleData, setScheduleData] = useState<DayWeeklySchedule[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"tabs" | "grid">("tabs");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setViewMode("grid");
    }
  }, []);

  const loadSchedule = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentWeeklyScheduleAction();
      if (res.success && res.data) {
        setScheduleData(res.data);
        // Default to current day (or Monday if Sunday)
        const current = getNormalizedDayOfWeek(new Date(), "Asia/Jakarta");
        setSelectedDay(current === 7 ? 1 : current);
      } else {
        setError(res.error || "Gagal memuat jadwal mingguan.");
      }
    } catch {
      setError("Terjadi kesalahan sistem saat memuat jadwal.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 pt-2">
        <div className="h-12 bg-white/70 rounded-2xl animate-pulse"></div>
        <div className="h-48 bg-white/70 rounded-3xl animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white rounded-3xl border border-slate-200 text-center space-y-3 mt-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="font-bold text-slate-800 text-sm">Gagal Memuat Jadwal</h3>
        <p className="text-xs text-slate-500">{error}</p>
        <Button onClick={loadSchedule} variant="outline" size="sm" className="rounded-xl">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Coba Lagi
        </Button>
      </div>
    );
  }

  const activeDaySchedule = scheduleData.find((d) => d.dayOfWeek === selectedDay);
  const todayDayOfWeek = getNormalizedDayOfWeek(new Date(), "Asia/Jakarta");
  const daysList = scheduleData.length > 0 ? scheduleData : [
    { dayOfWeek: 1, dayName: "Senin", items: [] },
    { dayOfWeek: 2, dayName: "Selasa", items: [] },
    { dayOfWeek: 3, dayName: "Rabu", items: [] },
    { dayOfWeek: 4, dayName: "Kamis", items: [] },
    { dayOfWeek: 5, dayName: "Jumat", items: [] },
    { dayOfWeek: 6, dayName: "Sabtu", items: [] },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-[#0F766E]" />
            <span>Jadwal Mingguan Rombel</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500">
            Jadwal mata pelajaran aktif semester berjalan
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("tabs")}
              title="Tampilan Tab Harian"
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                viewMode === "tabs"
                  ? "bg-white text-teal-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Harian</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Tampilan Grid Mingguan"
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                viewMode === "grid"
                  ? "bg-white text-teal-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mingguan</span>
            </button>
          </div>

          <button
            onClick={loadSchedule}
            title="Segarkan data"
            className="p-1.5 sm:p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        /* Weekly Grid View (5-6 Kolom di Desktop / Tablet) */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 items-start">
          {daysList.map((d) => {
            const isToday = d.dayOfWeek === todayDayOfWeek;
            return (
              <div
                key={d.dayOfWeek}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col h-full ${
                  isToday
                    ? "bg-teal-50/40 border-teal-300 shadow-xs ring-1 ring-teal-300"
                    : "bg-white border-slate-200/80 shadow-xs hover:border-slate-300"
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>{d.dayName}</span>
                      {isToday && (
                        <span className="px-1.5 py-0.5 rounded-md bg-teal-600 text-white text-[8px] font-black uppercase tracking-wider">
                          Hari Ini
                        </span>
                      )}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {d.items.length} Mapel
                    </p>
                  </div>
                </div>

                {/* Cards for each lesson */}
                {d.items.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-[11px] font-medium my-auto">
                    Tidak ada mapel
                  </div>
                ) : (
                  <div className="space-y-2">
                    {d.items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className={`p-2.5 rounded-xl border transition-all text-left ${
                          item.isLive
                            ? "bg-teal-50 border-teal-300 ring-1 ring-teal-400"
                            : "bg-slate-50/80 border-slate-200/80 hover:bg-slate-100/80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-100/70 px-1.5 py-0.5 rounded">
                            {item.startTime} - {item.endTime}
                          </span>
                          {item.isLive && (
                            <span className="px-1 py-0.2 rounded bg-teal-600 text-white text-[8px] font-extrabold uppercase animate-pulse">
                              LIVE
                            </span>
                          )}
                        </div>
                        <h5 className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">
                          {item.subjectName}
                        </h5>
                        <p className="text-[10px] text-slate-500 truncate mt-1 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{item.teacherName}</span>
                        </p>
                        {item.room && (
                          <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{item.room}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Tab Harian View (Mobile default & focused view) */
        <div className="space-y-4">
          {/* Day Selector Pills */}
          <div className="grid grid-cols-6 gap-1 p-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
            {daysList.map((d) => {
              const isSelected = d.dayOfWeek === selectedDay;
              const isToday = d.dayOfWeek === todayDayOfWeek;
              return (
                <button
                  key={d.dayOfWeek}
                  type="button"
                  onClick={() => setSelectedDay(d.dayOfWeek)}
                  className={`py-2 rounded-xl text-center transition-all ${
                    isSelected
                      ? "bg-[#0F766E] text-white font-extrabold shadow-xs scale-[1.02]"
                      : isToday
                      ? "bg-teal-50 text-teal-700 font-bold border border-teal-200"
                      : "text-slate-600 hover:bg-slate-100 font-bold"
                  }`}
                >
                  <span className="block text-[11px] leading-tight">
                    {d.dayName.slice(0, 3)}
                  </span>
                  <span className={`block text-[9px] mt-0.5 ${isSelected ? "text-teal-200" : "text-slate-400"}`}>
                    {d.items.length} Mapel
                  </span>
                </button>
              );
            })}
          </div>

          {/* Schedule Items for Selected Day */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                Hari {activeDaySchedule?.dayName || "Pilihan"}
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">
                Total {activeDaySchedule?.items.length || 0} Pelajaran
              </span>
            </div>

            {(!activeDaySchedule || activeDaySchedule.items.length === 0) ? (
              <div className="p-8 bg-white rounded-3xl border border-slate-200/80 text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">Tidak Ada Pelajaran</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Tidak ada mata pelajaran yang dijadwalkan pada hari {activeDaySchedule?.dayName || "ini"}.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeDaySchedule.items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                      item.isLive
                        ? "bg-teal-50/90 border-teal-300 shadow-sm ring-1 ring-teal-400"
                        : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-lg bg-teal-100/80 text-teal-800 text-[10px] font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                            {item.subjectName}
                          </h4>
                          {item.isLive && (
                            <span className="px-1.5 py-0.5 rounded-full bg-teal-600 text-white text-[9px] font-black uppercase animate-pulse">
                              LIVE
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-2 pl-6">
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

                      <div className="flex items-center gap-1 text-[11px] sm:text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl shrink-0">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{item.startTime} - {item.endTime}</span>
                      </div>
                    </div>
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
