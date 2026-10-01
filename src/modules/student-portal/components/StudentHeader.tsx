"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, GraduationCap, School, Shield, Monitor } from "lucide-react";
import { logoutStudent } from "@/modules/student-auth/student-auth.actions";
import { toast } from "sonner";

interface StudentHeaderProps {
  studentName: string;
  className: string;
  schoolName: string;
}

export function StudentHeader({ studentName, className, schoolName }: StudentHeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

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
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-2.5">
      <div className="max-w-md mx-auto flex items-center justify-between gap-3">
        
        {/* Identitas Siswa & Rombel */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-teal-50 border border-teal-200/70 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-[#0F766E]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-black text-slate-900 truncate leading-tight">
              {studentName}
            </h2>
            <p className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1">
              <span>{className}</span>
              <span>•</span>
              <span className="truncate">{schoolName}</span>
            </p>
          </div>
        </div>

        {/* Tombol Logout Lab-Ready 1-Ketuk */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          title="Keluar dari akun (aman untuk komputer lab)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-[11px] font-bold transition-colors shrink-0 active:scale-95"
        >
          {loggingOut ? (
            <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
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
