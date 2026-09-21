"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { 
  GraduationCap, 
  School, 
  KeyRound, 
  User, 
  Hash, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Search, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  Sparkles,
  BookOpen
} from "lucide-react";
import { 
  loginStudent, 
  lookupJoinCode, 
  registerStudent, 
  type JoinCodeContext 
} from "@/modules/student-auth/student-auth.actions";
import { searchSchools } from "@/modules/schools/schools.actions";

type SchoolOption = {
  id: string;
  name: string;
  city?: string | null;
  npsn?: string | null;
};

type PendingNotice = {
  type: "PENDING" | "REJECTED";
  studentName: string;
  schoolName: string;
  message: string;
};

export default function PortalSiswaAuthPage() {
  const router = useRouter();

  // Active tab: "login" | "join"
  const [activeTab, setActiveTab] = useState<"login" | "join">("login");

  // Notice state for PENDING or REJECTED students
  const [notice, setNotice] = useState<PendingNotice | null>(null);

  // --- LOGIN FORM STATE ---
  const [schoolQuery, setSchoolQuery] = useState("");
  const [schoolResults, setSchoolResults] = useState<SchoolOption[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null);
  const [isSearchingSchool, setIsSearchingSchool] = useState(false);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);

  const [loginNis, setLoginNis] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [showLoginPin, setShowLoginPin] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // --- JOIN CODE FORM STATE ---
  const [joinCode, setJoinCode] = useState("");
  const [joinContext, setJoinContext] = useState<JoinCodeContext | null>(null);
  const [joinChecking, setJoinChecking] = useState(false);
  const [joinError, setJoinError] = useState("");

  const [regFullName, setRegFullName] = useState("");
  const [regNis, setRegNis] = useState("");
  const [regPin, setRegPin] = useState("");
  const [regPinConfirm, setRegPinConfirm] = useState("");
  const [showRegPin, setShowRegPin] = useState(false);
  const [regSubmitting, setRegSubmitting] = useState(false);

  // Load saved school from localStorage on mount (DEV_STAGE_11 §3.2)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("klassa_student_saved_school");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.id && parsed?.name) {
          setSelectedSchool(parsed);
          setSchoolQuery(parsed.name);
        }
      }
    } catch {
      // Ignore parse error
    }
  }, []);

  // Debounced search for school
  useEffect(() => {
    if (selectedSchool && selectedSchool.name === schoolQuery) {
      return;
    }
    if (schoolQuery.trim().length < 3) {
      setSchoolResults([]);
      setShowSchoolDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingSchool(true);
      try {
        const results = await searchSchools(schoolQuery.trim());
        setSchoolResults(results);
        setShowSchoolDropdown(true);
      } catch {
        setSchoolResults([]);
      } finally {
        setIsSearchingSchool(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [schoolQuery, selectedSchool]);

  const handleSelectSchool = (school: SchoolOption) => {
    setSelectedSchool(school);
    setSchoolQuery(school.name);
    setShowSchoolDropdown(false);
    try {
      localStorage.setItem("klassa_student_saved_school", JSON.stringify(school));
    } catch {
      // Ignore storage error
    }
  };

  // --- SUBMIT LOGIN ---
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setNotice(null);

    if (!selectedSchool) {
      setLoginError("Silakan cari dan pilih sekolah asal Anda.");
      return;
    }
    if (!loginNis.trim()) {
      setLoginError("Nomor Induk Siswa (NIS) wajib diisi.");
      return;
    }
    if (!/^\d{4}$/.test(loginPin.trim())) {
      setLoginError("PIN harus berupa 4 digit angka.");
      return;
    }

    setLoginLoading(true);
    try {
      const res = await loginStudent({
        schoolId: selectedSchool.id,
        nis: loginNis.trim(),
        pin: loginPin.trim(),
      });

      if (res.success) {
        toast.success("Login berhasil! Selamat datang di Portal Siswa.");
        router.push(res.redirect || "/siswa/portal");
        router.refresh();
      } else {
        if (res.code === "ACCOUNT_PENDING") {
          setNotice({
            type: "PENDING",
            studentName: res.studentName || "Siswa",
            schoolName: res.schoolName || selectedSchool.name,
            message: res.message || "Akun Anda masih menunggu persetujuan guru pengampu.",
          });
        } else if (res.code === "ACCOUNT_REJECTED") {
          setNotice({
            type: "REJECTED",
            studentName: res.studentName || "Siswa",
            schoolName: res.schoolName || selectedSchool.name,
            message: res.message || "Pendaftaran akun Anda belum disetujui guru pengampu.",
          });
        } else {
          setLoginError(res.message || "NIS atau PIN salah.");
        }
      }
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Gagal terhubung ke server.");
    } finally {
      setLoginLoading(false);
    }
  };

  // --- CHECK JOIN CODE ---
  const handleCheckJoinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError("");
    setJoinContext(null);

    const clean = joinCode.trim().toUpperCase();
    if (clean.length < 6) {
      setJoinError("Kode rombel minimal 6 karakter.");
      return;
    }

    setJoinChecking(true);
    try {
      const res = await lookupJoinCode(clean);
      if (res.success && res.data) {
        setJoinContext(res.data);
        toast.success("Rombel ditemukan!");
      } else {
        setJoinError(res.message || "Kode rombel tidak ditemukan atau telah dikunci.");
      }
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : "Terjadi kesalahan saat memeriksa kode.");
    } finally {
      setJoinChecking(false);
    }
  };

  // --- SUBMIT REGISTRATION ---
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError("");

    if (!joinContext) return;
    if (!regFullName.trim()) {
      setJoinError("Nama lengkap wajib diisi.");
      return;
    }
    if (!regNis.trim()) {
      setJoinError("Nomor Induk Siswa (NIS) wajib diisi.");
      return;
    }
    if (!/^\d{4}$/.test(regPin.trim())) {
      setJoinError("PIN harus berupa 4 digit angka.");
      return;
    }
    if (regPin.trim() !== regPinConfirm.trim()) {
      setJoinError("Konfirmasi PIN tidak cocok.");
      return;
    }

    setRegSubmitting(true);
    try {
      const res = await registerStudent({
        joinCode: joinCode.trim().toUpperCase(),
        fullName: regFullName.trim(),
        nis: regNis.trim(),
        pin: regPin.trim(),
      });

      if (res.success) {
        if (res.status === "ACTIVE") {
          toast.success("Akun berhasil diaktifkan! Mengarahkan ke portal...");
          router.push(res.redirect || "/siswa/portal");
          router.refresh();
        } else {
          // Status PENDING L1
          setNotice({
            type: "PENDING",
            studentName: res.student?.fullName || regFullName.trim(),
            schoolName: joinContext.schoolName,
            message: res.message || "Pendaftaran terkirim dan sedang menunggu persetujuan guru pengampu.",
          });
        }
      } else {
        setJoinError(res.message || "Pendaftaran gagal.");
      }
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : "Terjadi kesalahan sistem saat mendaftar.");
    } finally {
      setRegSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EBF1F6] bg-ambient-pattern flex flex-col justify-center items-center p-3 sm:p-4 md:p-6 selection:bg-teal-500 selection:text-white">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-5 sm:p-7 space-y-5">
        
        {/* Top Header Badge & Branding */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-[#0F766E] text-[10px] font-extrabold tracking-wider uppercase border border-teal-200/70">
            <GraduationCap className="w-3.5 h-3.5 text-teal-600" />
            <span>PORTAL SISWA KLASSA</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Ruang Belajar Siswa
          </h1>
          <p className="text-[12px] text-slate-500 max-w-xs mx-auto leading-relaxed">
            Akses jadwal pelajaran harian, kuis & tugas, serta pantau capaian belajarmu secara mandiri.
          </p>
        </div>

        {/* Notice Card for PENDING or REJECTED students */}
        {notice ? (
          <div className="space-y-4 pt-2">
            <div className={`p-4 rounded-2xl border ${
              notice.type === "PENDING" 
                ? "bg-amber-50/90 border-amber-200 text-amber-900" 
                : "bg-rose-50/90 border-rose-200 text-rose-900"
            }`}>
              <div className="flex items-start gap-3">
                {notice.type === "PENDING" ? (
                  <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <h3 className="font-bold text-sm">
                    {notice.type === "PENDING" ? "Menunggu Persetujuan Guru" : "Pendaftaran Belum Disetujui"}
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Halo <span className="font-semibold text-slate-900">{notice.studentName}</span>, {notice.message}
                  </p>
                  <div className="text-[11px] text-slate-500 pt-1">
                    Sekolah: <span className="font-medium text-slate-700">{notice.schoolName}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" /> Tips Tindak Lanjut:
              </span>
              <p>
                {notice.type === "PENDING"
                  ? "Beri tahu guru pengampu rombel di kelas untuk menyetujui akunmu melalui panel guru."
                  : "Periksa kembali kode rombel yang diberikan oleh gurumu atau hubungi guru di sekolah."}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNotice(null);
                setJoinContext(null);
                setLoginNis("");
                setLoginPin("");
              }}
              className="w-full h-11 rounded-xl font-bold text-xs text-slate-700"
            >
              Kembali ke Halaman Masuk
            </Button>
          </div>
        ) : (
          <>
            {/* Tab Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/60 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("login");
                  setJoinError("");
                }}
                className={`py-2 rounded-xl transition-all ${
                  activeTab === "login"
                    ? "bg-white text-teal-800 shadow-sm font-extrabold"
                    : "hover:text-slate-900"
                }`}
              >
                Masuk (NIS & PIN)
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("join");
                  setLoginError("");
                }}
                className={`py-2 rounded-xl transition-all ${
                  activeTab === "join"
                    ? "bg-white text-teal-800 shadow-sm font-extrabold"
                    : "hover:text-slate-900"
                }`}
              >
                Gabung Rombel
              </button>
            </div>

            {/* TAB 1: LOGIN */}
            {activeTab === "login" && (
              <form onSubmit={handleLoginSubmit} className="space-y-3.5 pt-1">
                {loginError && (
                  <Alert variant="destructive" className="rounded-xl py-2 px-3">
                    <AlertDescription className="text-xs flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>{loginError}</span>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Sekolah Selector */}
                <div className="space-y-1 relative">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Sekolah Asal <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <School className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Ketik minimal 3 huruf nama sekolah..."
                      value={schoolQuery}
                      onChange={(e) => {
                        setSchoolQuery(e.target.value);
                        if (selectedSchool && selectedSchool.name !== e.target.value) {
                          setSelectedSchool(null);
                        }
                      }}
                      onFocus={() => {
                        if (schoolResults.length > 0) setShowSchoolDropdown(true);
                      }}
                      className="pl-9 pr-8 h-11 text-xs rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white"
                    />
                    {isSearchingSchool && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>

                  {/* Dropdown Hasil Pencarian Sekolah */}
                  {showSchoolDropdown && schoolResults.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {schoolResults.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectSchool(s)}
                          className="w-full px-3 py-2 text-left hover:bg-teal-50 transition-colors flex flex-col"
                        >
                          <span className="font-bold text-xs text-slate-800">{s.name}</span>
                          <span className="text-[10px] text-slate-500">{s.city || "Kota belum diset"} {s.npsn ? `• NPSN: ${s.npsn}` : ""}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedSchool && (
                    <div className="flex items-center gap-1.5 text-[10px] text-teal-700 bg-teal-50/80 px-2 py-1 rounded-lg border border-teal-200/50">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span className="truncate">Terpilih: <b>{selectedSchool.name}</b></span>
                    </div>
                  )}
                </div>

                {/* Input NIS */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Nomor Induk Siswa (NIS) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Contoh: 20260101"
                      value={loginNis}
                      onChange={(e) => setLoginNis(e.target.value.toUpperCase())}
                      className="pl-9 h-11 text-xs font-mono font-bold tracking-wider rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white uppercase"
                    />
                  </div>
                </div>

                {/* Input PIN 4-Digit */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-700">
                      PIN Keamanan (4 Digit) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400">Lupa PIN? Hubungi Guru</span>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type={showLoginPin ? "text" : "password"}
                      maxLength={4}
                      placeholder="••••"
                      value={loginPin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setLoginPin(val);
                      }}
                      className="pl-9 pr-9 h-11 text-sm font-mono tracking-widest font-black rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPin(!showLoginPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showLoginPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full h-11 rounded-xl bg-[#0F766E] hover:bg-[#0D655E] text-white font-bold text-xs tracking-wide shadow-md shadow-teal-900/10 transition-all active:scale-[0.99] mt-2"
                >
                  {loginLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Memverifikasi Identitas...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Masuk ke Portal Siswa</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>
              </form>
            )}

            {/* TAB 2: GABUNG ROMBEL VIA KODE */}
            {activeTab === "join" && (
              <div className="space-y-4 pt-1">
                {joinError && (
                  <Alert variant="destructive" className="rounded-xl py-2 px-3">
                    <AlertDescription className="text-xs flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>{joinError}</span>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Step 1: Input & Lookup Kode Rombel */}
                {!joinContext ? (
                  <form onSubmit={handleCheckJoinCode} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Masukkan Kode Rombel dari Guru <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                          type="text"
                          maxLength={8}
                          placeholder="CONTOH: 7K2M9P"
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                          className="pl-9 h-11 text-sm font-mono font-black tracking-widest rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white uppercase text-center"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Kode rombel terdiri dari 6 karakter alfanumerik yang dibagikan oleh gurumu di kelas.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={joinChecking || joinCode.trim().length < 6}
                      className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs tracking-wide shadow-md transition-all active:scale-[0.99]"
                    >
                      {joinChecking ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Memeriksa Kode Rombel...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Periksa Kode Rombel</span>
                          <Search className="w-4 h-4" />
                        </div>
                      )}
                    </Button>
                  </form>
                ) : (
                  /* Step 2: Konfirmasi Rombel & Formulir Pendaftaran Siswa */
                  <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                    {/* Kartu Konfirmasi Rombel */}
                    <div className="p-3 bg-teal-50/80 rounded-2xl border border-teal-200/70 space-y-1.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-black uppercase text-teal-800 tracking-wider">
                            Rombel Ditemukan
                          </span>
                          <h4 className="font-extrabold text-sm text-slate-900 leading-tight">
                            {joinContext.className} ({joinContext.gradeLevel || "Kelas"})
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setJoinContext(null)}
                          className="text-[10px] font-bold text-teal-700 hover:underline"
                        >
                          Ganti Kode
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-600 space-y-0.5 pt-0.5">
                        <div className="flex items-center gap-1">
                          <School className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="truncate">{joinContext.schoolName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="truncate">Guru: {joinContext.teacherName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Nama Lengkap */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Nama Lengkap Siswa <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        type="text"
                        placeholder="Ketik nama sesuai daftar hadir..."
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        className="h-10 text-xs rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white"
                      />
                    </div>

                    {/* NIS */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Nomor Induk Siswa (NIS) <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        type="text"
                        placeholder="Contoh: 20260101"
                        value={regNis}
                        onChange={(e) => setRegNis(e.target.value.toUpperCase())}
                        className="h-10 text-xs font-mono font-bold uppercase rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white"
                      />
                    </div>

                    {/* PIN & Konfirmasi PIN */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Buat PIN (4 Angka) <span className="text-rose-500">*</span>
                        </label>
                        <Input
                          type={showRegPin ? "text" : "password"}
                          maxLength={4}
                          placeholder="••••"
                          value={regPin}
                          onChange={(e) => setRegPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          className="h-10 text-xs font-mono font-black tracking-widest text-center rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Ulangi PIN <span className="text-rose-500">*</span>
                        </label>
                        <Input
                          type={showRegPin ? "text" : "password"}
                          maxLength={4}
                          placeholder="••••"
                          value={regPinConfirm}
                          onChange={(e) => setRegPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          className="h-10 text-xs font-mono font-black tracking-widest text-center rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>Gunakan 4 digit angka yang mudah kamu ingat.</span>
                      <button
                        type="button"
                        onClick={() => setShowRegPin(!showRegPin)}
                        className="text-teal-700 font-bold hover:underline"
                      >
                        {showRegPin ? "Sembunyikan" : "Perlihatkan"}
                      </button>
                    </div>

                    <Button
                      type="submit"
                      disabled={regSubmitting}
                      className="w-full h-11 rounded-xl bg-[#0F766E] hover:bg-[#0D655E] text-white font-bold text-xs tracking-wide shadow-md shadow-teal-900/10 transition-all active:scale-[0.99] mt-2"
                    >
                      {regSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Mendaftarkan Akun Siswa...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Daftar & Gabung Rombel</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer Link to Teacher Login */}
        <div className="pt-2 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Anda seorang Guru atau Wali Kelas?{" "}
            <a
              href="/login"
              className="font-bold text-[#0F766E] hover:underline"
            >
              Masuk ke Ruang Guru
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}
