"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { 
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
  Calendar,
  AlertCircle
} from "lucide-react";
import { 
  loginStudent, 
  lookupJoinCode, 
  registerStudent, 
  type JoinCodeContext
} from "@/modules/student-auth/student-auth.actions";
import { searchSchools } from "@/modules/schools/schools.actions";
import { KlassaLogo, ModularCockpitArtwork } from "@/components/brand";
import Link from "next/link";

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

type RosterStudent = JoinCodeContext["roster"][0];

export default function PortalSiswaAuthPage() {
  const router = useRouter();

  // Mode: "login" | "join"
  const [mode, setMode] = useState<"login" | "join">("login");

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
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // --- JOIN CODE FORM STATE ---
  const [joinCode, setJoinCode] = useState("");
  const [joinContext, setJoinContext] = useState<JoinCodeContext | null>(null);
  const [joinChecking, setJoinChecking] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Progressive Registration Form State
  const [regFullName, setRegFullName] = useState("");
  const [selectedRosterStudent, setSelectedRosterStudent] = useState<RosterStudent | null>(null);
  const [showNameDropdown, setShowNameDropdown] = useState(false);

  const [regNis, setRegNis] = useState("");
  const [regBirthDate, setRegBirthDate] = useState("");
  const [regPin, setRegPin] = useState("");
  const [regPinConfirm, setRegPinConfirm] = useState("");
  const [showRegPin, setShowRegPin] = useState(false);
  const [regSubmitting, setRegSubmitting] = useState(false);

  // Review 36c5321: tutup dropdown nama saat klik di luar / tekan Esc (a11y)
  const nameFieldRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (nameFieldRef.current && !nameFieldRef.current.contains(e.target as Node)) {
        setShowNameDropdown(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNameDropdown(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

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

  // --- LIVE NAME MATCHING IN ROSTER ---
  const matchingRoster = useMemo(() => {
    if (!joinContext?.roster || !regFullName.trim()) return [];
    const q = regFullName.trim().toLowerCase();
    return joinContext.roster.filter((s) => s.fullName.toLowerCase().includes(q));
  }, [joinContext?.roster, regFullName]);

  const isNameUnregistered = useMemo(() => {
    if (!joinContext?.roster || !regFullName.trim()) return false;
    if (selectedRosterStudent && selectedRosterStudent.fullName === regFullName) return false;
    return matchingRoster.length === 0;
  }, [joinContext?.roster, regFullName, selectedRosterStudent, matchingRoster.length]);

  // --- NIS VALIDATION LOGIC ---
  const expectedNis = selectedRosterStudent?.nis || "";
  const expectedNisLength = expectedNis.length > 0 ? expectedNis.length : 4;

  const nisValidationStatus = useMemo<"IDLE" | "MATCHED" | "MISMATCHED">(() => {
    if (!selectedRosterStudent || !regNis) return "IDLE";
    if (regNis.length < expectedNisLength) {
      return "IDLE"; // Belum mencapai jumlah angka maksimal -> tidak ada keterangan
    }
    if (regNis.toUpperCase() === expectedNis.toUpperCase()) {
      return "MATCHED";
    }
    return "MISMATCHED";
  }, [selectedRosterStudent, regNis, expectedNisLength, expectedNis]);

  const isNisMatched = nisValidationStatus === "MATCHED";

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
        rememberMe,
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
    setSelectedRosterStudent(null);
    setRegFullName("");
    setRegNis("");
    setRegBirthDate("");
    setRegPin("");
    setRegPinConfirm("");

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
    if (!selectedRosterStudent || !regFullName.trim()) {
      setJoinError("Silakan pilih nama siswa dari daftar rombel.");
      return;
    }
    if (!isNisMatched) {
      setJoinError(
        expectedNis
          ? "NIS belum sesuai dengan data rombel."
          : "NIS Anda belum tercatat di data rombel. Hubungi guru pengampu agar NIS dilengkapi terlebih dahulu — NIS dibutuhkan sebagai kunci login portal."
      );
      return;
    }
    if (!regBirthDate) {
      setJoinError("Tanggal lahir wajib diisi sebagai bahan pertimbangan persetujuan guru.");
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
        birthDate: regBirthDate,
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
    <div className="min-h-screen w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row relative overflow-x-hidden font-sans selection:bg-teal-500 selection:text-white">
      
      {/* ─────────────────────────────────────────────────────────────
          SISI KIRI: FORM & BRANDING (MENYATU PUTIH & DEKAT DENGAN GELOMBANG)
      ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 p-6 sm:p-8 lg:p-12 flex flex-col justify-between z-10 bg-white dark:bg-slate-950 min-h-screen">
        
        {/* Top Brand Logo */}
        <div className="w-full max-w-[420px] mx-auto lg:ml-auto lg:mr-8 xl:mr-14 pt-1">
          <Link 
            href="/" 
            className="inline-flex items-center hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] transition-all"
            aria-label="Beranda KLASSA"
          >
            <KlassaLogo variant="horizontal" size="xs" priority />
          </Link>
        </div>

        {/* Form Content Area */}
        <div className="my-auto py-6 w-full max-w-[420px] mx-auto lg:ml-auto lg:mr-8 xl:mr-14 space-y-4">
          
          {/* Header Text & Branding */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-300 text-[11px] font-extrabold tracking-wider uppercase border border-teal-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse"></span>
              <span>{mode === "join" ? "PENDAFTARAN & GABUNG ROMBEL" : "PORTAL BELAJAR SISWA"}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              {mode === "join" ? (
                <>
                  Gabung Rombel Baru, <br />
                  <span className="shimmer-text">Mulai Belajar Bersama Guru.</span>
                </>
              ) : (
                <>
                  Ruang Belajar Siswa, <br />
                  <span className="shimmer-text">Akses Tugas & Capaian Belajar.</span>
                </>
              )}
            </h1>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              {mode === "join"
                ? "Daftarkan identitas dan buat PIN untuk bergabung ke rombel kelas."
                : "Pantau materi, kumpulkan tugas mandiri, dan pantau progres belajarmu di KLASSA."}
            </p>
          </div>

          {/* Notice Card for PENDING or REJECTED students */}
          {notice ? (
            <div className="space-y-3 pt-1">
              <div className={`p-4 rounded-2xl border ${
                notice.type === "PENDING" 
                  ? "bg-amber-50/90 border-amber-200 text-amber-900 dark:bg-amber-950/50 dark:border-amber-900 dark:text-amber-100" 
                  : "bg-rose-50/90 border-rose-200 text-rose-900 dark:bg-rose-950/50 dark:border-rose-900 dark:text-rose-100"
              }`}>
                <div className="flex items-start gap-3">
                  {notice.type === "PENDING" ? (
                    <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <h3 className="font-bold text-xs">
                      {notice.type === "PENDING" ? "Menunggu Persetujuan Guru" : "Pendaftaran Belum Disetujui"}
                    </h3>
                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                      Halo <span className="font-semibold text-slate-900 dark:text-white">{notice.studentName}</span>, {notice.message}
                    </p>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                      Sekolah: <span className="font-medium text-slate-700 dark:text-slate-300">{notice.schoolName}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" /> Tips Tindak Lanjut:
                </span>
                <p className="text-[11px] text-slate-500">
                  {notice.type === "PENDING"
                    ? "Beri tahu gurumu di kelas untuk memeriksa tanggal lahir dan menyetujui akun melalui panel persetujuan guru."
                    : "Periksa kembali kode rombel dari gurumu atau hubungi guru di sekolah."}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNotice(null);
                  setJoinContext(null);
                  setMode("login");
                  setLoginNis("");
                  setLoginPin("");
                }}
                className="w-full h-12 rounded-2xl font-bold text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                Kembali ke Halaman Masuk
              </Button>
            </div>
          ) : mode === "login" ? (
            /* ─────────────────────────────────────────────────────────────
               DEFAULT: FORM LOGIN SISWA (IDENTIK FONT & ACTION ROW GURU)
            ───────────────────────────────────────────────────────────── */
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              {loginError && (
                <Alert variant="destructive" className="rounded-2xl py-2 px-3 border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-200">
                  <AlertDescription className="text-xs flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                  </AlertDescription>
                </Alert>
              )}

              {/* Sekolah Selector */}
              <div className="space-y-1 relative">
                <div className="relative">
                  <School className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
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
                    className="w-full h-11 pl-11 pr-8 bg-slate-100/80 hover:bg-slate-100 focus:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:focus:bg-slate-900 text-xs font-semibold text-slate-800 rounded-2xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
                  />
                  {isSearchingSchool && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>

                {/* Dropdown Hasil Pencarian Sekolah */}
                {showSchoolDropdown && schoolResults.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {schoolResults.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectSchool(s)}
                        className="w-full px-4 py-2.5 text-left hover:bg-teal-50 transition-colors flex flex-col"
                      >
                        <span className="font-bold text-xs text-slate-800">{s.name}</span>
                        <span className="text-[10px] text-slate-500">{s.city || "Kota belum diset"} {s.npsn ? `• NPSN: ${s.npsn}` : ""}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedSchool && (
                  <div className="flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-300 bg-teal-50/80 dark:bg-teal-950/60 px-3 py-1.5 rounded-xl border border-teal-200/50 dark:border-teal-800/60 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="truncate">Sekolah: <b>{selectedSchool.name}</b></span>
                  </div>
                )}
              </div>

              {/* Input NIS */}
              <div className="space-y-1">
                <div className="relative">
                  <Hash className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Nomor Induk Siswa (NIS)"
                    value={loginNis}
                    onChange={(e) => setLoginNis(e.target.value.toUpperCase())}
                    className="w-full h-11 pl-11 pr-4 bg-slate-100/80 hover:bg-slate-100 focus:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:focus:bg-slate-900 text-xs font-mono font-bold tracking-wider text-slate-800 rounded-2xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none uppercase"
                  />
                </div>
              </div>

              {/* Input PIN 4-Digit */}
              <div className="space-y-1">
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showLoginPin ? "text" : "password"}
                    maxLength={4}
                    placeholder="PIN Keamanan (4 Digit)"
                    value={loginPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setLoginPin(val);
                    }}
                    className="w-full h-11 pl-11 pr-11 bg-slate-100/80 hover:bg-slate-100 focus:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:focus:bg-slate-900 text-xs font-mono font-black tracking-widest text-slate-800 rounded-2xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPin(!showLoginPin)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showLoginPin ? "Sembunyikan PIN" : "Lihat PIN"}
                  >
                    {showLoginPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Help */}
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-teal-700 focus:ring-teal-500 accent-teal-700 cursor-pointer"
                  />
                  <span>Ingat sesi saya</span>
                </label>
                <span className="text-teal-700 font-medium">
                  Lupa PIN? Hubungi Guru
                </span>
              </div>

              {/* ACTION ROW (MASUK + GABUNG ROMBEL) */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={loginLoading}
                  className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-[#0F766E] to-[#14B8A6] hover:from-[#0D635C] hover:to-[#0F9E8E] text-white text-xs font-extrabold shadow-lg shadow-teal-700/25 hover:shadow-teal-700/35 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {loginLoading ? (
                    <span>Memverifikasi...</span>
                  ) : (
                    <>
                      <span>Masuk ke Portal Siswa</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMode("join");
                    setLoginError("");
                  }}
                  className="px-5 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-none text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center"
                >
                  Gabung Rombel
                </Button>
              </div>
            </form>
          ) : (
            /* ─────────────────────────────────────────────────────────────
               MODE: GABUNG ROMBEL (PROGRESSIVE ROSTER & NIS VALIDATION)
            ───────────────────────────────────────────────────────────── */
            <div className="space-y-3.5 pt-0.5">
              {joinError && (
                <Alert variant="destructive" className="rounded-2xl py-2 px-3 border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-200">
                  <AlertDescription className="text-xs flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{joinError}</span>
                  </AlertDescription>
                </Alert>
              )}

              {!joinContext ? (
                /* STEP 1: INPUT KODE ROMBEL */
                <form onSubmit={handleCheckJoinCode} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Masukkan Kode Rombel dari Guru <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="text"
                        maxLength={8}
                        placeholder="CONTOH: 7K2M9P"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        autoFocus
                        className="w-full h-11 pl-11 pr-4 bg-slate-100/80 hover:bg-slate-100 focus:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:focus:bg-slate-900 text-sm font-mono font-black tracking-widest text-slate-900 rounded-2xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none uppercase text-center"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Kode rombel terdiri dari 6 karakter alfanumerik yang dibagikan gurumu di kelas.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      type="submit"
                      disabled={joinChecking || joinCode.trim().length < 6}
                      className="flex-1 h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {joinChecking ? (
                        <span>Memeriksa Kode...</span>
                      ) : (
                        <>
                          <span>Periksa Kode Rombel</span>
                          <Search className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setMode("login");
                        setJoinError("");
                      }}
                      className="px-5 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-none text-slate-700 dark:text-slate-200 text-xs font-bold transition-all"
                    >
                      Batal
                    </Button>
                  </div>
                </form>
              ) : (
                /* STEP 2: PENDAFTARAN DENGAN LIVE AUTOCOMPLETE NAMA, NIS MATCHING & TANGGAL LAHIR */
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  {/* Kartu Rombel Terkonfirmasi */}
                  <div className="p-3 bg-teal-50/90 rounded-2xl border border-teal-200/70 space-y-1.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-black uppercase text-teal-800 tracking-wider">
                          Rombel Terverifikasi
                        </span>
                        <h4 className="font-extrabold text-sm text-slate-900 leading-tight">
                          {joinContext.className} ({joinContext.gradeLevel || "Kelas"})
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setJoinContext(null);
                          setSelectedRosterStudent(null);
                          setRegFullName("");
                          setRegNis("");
                          setRegBirthDate("");
                        }}
                        className="text-[11px] font-bold text-teal-700 hover:underline"
                      >
                        Ganti Kode
                      </button>
                    </div>
                    <div className="text-xs text-slate-600 space-y-0.5 pt-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <School className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">{joinContext.schoolName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">Guru: {joinContext.teacherName}</span>
                      </div>
                    </div>
                  </div>

                  {/* INPUT 1: NAMA LENGKAP DENGAN LIVE SEARCH & AUTOCOMPLETE */}
                  <div className="space-y-1 relative" ref={nameFieldRef}>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      1. Nama Lengkap Siswa <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="Ketik nama sesuai daftar hadir..."
                        value={regFullName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRegFullName(val);
                          setShowNameDropdown(true);
                          if (selectedRosterStudent && selectedRosterStudent.fullName !== val) {
                            setSelectedRosterStudent(null);
                            setRegNis("");
                            // Review 36c5321: jangan bocorkan data sensitif siswa sebelumnya
                            setRegBirthDate("");
                            setRegPin("");
                            setRegPinConfirm("");
                          }
                        }}
                        onFocus={() => {
                          if (matchingRoster.length > 0 && !selectedRosterStudent) {
                            setShowNameDropdown(true);
                          }
                        }}
                        className="w-full h-11 pl-11 pr-4 bg-slate-100/80 hover:bg-slate-100 focus:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:focus:bg-slate-900 text-xs font-semibold text-slate-800 rounded-2xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
                      />
                    </div>

                    {/* Keterangan Jika Huruf Diketik Tidak Cocok Rombel */}
                    {isNameUnregistered && (
                      <div className="flex items-center gap-1 text-xs text-rose-600 font-bold px-1 pt-0.5 animate-in fade-in duration-200">
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Siswa tidak terdaftar</span>
                      </div>
                    )}

                    {/* Dropdown Nama Siswa yang Cocok */}
                    {showNameDropdown && matchingRoster.length > 0 && !selectedRosterStudent && (
                      <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        <div className="p-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-900 rounded-t-2xl">
                          Pilih Nama Anda Dari Rombel:
                        </div>
                        {matchingRoster.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedRosterStudent(s);
                              setRegFullName(s.fullName);
                              setShowNameDropdown(false);
                              setRegNis("");
                              // Review 36c5321: reset data verifikasi & PIN milik pilihan siswa sebelumnya
                              setRegBirthDate("");
                              setRegPin("");
                              setRegPinConfirm("");
                            }}
                            className="w-full px-4 py-2.5 text-left hover:bg-teal-50 transition-colors flex items-center justify-between group"
                          >
                            <div>
                              <div className="font-bold text-xs text-slate-800 group-hover:text-teal-900">
                                {s.fullName}
                              </div>
                              {s.hasAccount && (
                                <div className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> Akun aktif (sudah punya PIN)
                                </div>
                              )}
                            </div>
                            <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg group-hover:bg-teal-100">
                              Pilih
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedRosterStudent && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Nama terkonfirmasi: <b>{selectedRosterStudent.fullName}</b></span>
                      </div>
                    )}
                  </div>

                  {/* INPUT 2: NIS (HANYA AKTIF SETELAH PILIH NAMA, VALIDASI HANYA SAAT JUMLAH DIGIT PENUH) */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      2. Nomor Induk Siswa (NIS) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Hash className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="text"
                        disabled={!selectedRosterStudent}
                        placeholder={
                          selectedRosterStudent
                            ? expectedNis
                              ? `Ketik ${expectedNisLength} digit NIS Anda...`
                              : "NIS belum tercatat di rombel"
                            : "Pilih nama siswa di atas terlebih dahulu"
                        }
                        value={regNis}
                        onChange={(e) => setRegNis(e.target.value.toUpperCase().replace(/\s/g, ""))}
                        className={`w-full h-11 pl-11 pr-4 text-xs font-mono font-bold uppercase rounded-2xl border transition-all outline-none ${
                          !selectedRosterStudent
                            ? "bg-slate-100/50 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500 border-transparent cursor-not-allowed"
                            : "bg-slate-100/80 hover:bg-slate-100 focus:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:focus:bg-slate-900 text-slate-800 border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                        }`}
                      />
                    </div>

                    {/* Keterangan NIS Cocok / Tidak Cocok (Hanya muncul saat jumlah angka diketik >= maksimal) */}
                    {selectedRosterStudent && (
                      <div className="pt-0.5">
                        {!expectedNis && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 font-bold">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>NIS belum tercatat di rombel — hubungi guru pengampu untuk melengkapi NIS Anda.</span>
                          </div>
                        )}
                        {nisValidationStatus === "MATCHED" && (
                          <div className="flex items-center gap-1 text-xs text-emerald-600 font-bold animate-in fade-in duration-200">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>NIS cocok</span>
                          </div>
                        )}
                        {nisValidationStatus === "MISMATCHED" && (
                          <div className="flex items-center gap-1 text-xs text-rose-600 font-bold animate-in fade-in duration-200">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>NIS tidak cocok</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* INPUT 3: TANGGAL LAHIR (BAHAN VERIFIKASI PERTIMBANGAN GURU) */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      3. Tanggal Lahir Siswa <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="date"
                        disabled={!isNisMatched}
                        value={regBirthDate}
                        onChange={(e) => setRegBirthDate(e.target.value)}
                        className={`w-full h-11 pl-11 pr-4 text-xs font-semibold rounded-2xl border transition-all outline-none ${
                          !isNisMatched
                            ? "bg-slate-100/50 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500 border-transparent cursor-not-allowed"
                            : "bg-slate-100/80 hover:bg-slate-100 focus:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:focus:bg-slate-900 text-slate-800 border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                        }`}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Tanggal lahir digunakan guru sebagai bahan pertimbangan persetujuan akun.
                    </p>
                  </div>

                  {/* INPUT 4: BUAT PIN 4-DIGIT & KONFIRMASI PIN */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      4. Buat PIN Keamanan (4 Angka) <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Input
                          type={showRegPin ? "text" : "password"}
                          maxLength={4}
                          disabled={!regBirthDate}
                          placeholder="PIN (4 Angka)"
                          value={regPin}
                          onChange={(e) => setRegPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          className={`w-full h-11 px-3 text-xs font-mono font-black tracking-widest text-center rounded-2xl border transition-all outline-none ${
                            !regBirthDate
                              ? "bg-slate-100/50 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500 border-transparent cursor-not-allowed"
                              : "bg-slate-100/80 hover:bg-slate-100 focus:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:focus:bg-slate-900 text-slate-800 border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                          }`}
                        />
                      </div>
                      <div>
                        <Input
                          type={showRegPin ? "text" : "password"}
                          maxLength={4}
                          disabled={!regBirthDate}
                          placeholder="Ulangi PIN"
                          value={regPinConfirm}
                          onChange={(e) => setRegPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          className={`w-full h-11 px-3 text-xs font-mono font-black tracking-widest text-center rounded-2xl border transition-all outline-none ${
                            !regBirthDate
                              ? "bg-slate-100/50 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500 border-transparent cursor-not-allowed"
                              : "bg-slate-100/80 hover:bg-slate-100 focus:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:focus:bg-slate-900 text-slate-800 border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>Gunakan 4 digit angka rahasia.</span>
                    <button
                      type="button"
                      onClick={() => setShowRegPin(!showRegPin)}
                      className="text-teal-700 font-bold hover:underline"
                    >
                      {showRegPin ? "Sembunyikan" : "Perlihatkan PIN"}
                    </button>
                  </div>

                  {/* ACTION ROW (SUBMIT + BATAL) */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      type="submit"
                      disabled={
                        regSubmitting ||
                        !selectedRosterStudent ||
                        !isNisMatched ||
                        !regBirthDate ||
                        regPin.length !== 4 ||
                        regPin !== regPinConfirm
                      }
                      className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-[#0F766E] to-[#14B8A6] hover:from-[#0D635C] hover:to-[#0F9E8E] text-white text-xs font-extrabold shadow-lg shadow-teal-700/25 hover:shadow-teal-700/35 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {regSubmitting ? (
                        <span>Mendaftarkan Akun...</span>
                      ) : (
                        <>
                          <span>Daftar & Gabung Rombel</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setJoinContext(null);
                        setMode("login");
                        // Review 36c5321: bersihkan state sensitif saat batal
                        setRegPin("");
                        setRegPinConfirm("");
                      }}
                      className="px-5 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-none text-slate-700 dark:text-slate-200 text-xs font-bold transition-all"
                    >
                      Batal
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>

        {/* Bottom Footer & Link to Teacher Login */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 w-full max-w-[420px] mx-auto lg:ml-auto lg:mr-8 xl:mr-14 pb-1">
          <span>&copy; {new Date().getFullYear()} KLASSA &bull; Siswa</span>
          <a
            href="/login"
            className="font-bold text-[#0F766E] hover:underline"
          >
            Masuk Ruang Guru &rarr;
          </a>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          SISI KANAN: S-CURVE WAVE + 3D MODULAR COCKPIT SISWA (MENYATU PUTIH)
      ───────────────────────────────────────────────────────────── */}
      <ModularCockpitArtwork theme="teal" portalType="student" />

    </div>
  );
}
