"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClassAction } from "@/modules/classes/classes.actions";
import { toast } from "sonner";
import {
  Plus,
  BookOpen,
  Users,
  Search,
  School,
  GraduationCap,
  Calendar,
} from "lucide-react";

interface ContextItem {
  id: string;
  subject: { id: string; name: string };
  class: {
    id: string;
    name: string;
    gradeLevel: string | null;
    _count: { classStudents: number };
  };
  academicPeriod: { id: string; year: string; semester: string };
}

interface SchoolMasterData {
  classes: { id: string; name: string; gradeLevel: string | null }[];
  subjects: { id: string; name: string }[];
  academicPeriods: { id: string; year: string; semester: string; status: string }[];
}

interface Props {
  contexts: ContextItem[];
  schoolMaster: SchoolMasterData;
  schoolName: string;
}

export function KelasOverviewClient({ contexts, schoolMaster, schoolName }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [className, setClassName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    schoolMaster.subjects[0]?.id || ""
  );
  const [isCustomSubject, setIsCustomSubject] = useState(
    schoolMaster.subjects.length === 0
  );
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    schoolMaster.academicPeriods.find((p) => p.status === "ACTIVE")?.id ||
      schoolMaster.academicPeriods[0]?.id ||
      ""
  );

  const filteredContexts = contexts.filter((ctx) => {
    const q = searchQuery.toLowerCase();
    return (
      ctx.class.name.toLowerCase().includes(q) ||
      ctx.subject.name.toLowerCase().includes(q) ||
      ctx.academicPeriod.year.toLowerCase().includes(q)
    );
  });

  const handleOpenModal = () => {
    setClassName("");
    setGradeLevel("");
    if (schoolMaster.subjects.length > 0) {
      setSelectedSubjectId(schoolMaster.subjects[0].id);
      setIsCustomSubject(false);
    } else {
      setIsCustomSubject(true);
    }
    setCustomSubjectName("");
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) {
      toast.error("Nama kelas wajib diisi");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createClassAction({
          className: className.trim(),
          gradeLevel: gradeLevel.trim() || undefined,
          subjectId: !isCustomSubject && selectedSubjectId ? selectedSubjectId : undefined,
          newSubjectName: isCustomSubject ? customSubjectName.trim() : undefined,
          academicPeriodId: selectedPeriodId || undefined,
        });

        if (res.success) {
          toast.success(`Kelas "${className}" berhasil ditambahkan!`);
          setIsModalOpen(false);
          router.refresh();
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Gagal menambahkan kelas";
        toast.error(msg);
      }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header with Title and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daftar Kelas Mengajar</h1>
          <p className="text-muted-foreground mt-1">
            Kelola kelas di <span className="font-semibold text-foreground">{schoolName}</span>, tambah jadwal mengajar, dan akses data siswa.
          </p>
        </div>

        <Button
          onClick={handleOpenModal}
          size="default"
          className="gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Tambah Kelas
        </Button>
      </div>

      {/* Search Filter */}
      {contexts.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama kelas atau mata pelajaran..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
      )}

      {/* Grid of Classes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContexts.map((ctx) => (
          <Link href={`/kelas/${ctx.id}`} key={ctx.id} className="block group">
            <Card className="hover:border-primary transition-all duration-150 hover:shadow-sm cursor-pointer h-full flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">
                    {ctx.class.name}
                  </CardTitle>
                  {ctx.class.gradeLevel && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-medium">
                      Tingkat {ctx.class.gradeLevel}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <BookOpen className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium">{ctx.subject.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {ctx.academicPeriod.year} ({ctx.academicPeriod.semester})
                  </span>
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    {ctx.class._count.classStudents} Siswa
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {/* Empty State */}
        {filteredContexts.length === 0 && (
          <div className="col-span-full py-12 px-6 text-center border-2 border-dashed rounded-xl bg-card space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <School className="h-6 w-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="font-semibold text-lg">
                {searchQuery ? "Kelas Tidak Ditemukan" : "Belum Ada Kelas Mengajar"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? `Tidak ada kelas yang cocok dengan kata kunci "${searchQuery}".`
                  : "Mulai dengan menambahkan kelas dan mata pelajaran yang Anda ampu di sekolah ini."}
              </p>
            </div>
            <Button onClick={handleOpenModal} className="gap-2">
              <Plus className="h-4 w-4" />
              Tambah Kelas Sekarang
            </Button>
          </div>
        )}
      </div>

      {/* Modal Dialog: Tambah Kelas */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-primary" />
              Tambah Kelas Mengajar
            </DialogTitle>
            <DialogDescription>
              Tambahkan data kelas baru untuk tahun ajaran aktif di {schoolName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Nama Kelas */}
            <div className="space-y-1.5">
              <Label htmlFor="className" className="text-sm font-semibold">
                Nama Kelas <span className="text-destructive">*</span>
              </Label>
              <Input
                id="className"
                placeholder="Contoh: X IPA 1, 7A, XII RPL"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Tingkat / Grade Level */}
            <div className="space-y-1.5">
              <Label htmlFor="gradeLevel" className="text-sm font-semibold">
                Tingkat / Jenjang Kelas <span className="text-xs font-normal text-muted-foreground">(Opsional)</span>
              </Label>
              <Input
                id="gradeLevel"
                placeholder="Contoh: 10, 7, 12, atau SD 1"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
              />
            </div>

            {/* Mata Pelajaran */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold">Mata Pelajaran</Label>
                {schoolMaster.subjects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCustomSubject(!isCustomSubject)}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {isCustomSubject ? "Pilih dari Daftar" : "+ Input Mapel Baru"}
                  </button>
                )}
              </div>

              {!isCustomSubject && schoolMaster.subjects.length > 0 ? (
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {schoolMaster.subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder="Contoh: Matematika, Fisika, Bahasa Indonesia"
                  value={customSubjectName}
                  onChange={(e) => setCustomSubjectName(e.target.value)}
                  required={isCustomSubject}
                />
              )}
            </div>

            {/* Periode Akademik */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Periode Akademik</Label>
              {schoolMaster.academicPeriods.length > 0 ? (
                <select
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {schoolMaster.academicPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.year} — Semester {p.semester} {p.status === "ACTIVE" ? "(Aktif)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Periode default (2024/2025 Ganjil) akan otomatis digunakan.
                </p>
              )}
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button type="submit" loading={isPending}>
                Simpan & Tambahkan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
