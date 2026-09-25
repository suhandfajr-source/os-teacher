"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { submitOnboarding } from "@/modules/teachers/teachers.actions";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { searchSchools, createSchool } from "@/modules/schools/schools.actions";
import { useDebounce } from "use-debounce";
import {
  User,
  Building2,
  Calendar,
  BookOpen,
  GraduationCap,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Search,
  Plus,
  HelpCircle,
  School,
  Check,
  Info,
  Clock,
} from "lucide-react";
import Link from "next/link";

interface SchoolSearchResult {
  id: string;
  name: string;
  city: string | null;
  npsn: string | null;
  activeTeacherCount: number;
  classCount: number;
}

const STEPS = [
  { id: 1, title: "Profil & Sekolah", icon: User },
  { id: 2, title: "Tahun Ajaran", icon: Calendar },
  { id: 3, title: "Mata Pelajaran", icon: BookOpen },
  { id: 4, title: "Kelas & Rombel", icon: GraduationCap },
];

const QUICK_SUBJECT_SUGGESTIONS = [
  { name: "Matematika", short: "MTK" },
  { name: "Bahasa Indonesia", short: "BINDO" },
  { name: "Ilmu Pengetahuan Alam", short: "IPA" },
  { name: "Bahasa Inggris", short: "BING" },
  { name: "Ilmu Pengetahuan Sosial", short: "IPS" },
  { name: "Pendidikan Pancasila & Kewarganegaraan", short: "PPKn" },
];

const QUICK_CLASS_SUGGESTIONS = ["7-A", "7-B", "8-A", "8-B", "9-A", "9-B", "10-1", "11-1", "12-1"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: session } = authClient.useSession();

  const [formData, setFormData] = useState({
    fullName: "",
    schoolId: "",
    schoolName: "",
    city: "",
    npsn: "",
    preferredName: "",
    academicYear: "2024/2025",
    semester: "Semester Ganjil",
    subjectName: "",
    subjectShortName: "",
    className: "",
    gradeLevel: "7",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 400);
  const [searchResults, setSearchResults] = useState<SchoolSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingNewSchool, setIsCreatingNewSchool] = useState(false);

  // Dedup states
  const [dedupBlocked, setDedupBlocked] = useState<{ id: string; name: string; city?: string | null; npsn?: string | null } | null>(null);
  const [similarConfirmation, setSimilarConfirmation] = useState<{
    matched: { id: string; name: string; city?: string | null; npsn?: string | null };
    similarity: number;
  } | null>(null);

  useEffect(() => {
    let active = true;
    if (debouncedSearch.length >= 3 && !isCreatingNewSchool && !formData.schoolId) {
      setIsSearching(true);
      searchSchools(debouncedSearch).then((res) => {
        if (active) {
          setSearchResults(res);
          setIsSearching(false);
        }
      });
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
    return () => {
      active = false;
    };
  }, [debouncedSearch, isCreatingNewSchool, formData.schoolId]);

  useEffect(() => {
    if (session?.user?.name && !formData.fullName) {
      setFormData((prev) => ({ ...prev, fullName: session.user.name }));
    }
  }, [session, formData.fullName]);

  const handleNext = async () => {
    setError("");
    setDedupBlocked(null);

    if (step === 1) {
      if (!formData.fullName.trim()) {
        setError("Nama Lengkap wajib diisi.");
        return;
      }
      if (!formData.schoolId && !formData.schoolName.trim()) {
        setError("Silakan pilih sekolah dari pencarian atau buat sekolah baru.");
        return;
      }

      // Validasi gerbang dedup saat membuat sekolah baru
      if (isCreatingNewSchool && !formData.schoolId) {
        setLoading(true);
        try {
          const res = await createSchool({
            name: formData.schoolName,
            city: formData.city || undefined,
            npsn: formData.npsn || undefined,
            forceCreate: false,
          });

          if (!res.success) {
            if (res.code === "NPSN_EXISTS" || res.code === "EXACT_NAME_EXISTS") {
              setDedupBlocked(res.existingSchool || null);
              setError(res.message);
              setLoading(false);
              return;
            }
            if (res.code === "SIMILAR_NAME_FOUND" && res.matchedSchool) {
              setSimilarConfirmation({
                matched: res.matchedSchool,
                similarity: res.similarity || 0,
              });
              setLoading(false);
              return;
            }
            setError(res.message);
            setLoading(false);
            return;
          }

          // Lolos dedup dan sukses dibuat
          setFormData((prev) => ({
            ...prev,
            schoolId: res.school.id,
            schoolName: res.school.name,
          }));
          setIsCreatingNewSchool(false);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Gagal memproses sekolah");
          setLoading(false);
          return;
        } finally {
          setLoading(false);
        }
      }
    }

    if (step === 2 && (!formData.academicYear.trim() || !formData.semester.trim())) {
      setError("Tahun Akademik dan Semester wajib diisi.");
      return;
    }
    if (step === 3 && !formData.subjectName.trim()) {
      setError("Nama Mata Pelajaran wajib diisi.");
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setError("");
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!formData.className.trim()) {
      setError("Nama Kelas / Rombel wajib diisi.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await submitOnboarding({
        fullName: formData.fullName,
        schoolId: formData.schoolId || undefined,
        schoolName: formData.schoolName || undefined,
        city: formData.city || undefined,
        npsn: formData.npsn || undefined,
        preferredName: formData.preferredName || undefined,
        academicYear: formData.academicYear,
        semester: formData.semester,
        subjectName: formData.subjectName,
        subjectShortName: formData.subjectShortName || undefined,
        className: formData.className,
        gradeLevel: formData.gradeLevel || undefined,
      });

      if (!res.success) {
        setError(res.message || "Gagal menyelesaikan setup awal.");
        setLoading(false);
        return;
      }

      toast.success("Setup berhasil diselesaikan! Selamat datang di KLASSA.");
      router.push("/");
      router.refresh();
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message || "Terjadi kesalahan saat menyimpan data");
      } else {
        setError("Terjadi kesalahan saat menyimpan data");
      }
      setLoading(false);
    }
  };

  const progressPercentage = (step / 4) * 100;

  return (
    <div className="space-y-5">
      {/* 4-Step Interactive Stepper Bar */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((s) => {
            const isCompleted = step > s.id;
            const isCurrent = step === s.id;
            const StepIcon = s.icon;

            return (
              <div
                key={s.id}
                className={`flex flex-col sm:flex-row items-center gap-2 p-2 rounded-xl transition-all duration-200 ${
                  isCurrent
                    ? "bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60 shadow-xs"
                    : isCompleted
                    ? "text-slate-700 dark:text-slate-300"
                    : "text-slate-400 dark:text-slate-600"
                }`}
              >
                <div
                  className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                    isCompleted
                      ? "bg-emerald-600 text-white"
                      : isCurrent
                      ? "bg-teal-600 text-white shadow-xs shadow-teal-500/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : s.id}
                </div>
                <div className="text-center sm:text-left truncate">
                  <div
                    className={`text-[11px] font-semibold truncate ${
                      isCurrent
                        ? "text-teal-900 dark:text-teal-200"
                        : isCompleted
                        ? "text-slate-800 dark:text-slate-200"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {s.title}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:block">
                    {isCompleted ? "Selesai" : isCurrent ? "Aktif" : "Menunggu"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Gradient Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Main Form Glass Card */}
      <Card className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-5 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Langkah {step} dari 4
                </span>
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                {step === 1 && "Profil Guru & Sekolah Anda"}
                {step === 2 && "Tahun Ajaran & Semester Aktif"}
                {step === 3 && "Mata Pelajaran yang Diampu"}
                {step === 4 && "Rombongan Belajar (Kelas Pertama)"}
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                {step === 1 && "Lengkapi data identitas pendidik dan tempat bertugas Anda."}
                {step === 2 && "Tentukan kalender akademik pembelajaran yang sedang berlangsung."}
                {step === 3 && "Pilih atau ketik nama mata pelajaran yang akan Anda kelola."}
                {step === 4 && "Buat kelas pertama Anda untuk memulai pencatatan absensi & nilai."}
              </CardDescription>
            </div>

            <Link
              href="/onboarding/mid-semester"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shrink-0 self-start sm:self-center"
            >
              <Clock className="h-3.5 w-3.5" />
              Setup Tengah Semester
            </Link>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          {error && (
            <Alert variant="destructive" className="border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200">
              <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
            </Alert>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: PROFIL GURU & SEKOLAH                                             */}
          {/* ========================================================================= */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  Nama Lengkap beserta Gelar <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Contoh: Siti Rahmawati, S.Pd"
                  className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:border-teal-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                  Nama Panggilan (Opsional)
                </label>
                <Input
                  value={formData.preferredName}
                  onChange={(e) => setFormData({ ...formData, preferredName: e.target.value })}
                  placeholder="Contoh: Bu Siti / Pak Budi"
                  className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Nama ini akan digunakan oleh asisten AI saat menyapa Anda secara personal.
                </p>
              </div>

              {/* Sekolah Selector */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    Sekolah Tempat Mengajar <span className="text-red-500">*</span>
                  </span>
                  {!formData.schoolId && !isCreatingNewSchool && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingNewSchool(true);
                        setFormData({ ...formData, schoolName: searchQuery || "" });
                      }}
                      className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-medium"
                    >
                      <Plus className="h-3 w-3" /> Buat Sekolah Baru
                    </button>
                  )}
                </label>

                {!formData.schoolId && !isCreatingNewSchool ? (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSearchQuery(val);
                          setFormData({ ...formData, schoolId: "", schoolName: "" });
                        }}
                        placeholder="Ketik nama sekolah atau NPSN (min 3 huruf)..."
                        className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                      />
                    </div>

                    {isSearching && (
                      <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-teal-500 animate-ping" />
                        Mencari database sekolah...
                      </div>
                    )}

                    {searchResults.length > 0 && (
                      <div className="absolute z-20 w-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {searchResults.map((school) => (
                          <div
                            key={school.id}
                            className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer transition-colors flex items-center justify-between gap-3"
                            onClick={() => {
                              setFormData({ ...formData, schoolId: school.id, schoolName: school.name });
                              setSearchQuery("");
                              setSearchResults([]);
                            }}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-slate-900 dark:text-white text-xs truncate">
                                {school.name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {school.city ? `${school.city} • ` : ""}
                                {school.npsn ? `NPSN: ${school.npsn}` : "NPSN: —"}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50">
                                {school.activeTeacherCount} Guru
                              </span>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {school.classCount} Kelas
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {searchQuery.length >= 3 && searchResults.length === 0 && !isSearching && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
                        <span>Sekolah tidak ditemukan di database.</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs bg-white dark:bg-slate-900 border-teal-500/40 text-teal-700 dark:text-teal-300"
                          onClick={() => {
                            setIsCreatingNewSchool(true);
                            setFormData({ ...formData, schoolName: searchQuery });
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Buat Sekolah Baru
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Terpilih / Mode Buat Sekolah */
                  <div className="p-3.5 border border-teal-200 dark:border-teal-800/60 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                        <School className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs truncate">
                          {formData.schoolName}
                        </div>
                        <div className="text-[11px] text-teal-700 dark:text-teal-400">
                          {formData.schoolId ? "Bergabung dengan sekolah terdaftar" : "Akan membuat sekolah baru"}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      onClick={() => {
                        setFormData({ ...formData, schoolId: "", schoolName: "", npsn: "", city: "" });
                        setIsCreatingNewSchool(false);
                        setSearchQuery("");
                        setDedupBlocked(null);
                      }}
                    >
                      Ganti
                    </Button>
                  </div>
                )}

                {/* Banner Dedup Blocked */}
                {dedupBlocked && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <div className="font-semibold">{dedupBlocked.name}</div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                        {dedupBlocked.city ? `${dedupBlocked.city} • ` : ""}
                        {dedupBlocked.npsn ? `NPSN: ${dedupBlocked.npsn}` : ""}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-500 text-white text-xs shrink-0"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          schoolId: dedupBlocked.id,
                          schoolName: dedupBlocked.name,
                        }));
                        setIsCreatingNewSchool(false);
                        setDedupBlocked(null);
                        setError("");
                      }}
                    >
                      Gunakan Sekolah Ini
                    </Button>
                  </div>
                )}

                {/* Detail Buat Sekolah Baru */}
                {isCreatingNewSchool && (
                  <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl mt-2">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Lengkapi Detail Sekolah Baru
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Nama Resmi Sekolah <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={formData.schoolName}
                        onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                        placeholder="Contoh: SMP Negeri 1 Nusantara"
                        className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">NPSN (Opsional)</label>
                        <Input
                          value={formData.npsn}
                          onChange={(e) => setFormData({ ...formData, npsn: e.target.value })}
                          placeholder="8 digit angka"
                          className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Kota / Kabupaten</label>
                        <Input
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          placeholder="Contoh: Kota Surabaya"
                          className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: TAHUN AJARAN & SEMESTER                                           */}
          {/* ========================================================================= */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  Tahun Akademik <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.academicYear}
                  onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                  placeholder="Contoh: 2024/2025"
                  className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                  required
                />
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">Pilihan Cepat:</span>
                  {["2024/2025", "2025/2026", "2026/2027"].map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setFormData({ ...formData, academicYear: yr })}
                      className={`text-[11px] px-2.5 py-0.5 rounded-lg border transition-colors ${
                        formData.academicYear === yr
                          ? "bg-teal-600 text-white border-teal-600"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Semester Aktif <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { val: "Semester Ganjil", label: "Semester 1 (Ganjil)", desc: "Juli – Desember" },
                    { val: "Semester Genap", label: "Semester 2 (Genap)", desc: "Januari – Juni" },
                  ].map((sem) => (
                    <div
                      key={sem.val}
                      onClick={() => setFormData({ ...formData, semester: sem.val })}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        formData.semester === sem.val
                          ? "bg-teal-50 dark:bg-teal-950/60 border-teal-500 dark:border-teal-500 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="font-semibold text-xs text-slate-900 dark:text-white">{sem.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sem.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: MATA PELAJARAN                                                    */}
          {/* ========================================================================= */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  Nama Mata Pelajaran <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.subjectName}
                  onChange={(e) => setFormData({ ...formData, subjectName: e.target.value })}
                  placeholder="Contoh: Matematika / Bahasa Indonesia"
                  className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                  required
                />
              </div>

              {/* Quick Suggestions */}
              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400 dark:text-slate-500">Saran Mata Pelajaran Umum:</div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SUBJECT_SUGGESTIONS.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          subjectName: item.name,
                          subjectShortName: item.short,
                        })
                      }
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        formData.subjectName === item.name
                          ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Singkatan / Kode Mapel (Opsional)
                </label>
                <Input
                  value={formData.subjectShortName}
                  onChange={(e) => setFormData({ ...formData, subjectShortName: e.target.value })}
                  placeholder="Contoh: MTK / IPA"
                  className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm uppercase max-w-xs"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: KELAS & ROMBEL PERTAMA                                            */}
          {/* ========================================================================= */}
          {step === 4 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-3 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    Nama Kelas / Rombel <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                    placeholder="Contoh: 7-A / 8-B"
                    className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Jenjang / Tingkat
                  </label>
                  <select
                    value={formData.gradeLevel}
                    onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-teal-500"
                  >
                    <option value="7">Tingkat 7 (SMP / MTs)</option>
                    <option value="8">Tingkat 8 (SMP / MTs)</option>
                    <option value="9">Tingkat 9 (SMP / MTs)</option>
                    <option value="10">Tingkat 10 (SMA / SMK)</option>
                    <option value="11">Tingkat 11 (SMA / SMK)</option>
                    <option value="12">Tingkat 12 (SMA / SMK)</option>
                    <option value="1">Tingkat 1 (SD / MI)</option>
                    <option value="2">Tingkat 2 (SD / MI)</option>
                    <option value="3">Tingkat 3 (SD / MI)</option>
                    <option value="4">Tingkat 4 (SD / MI)</option>
                    <option value="5">Tingkat 5 (SD / MI)</option>
                    <option value="6">Tingkat 6 (SD / MI)</option>
                  </select>
                </div>
              </div>

              {/* Quick Class Pills */}
              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400 dark:text-slate-500">Pilihan Cepat Nama Rombel:</div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_CLASS_SUGGESTIONS.map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setFormData({ ...formData, className: cls })}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        formData.className === cls
                          ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Review Card Before Final Submit */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  Ringkasan Setup Pembelajaran
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Guru:</span>{" "}
                    <strong className="text-slate-800 dark:text-slate-200">{formData.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Sekolah:</span>{" "}
                    <strong className="text-slate-800 dark:text-slate-200">{formData.schoolName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Tahun Ajaran:</span>{" "}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {formData.academicYear} ({formData.semester})
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Mapel:</span>{" "}
                    <strong className="text-slate-800 dark:text-slate-200">{formData.subjectName}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        {/* Card Footer Actions */}
        <CardFooter className="border-t border-slate-100 dark:border-slate-800/80 p-5 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={loading}
              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali
            </Button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold gap-1.5 shadow-md shadow-teal-500/20"
            >
              {loading ? "Memproses..." : "Lanjutkan"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-semibold gap-1.5 shadow-lg shadow-teal-500/25 px-5"
            >
              {loading ? "Menyimpan Ekosistem..." : "Selesaikan Setup & Mulai Mengajar"}
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Dialog Konfirmasi Kemiripan (Skenario C: "Maksud Anda?") */}
      <Dialog open={!!similarConfirmation} onOpenChange={(open) => !open && setSimilarConfirmation(null)}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              Konfirmasi Nama Sekolah
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Sistem mendeteksi sekolah dengan nama yang sangat mirip di database:
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl space-y-1 my-2">
            <div className="font-semibold text-teal-950 dark:text-teal-200 text-sm">
              {similarConfirmation?.matched.name}
            </div>
            <div className="text-xs text-teal-700 dark:text-teal-400">
              {similarConfirmation?.matched.city ? `${similarConfirmation?.matched.city} • ` : ""}
              {similarConfirmation?.matched.npsn ? `NPSN: ${similarConfirmation?.matched.npsn} • ` : ""}
              Tingkat Kemiripan: {Math.round((similarConfirmation?.similarity || 0) * 100)}%
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await createSchool({
                    name: formData.schoolName,
                    city: formData.city || undefined,
                    npsn: formData.npsn || undefined,
                    forceCreate: true, // Bypass sadar
                  });
                  if (res.success) {
                    setFormData((prev) => ({
                      ...prev,
                      schoolId: res.school.id,
                      schoolName: res.school.name,
                    }));
                    setIsCreatingNewSchool(false);
                    setSimilarConfirmation(null);
                    setStep(2);
                  } else {
                    setError(res.message);
                  }
                } catch (err: unknown) {
                  setError(err instanceof Error ? err.message : "Gagal membuat sekolah");
                } finally {
                  setLoading(false);
                }
              }}
              className="text-xs"
            >
              Bukan, Tetap Buat Baru
            </Button>
            <Button
              size="sm"
              disabled={loading}
              onClick={() => {
                if (similarConfirmation) {
                  setFormData((prev) => ({
                    ...prev,
                    schoolId: similarConfirmation.matched.id,
                    schoolName: similarConfirmation.matched.name,
                  }));
                  setIsCreatingNewSchool(false);
                  setSimilarConfirmation(null);
                  setStep(2);
                }
              }}
              className="bg-teal-600 hover:bg-teal-500 text-white text-xs"
            >
              Ya, Gunakan Sekolah Ini
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
