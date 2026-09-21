"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  UserCircle, 
  School, 
  Hash, 
  Calendar, 
  KeyRound, 
  LogOut, 
  ShieldCheck, 
  AlertCircle, 
  Monitor,
  GraduationCap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChangePinModal } from "@/components/student/ChangePinModal";
import { 
  getStudentDashboardDataAction, 
  type StudentDashboardData 
} from "@/modules/student-portal/student-portal.actions";
import { logoutStudent } from "@/modules/student-auth/student-auth.actions";
import { toast } from "sonner";

export default function StudentProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await getStudentDashboardDataAction();
        if (res.success && res.data) {
          setData(res.data);
        }
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const res = await logoutStudent();
      toast.success("Berhasil keluar dari akun.");
      router.push(res.redirect || "/portal-siswa");
      router.refresh();
    } catch {
      toast.error("Gagal keluar dari akun.");
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pt-2">
        <div className="h-44 bg-white/70 rounded-3xl animate-pulse"></div>
        <div className="h-28 bg-white/70 rounded-3xl animate-pulse"></div>
      </div>
    );
  }

  const student = data?.student;

  return (
    <div className="space-y-4">
      {/* Header Title */}
      <div>
        <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
          <UserCircle className="w-4 h-4 text-[#0F766E]" />
          <span>Profil & Akun Siswa</span>
        </h1>
        <p className="text-[11px] text-slate-500">
          Kelola data identitas belajar dan keamanan PIN
        </p>
      </div>

      {/* Profile Card */}
      <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200/70 flex items-center justify-center shrink-0">
            <GraduationCap className="w-6 h-6 text-[#0F766E]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-900 truncate">
              {student?.fullName || "Nama Siswa"}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3 text-emerald-600" /> Akun Aktif
              </span>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-0.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">
              Nomor Induk Siswa
            </span>
            <span className="font-mono font-black text-slate-800 text-xs">
              {student?.nis || "-"}
            </span>
          </div>

          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-0.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">
              Rombel / Kelas
            </span>
            <span className="font-bold text-slate-800 text-xs truncate block">
              {student?.className || "-"}
            </span>
          </div>

          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-0.5 col-span-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">
              Sekolah Asal
            </span>
            <span className="font-bold text-slate-800 text-xs truncate block">
              {student?.schoolName || "-"}
            </span>
          </div>
        </div>
      </div>

      {/* Security Actions Card */}
      <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-2.5">
        <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider px-1">
          Pengaturan Keamanan
        </h3>

        <button
          type="button"
          onClick={() => setIsPinModalOpen(true)}
          className="w-full p-3.5 rounded-2xl border border-slate-200 hover:border-teal-300 hover:bg-teal-50/50 transition-all flex items-center justify-between group active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h4 className="text-xs font-bold text-slate-900">
                Ganti PIN Keamanan
              </h4>
              <p className="text-[10px] text-slate-400">
                Ubah 4 digit PIN untuk login ke portal
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-teal-700">Ubah</span>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full p-3.5 rounded-2xl border border-slate-200 hover:border-rose-200 hover:bg-rose-50/50 transition-all flex items-center justify-between group active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h4 className="text-xs font-bold text-slate-900">
                Keluar dari Akun (Logout)
              </h4>
              <p className="text-[10px] text-slate-400">
                Akhiri sesi portal di perangkat ini
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-rose-700">
            {loggingOut ? "Keluar..." : "Keluar"}
          </span>
        </button>
      </div>

      {/* Lab Security Educational Banner */}
      <div className="p-3.5 bg-slate-100/90 rounded-2xl border border-slate-200 text-slate-600 space-y-1 text-[11px]">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <Monitor className="w-3.5 h-3.5 text-teal-700" />
          <span>Tips Komputer Lab Bersama:</span>
        </div>
        <p className="text-slate-500 leading-relaxed">
          Jika kamu memakai komputer sekolah atau perangkat bersama teman, selalu klik tombol <b>Keluar</b> sebelum meninggalkan meja agar akun dan nilaimu tetap aman.
        </p>
      </div>

      {/* Change Pin Modal Component */}
      <ChangePinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
      />
    </div>
  );
}
