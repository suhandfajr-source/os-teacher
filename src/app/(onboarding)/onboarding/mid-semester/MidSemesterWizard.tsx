"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Users,
  Calendar,
  UserCheck,
  Award,
  CheckCircle2,
  FastForward,
  Layers,
  School as SchoolIcon,
  Play,
  RotateCcw,
} from "lucide-react";
import { submitOnboarding } from "@/modules/teachers/teachers.actions";
import ImportSiswaFlow from "@/app/(dashboard)/kelas/[teachingContextId]/import/ImportSiswaFlow";
import HistoricalSessionImportFlow from "@/app/(dashboard)/kelas/[teachingContextId]/import/HistoricalSessionImportFlow";
import HistoricalAttendanceImportFlow from "@/app/(dashboard)/kelas/[teachingContextId]/import/HistoricalAttendanceImportFlow";
import HistoricalAssessmentImportFlow from "@/app/(dashboard)/kelas/[teachingContextId]/import/HistoricalAssessmentImportFlow";

interface MidSemesterWizardProps {
  profile: {
    id: string;
    preferredName: string | null;
    activeSchoolId: string | null;
    teachingContexts: Array<{
      id: string;
      class: { name: string };
      subject: { name: string };
      academicPeriod: { year: string; semester: string };
    }>;
  } | null;
  activeSchool: {
    id: string;
    name: string;
  } | null;
  userEmail: string;
  userName: string;
}

export default function MidSemesterWizard({
  profile,
  activeSchool,
  userName,
}: MidSemesterWizardProps) {
  const router = useRouter();

  // Mode: null (choice), "START_NOW", "EXISTING_DATA"
  const [mode, setMode] = useState<"CHOICE" | "START_NOW" | "EXISTING_DATA">("CHOICE");

  // Step in existing data wizard: 1 to 6
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Context setup form state
  const [formData, setFormData] = useState({
    fullName: userName || "",
    schoolId: activeSchool?.id || "",
    schoolName: activeSchool?.name || "",
    preferredName: profile?.preferredName || "",
    academicYear: "2026/2027",
    semester: "Semester Ganjil",
    subjectName: "",
    subjectShortName: "",
    className: "",
    gradeLevel: "",
  });

  // Created or selected teachingContextId
  const [createdTeachingContextId, setCreatedTeachingContextId] = useState<string>(
    profile?.teachingContexts?.[0]?.id || ""
  );

  const handleStartNowSubmit = async () => {
    if (!formData.fullName || !formData.schoolName || !formData.subjectName || !formData.className) {
      setError("Harap lengkapi semua data wajib: Nama Lengkap, Sekolah, Mata Pelajaran, dan Kelas.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await submitOnboarding(formData);
      toast.success("Setup dasar berhasil! Memulai Teacher OS dari hari ini.");
      if (res?.context?.id) {
        router.push(`/kelas/${res.context.id}`);
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan data setup.");
      setLoading(false);
    }
  };

  const handleContextSetupForWizard = async () => {
    if (!formData.fullName || !formData.schoolName || !formData.subjectName || !formData.className) {
      setError("Harap lengkapi semua data wajib sebelum melanjutkan.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await submitOnboarding(formData);
      if (res?.context?.id) {
        setCreatedTeachingContextId(res.context.id);
      }
      toast.success("Konteks mengajar berhasil disiapkan!");
      setCurrentStep(2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan konteks mengajar.");
    } finally {
      setLoading(false);
    }
  };

  const stepsList = [
    { num: 1, label: "Konteks", icon: Layers },
    { num: 2, label: "Daftar Siswa", icon: Users },
    { num: 3, label: "Pertemuan", icon: Calendar },
    { num: 4, label: "Presensi", icon: UserCheck },
    { num: 5, label: "Nilai Selesai", icon: Award },
    { num: 6, label: "Selesai", icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-700 to-violet-800 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm">
            <Sparkles className="h-6 w-6 text-indigo-200" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Onboarding & Setup Tengah Semester</h1>
            <p className="text-indigo-100 text-sm mt-0.5">
              Mulai gunakan Teacher OS kapan saja tanpa harus merekonstruksi seluruh riwayat semester.
            </p>
          </div>
        </div>
      </div>

      {/* Choice Screen */}
      {mode === "CHOICE" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card A: Mulai dari Sekarang */}
          <Card className="hover:border-indigo-300 hover:shadow-md transition-all border-2 border-slate-200">
            <CardHeader>
              <div className="h-10 w-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-between p-2.5 mb-2">
                <Play className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Mulai dari Sekarang</CardTitle>
              <CardDescription>
                Mulai gunakan Teacher OS untuk kegiatan belajar mengajar hari ini tanpa perlu mengimpor data lampau.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>Siapkan mata pelajaran, kelas, dan daftar siswa langsung.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>Langsung catat presensi, jurnal, dan nilai untuk hari ini ke depan.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>Data riwayat lampau tetap bisa diimpor kapan saja nanti jika dibutuhkan.</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => setMode("START_NOW")}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                Pilih: Mulai dari Sekarang
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>

          {/* Card B: Saya Punya Data Sebelumnya */}
          <Card className="hover:border-indigo-300 hover:shadow-md transition-all border-2 border-slate-200">
            <CardHeader>
              <div className="h-10 w-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-between p-2.5 mb-2">
                <Layers className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Saya Punya Data Sebelumnya</CardTitle>
              <CardDescription>
                Bawa data rekap Excel yang sudah Anda miliki (Daftar Siswa, Pertemuan, Presensi, atau Nilai).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
                <span>Impor bertahap dengan pratinjau dan validasi akurat.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
                <span>Setiap langkah riwayat bersifat opsional dan dapat dilewati (Lewati).</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
                <span>Integritas data lama terjaga aman tanpa mengubah data yang sudah ada.</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => setMode("EXISTING_DATA")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                Pilih: Bawa Data Sebelumnya
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Mode A: Start Now Setup Form */}
      {mode === "START_NOW" && (
        <Card className="border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold">Setup Mulai dari Sekarang</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setMode("CHOICE")}>
                <RotateCcw className="h-4 w-4 mr-1.5" /> Ganti Pilihan
              </Button>
            </div>
            <CardDescription>
              Isi data dasar mengajar Anda untuk mulai menggunakan Teacher OS hari ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Nama Lengkap Guru</label>
                <Input
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Nama Lengkap"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Nama Sekolah</label>
                <Input
                  value={formData.schoolName}
                  onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                  placeholder="Nama Sekolah"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Tahun Akademik</label>
                <Input
                  value={formData.academicYear}
                  onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Semester</label>
                <Input
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Mata Pelajaran</label>
                <Input
                  value={formData.subjectName}
                  onChange={(e) => setFormData({ ...formData, subjectName: e.target.value })}
                  placeholder="Contoh: Matematika"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Nama Kelas</label>
                <Input
                  value={formData.className}
                  onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                  placeholder="Contoh: X IPA 1"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-4">
            <Button variant="outline" onClick={() => setMode("CHOICE")}>
              Kembali
            </Button>
            <Button
              onClick={handleStartNowSubmit}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? "Menyimpan..." : "Selesai & Masuk ke Kelas"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Mode B: Multi-Step Existing Data Wizard */}
      {mode === "EXISTING_DATA" && (
        <div className="space-y-6">
          {/* Step Indicator Bar */}
          <div className="bg-white p-3 rounded-xl border shadow-sm flex items-center justify-between overflow-x-auto gap-2">
            {stepsList.map((st) => {
              const Icon = st.icon;
              const isActive = currentStep === st.num;
              const isPassed = currentStep > st.num;
              return (
                <div
                  key={st.num}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : isPassed
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>
                    {st.num}. {st.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Step 1: Konteks Mengajar */}
          {currentStep === 1 && (
            <Card className="border shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <SchoolIcon className="h-5 w-5 text-indigo-600" />
                    Langkah 1: Konteks Mengajar
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setMode("CHOICE")}>
                    Ganti Mode
                  </Button>
                </div>
                <CardDescription>
                  Tentukan sekolah, periode akademik, mata pelajaran, dan kelas target sebelum mengimpor data.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Nama Lengkap Guru</label>
                    <Input
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Nama Sekolah</label>
                    <Input
                      value={formData.schoolName}
                      onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Tahun Akademik</label>
                    <Input
                      value={formData.academicYear}
                      onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Semester</label>
                    <Input
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Mata Pelajaran</label>
                    <Input
                      value={formData.subjectName}
                      onChange={(e) => setFormData({ ...formData, subjectName: e.target.value })}
                      placeholder="Contoh: Biologi"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Nama Kelas</label>
                    <Input
                      value={formData.className}
                      onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                      placeholder="Contoh: XI IPA 2"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-4">
                <Button variant="outline" onClick={() => setMode("CHOICE")}>
                  Batal
                </Button>
                <Button
                  onClick={handleContextSetupForWizard}
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {loading ? "Menyiapkan..." : "Lanjut ke Daftar Siswa"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Step 2: Daftar Siswa (Roster Import) */}
          {currentStep === 2 && createdTeachingContextId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-800">
                  Langkah 2: Impor Daftar Siswa ke Kelas
                </h2>
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(3)}>
                  <FastForward className="h-4 w-4 mr-1.5 text-amber-600" />
                  Lewati Langkah Ini
                </Button>
              </div>
              <ImportSiswaFlow teachingContextId={createdTeachingContextId} />
              <div className="flex justify-between pt-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Konteks
                </Button>
                <Button
                  size="sm"
                  onClick={() => setCurrentStep(3)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Lanjut ke Pertemuan Lampau
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Pertemuan Sebelumnya (Historical Sessions) */}
          {currentStep === 3 && createdTeachingContextId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-800">
                  Langkah 3: Impor Rekap Pertemuan Lampau (Opsional)
                </h2>
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(4)}>
                  <FastForward className="h-4 w-4 mr-1.5 text-amber-600" />
                  Lewati Langkah Ini
                </Button>
              </div>
              <HistoricalSessionImportFlow teachingContextId={createdTeachingContextId} />
              <div className="flex justify-between pt-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Daftar Siswa
                </Button>
                <Button
                  size="sm"
                  onClick={() => setCurrentStep(4)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Lanjut ke Presensi Lampau
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Kehadiran Sebelumnya (Historical Attendance) */}
          {currentStep === 4 && createdTeachingContextId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-800">
                  Langkah 4: Impor Rekap Presensi Lampau (Opsional)
                </h2>
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(5)}>
                  <FastForward className="h-4 w-4 mr-1.5 text-amber-600" />
                  Lewati Langkah Ini
                </Button>
              </div>
              <HistoricalAttendanceImportFlow teachingContextId={createdTeachingContextId} />
              <div className="flex justify-between pt-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(3)}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Pertemuan
                </Button>
                <Button
                  size="sm"
                  onClick={() => setCurrentStep(5)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Lanjut ke Nilai Lampau
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Nilai Selesai Sebelumnya (Historical Assessments) */}
          {currentStep === 5 && createdTeachingContextId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-800">
                  Langkah 5: Impor Rekap Nilai Lampau Selesai (Opsional)
                </h2>
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(6)}>
                  <FastForward className="h-4 w-4 mr-1.5 text-amber-600" />
                  Lewati Langkah Ini
                </Button>
              </div>
              <HistoricalAssessmentImportFlow teachingContextId={createdTeachingContextId} />
              <div className="flex justify-between pt-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(4)}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Presensi
                </Button>
                <Button
                  size="sm"
                  onClick={() => setCurrentStep(6)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Lanjut ke Ringkasan Selesai
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 6: Review & Selesai */}
          {currentStep === 6 && (
            <Card className="border shadow-sm text-center py-8">
              <CardContent className="space-y-4">
                <div className="h-16 w-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Onboarding Mid-Semester Selesai!</h2>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Konteks mengajar dan data yang Anda impor telah berhasil disimpan. Anda sekarang siap menjalankan
                  aktivitas harian Teacher OS.
                </p>
              </CardContent>
              <CardFooter className="flex justify-center gap-3">
                <Button
                  onClick={() => {
                    if (createdTeachingContextId) {
                      router.push(`/kelas/${createdTeachingContextId}`);
                    } else {
                      router.push("/kelas");
                    }
                    router.refresh();
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 px-6"
                >
                  Buka Kelas Sekarang
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
