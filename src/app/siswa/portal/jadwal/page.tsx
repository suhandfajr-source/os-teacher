"use client";

import React, { useEffect, useState } from "react";
import { 
  CalendarDays, 
  Clock, 
  MapPin, 
  User, 
  RefreshCw, 
  AlertCircle, 
  BookOpen 
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-[#0F766E]" />
            <span>Jadwal Mingguan Rombel</span>
          </h1>
          <p className="text-[11px] text-slate-500">
            Jadwal mata pelajaran aktif semester berjalan
          </p>
        </div>
        <button
          onClick={loadSchedule}
          title="Segarkan data"
          className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Day Selector Pills */}
      <div className="grid grid-cols-6 gap-1 p-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        {daysList.map((d) => {
          const isSelected = d.dayOfWeek === selectedDay;
          return (
            <button
              key={d.dayOfWeek}
              type="button"
              onClick={() => setSelectedDay(d.dayOfWeek)}
              className={`py-2 rounded-xl text-center transition-all ${
                isSelected
                  ? "bg-[#0F766E] text-white font-extrabold shadow-xs scale-[1.02]"
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
                className={`p-3.5 rounded-2xl border transition-all ${
                  item.isLive
                    ? "bg-teal-50/90 border-teal-300 shadow-sm ring-1 ring-teal-400"
                    : "bg-white border-slate-200/80"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-lg bg-teal-100/80 text-teal-800 text-[10px] font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <h4 className="text-xs font-black text-slate-900 truncate">
                        {item.subjectName}
                      </h4>
                      {item.isLive && (
                        <span className="px-1.5 py-0.5 rounded-full bg-teal-600 text-white text-[9px] font-black uppercase animate-pulse">
                          LIVE
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-2 pl-6">
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

                  <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl shrink-0">
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
  );
}
