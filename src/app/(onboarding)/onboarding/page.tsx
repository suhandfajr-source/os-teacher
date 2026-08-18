"use client";
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { submitOnboarding } from "@/modules/teachers/teachers.actions";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

import { searchSchools } from "@/modules/schools/schools.actions";
import { useDebounce } from "use-debounce";

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
    preferredName: "",
    academicYear: "2026/2027",
    semester: "Semester Ganjil",
    subjectName: "",
    subjectShortName: "",
    className: "",
    gradeLevel: ""
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 500);
  const [searchResults, setSearchResults] = useState<Array<{id: string, name: string, city: string | null}>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingNewSchool, setIsCreatingNewSchool] = useState(false);

  useEffect(() => {
    let active = true;
    if (debouncedSearch.length >= 3 && !isCreatingNewSchool && !formData.schoolId) {
      searchSchools(debouncedSearch).then(res => {
        if (active) {
          setSearchResults(res);
          setIsSearching(false);
        }
      });
    }
    return () => { active = false; };
  }, [debouncedSearch, isCreatingNewSchool, formData.schoolId]);

  useEffect(() => {
    if (session?.user?.name && !formData.fullName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(prev => ({ ...prev, fullName: session.user.name }));
    }
  }, [session, formData.fullName]);

  const handleNext = () => {
    setError("");
    if (step === 1) {
      if (!formData.fullName) {
        setError("Nama Lengkap wajib diisi");
        return;
      }
      if (!formData.schoolId && !formData.schoolName) {
        setError("Silakan pilih sekolah atau buat sekolah baru");
        return;
      }
    }
    if (step === 2 && (!formData.academicYear || !formData.semester)) {
      setError("Tahun Akademik dan Semester wajib diisi");
      return;
    }
    if (step === 3 && !formData.subjectName) {
      setError("Nama Mata Pelajaran wajib diisi");
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setError("");
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!formData.className) {
      setError("Nama Kelas wajib diisi");
      return;
    }
    setLoading(true);
    setError("");
    
    try {
      await submitOnboarding(formData);
      toast.success("Setup berhasil diselesaikan!");
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

  return (
    <Card className="shadow-lg border-2">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Setup Awal Guru</CardTitle>
        <CardDescription>
          Langkah {step} dari 4: Lengkapi profil dan konteks mengajar dasar Anda
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 1 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-semibold text-lg">Profil Guru</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Lengkap</label>
              <Input 
                value={formData.fullName} 
                onChange={e => setFormData({...formData, fullName: e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Panggilan (Opsional)</label>
              <Input 
                value={formData.preferredName} 
                onChange={e => setFormData({...formData, preferredName: e.target.value})} 
                placeholder="Pak Budi" 
              />
            </div>
            <div className="space-y-2 relative">
              <label className="text-sm font-medium">Sekolah Tempat Mengajar</label>
              
              {!formData.schoolId && !isCreatingNewSchool ? (
                <>
                  <Input 
                    value={searchQuery} 
                     onChange={e => {
                       const val = e.target.value;
                       setSearchQuery(val);
                       if (val.length < 3) {
                         setSearchResults([]);
                         setIsSearching(false);
                       } else {
                         setIsSearching(true);
                       }
                       setFormData({...formData, schoolId: "", schoolName: ""});
                    }} 
                    placeholder="Cari nama sekolah (min 3 huruf)..." 
                  />
                  {isSearching && <div className="text-xs text-muted-foreground mt-1">Mencari...</div>}
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-md max-h-60 overflow-y-auto">
                      {searchResults.map(school => (
                        <div 
                          key={school.id} 
                          className="p-2 hover:bg-gray-100 cursor-pointer text-sm border-b"
                          onClick={() => {
                            setFormData({...formData, schoolId: school.id, schoolName: school.name});
                            setSearchQuery("");
                            setSearchResults([]);
                          }}
                        >
                          <div className="font-medium">{school.name}</div>
                          {school.city && <div className="text-xs text-muted-foreground">{school.city}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {searchQuery.length >= 3 && searchResults.length === 0 && !isSearching && (
                    <div className="text-sm text-muted-foreground mt-2">
                      Sekolah tidak ditemukan. <Button variant="link" className="p-0 h-auto" onClick={() => {
                        setIsCreatingNewSchool(true);
                        setFormData({...formData, schoolName: searchQuery});
                      }}>Buat Sekolah Baru</Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-3 border rounded-md bg-slate-50 flex justify-between items-center">
                  <div>
                    <div className="font-medium">{formData.schoolName}</div>
                    <div className="text-xs text-muted-foreground">
                      {formData.schoolId ? "Bergabung dengan sekolah yang ada" : "Membuat sekolah baru"}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setFormData({...formData, schoolId: "", schoolName: ""});
                    setIsCreatingNewSchool(false);
                    setSearchQuery("");
                  }}>
                    Ubah
                  </Button>
                </div>
              )}

              {isCreatingNewSchool && (
                <div className="mt-2 space-y-2">
                   <Input 
                     value={formData.schoolName}
                     onChange={e => setFormData({...formData, schoolName: e.target.value})}
                     placeholder="Masukkan nama sekolah lengkap"
                     required
                   />
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <h3 className="font-semibold text-lg">Periode Akademik Aktif</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tahun Akademik</label>
              <Input 
                value={formData.academicYear} 
                onChange={e => setFormData({...formData, academicYear: e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Semester</label>
              <Input 
                value={formData.semester} 
                onChange={e => setFormData({...formData, semester: e.target.value})} 
                required 
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <h3 className="font-semibold text-lg">Mata Pelajaran</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Mata Pelajaran</label>
              <Input 
                value={formData.subjectName} 
                onChange={e => setFormData({...formData, subjectName: e.target.value})} 
                placeholder="Ilmu Pengetahuan Alam" 
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Singkatan (Opsional)</label>
              <Input 
                value={formData.subjectShortName} 
                onChange={e => setFormData({...formData, subjectShortName: e.target.value})} 
                placeholder="IPA" 
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <h3 className="font-semibold text-lg">Kelas Pertama</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Kelas</label>
              <Input 
                value={formData.className} 
                onChange={e => setFormData({...formData, className: e.target.value})} 
                placeholder="VIII A" 
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tingkat / Grade (Opsional)</label>
              <Input 
                value={formData.gradeLevel} 
                onChange={e => setFormData({...formData, gradeLevel: e.target.value})} 
                placeholder="8" 
              />
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between mt-4">
        <Button variant="outline" onClick={handleBack} disabled={step === 1 || loading}>
          Kembali
        </Button>
        {step < 4 ? (
          <Button onClick={handleNext}>Lanjut</Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Menyimpan..." : "Selesai"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
