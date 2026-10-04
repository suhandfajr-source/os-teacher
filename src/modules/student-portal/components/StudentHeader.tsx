"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LogOut,
  GraduationCap,
  Home,
  CalendarDays,
  CheckSquare,
  TrendingUp,
  ClipboardList,
  UserCircle,
  AlertTriangle,
} from "lucide-react";
import { logoutStudent } from "@/modules/student-auth/student-auth.actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StudentHeaderProps {
  studentName: string;
  className: string;
  schoolName: string;
}

const desktopNavItems = [
  { href: "/siswa/portal", label: "Hari Ini", icon: Home, exact: true },
  { href: "/siswa/portal/jadwal", label: "Jadwal", icon: CalendarDays },
  { href: "/siswa/portal/quiz", label: "Kuis", icon: CheckSquare },
  { href: "/siswa/portal/nilai", label: "Nilai", icon: TrendingUp },
  { href: "/siswa/portal/tugas", label: "Tugas", icon: ClipboardList },
  { href: "/siswa/portal/profil", label: "Profil", icon: UserCircle },
];

export function StudentHeader({ studentName, className, schoolName }: StudentHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  // Sembunyikan navigasi saat kuis aktif (sama seperti StudentBottomNav)
  const isTakingQuiz =
    pathname.startsWith("/siswa/portal/quiz/") &&
    !pathname.endsWith("/review");

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const res = await logoutStudent();
      toast.success("Sesi Anda telah diakhiri. Sampai jumpa!");
      router.push(res.redirect || "/portal-siswa");
      router.refresh();
    } catch {
      toast.error("Gagal mengakhiri sesi.");
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-2.5 transition-colors">
      <div className="w-full max-w-md md:max-w-6xl mx-auto flex items-center justify-between gap-4">
        
        {/* Identitas Siswa & Rombel */}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <div className="w-9 h-9 rounded-2xl bg-teal-50 border border-teal-200/70 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-[#0F766E]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-black text-slate-900 truncate leading-tight">
              {studentName}
            </h2>
            <p className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">{className}</span>
              <span>•</span>
              <span className="truncate max-w-[130px] sm:max-w-[200px]">{schoolName}</span>
            </p>
          </div>
        </div>

        {/* Navigasi Desktop Horizontal (md:flex) */}
        {!isTakingQuiz ? (
          <nav aria-label="Navigasi Desktop Siswa" className="hidden md:flex items-center gap-1">
            {desktopNavItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                    isActive
                      ? "bg-[#0F766E] text-white font-bold shadow-xs"
                      : "text-slate-600 hover:text-teal-900 hover:bg-teal-50/70"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-slate-500")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        ) : (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Mode Ujian Aktif — Navigasi Dinonaktifkan</span>
          </div>
        )}

        {/* Tombol Logout Lab-Ready 1-Ketuk */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          title="Keluar dari akun (aman untuk komputer lab)"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-[11px] sm:text-xs font-bold transition-all shrink-0 active:scale-95"
        >
          {loggingOut ? (
            <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </>
          )}
        </button>

      </div>
    </header>
  );
}
