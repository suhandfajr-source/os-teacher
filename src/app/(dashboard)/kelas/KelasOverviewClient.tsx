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
import { createClassAction, updateClassAction } from "@/modules/classes/classes.actions";
import { toast } from "sonner";
import {
  Plus,
  BookOpen,
  Users,
  Search,
  School,
  GraduationCap,
  Calendar,
  Clock,
  Edit3,
} from "lucide-react";
import { ScheduleConfigDialog } from "@/components/schedule/ScheduleConfigDialog";

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

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editClassId, setEditClassId] = useState("");
  const [editClassName, setEditClassName] = useState("");
  const [editGradeLevel, setEditGradeLevel] = useState("");

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

  const handleOpenEditModal = (classId: string, currentName: string, currentGrade: string | null) => {
    setEditClassId(classId);
    setEditClassName(currentName);
    setEditGradeLevel(currentGrade || "");
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editClassName.trim()) {
      toast.error("Nama kelas wajib diisi");
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateClassAction({
          classId: editClassId,
          className: editClassName.trim(),
          gradeLevel: editGradeLevel.trim() || undefined,
        });

        if (res.success) {
          toast.success(`Data kelas "${editClassName}" berhasil diperbarui!`);
          setIsEditModalOpen(false);
          router.refresh();
        } else {
          toast.error(res.message || "Gagal memperbarui kelas");
        }
      } catch (err: unknown) {
        toast.error((err as Error).message || "Terjadi kesalahan saat memperbarui kelas");
      }
    });
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10 pt-4">
        {filteredContexts.map((ctx, index) => {
          // Palette rotation for floating badges
          const badgeGradients = [
            "from-teal-600 to-emerald-400",
            "from-pink-600 to-rose-400",
            "from-blue-600 to-cyan-400",
            "from-purple-600 to-fuchsia-400",
            "from-amber-500 to-orange-400",
            "from-indigo-600 to-violet-400",
          ];
          const gradient = badgeGradients[index % badgeGradients.length];

          return (
            <Link href={`/kelas/${ctx.id}`} key={ctx.id} className="block group">
              <div className="bg-white rounded-3xl p-6 pt-9 shadow-squircle-card hover:shadow-squircle-card-hover border border-slate-100/90 relative flex flex-col justify-between h-full transition-all duration-200 cursor-pointer">
                {/* Floating Squircle Icon Overlap */}
                <div
                  className={`absolute -top-5 left-6 w-12 h-12 rounded-2xl bg-gradient-to-tr ${gradient} text-white flex items-center justify-center shadow-floating-badge group-hover:scale-110 group-hover:-translate-y-1 transition-transform`}
                >
                  <BookOpen className="w-6 h-6" />
                </div>

                {/* Top Status Tag */}
                <div className="flex items-center justify-end mb-3">
                  {ctx.class.gradeLevel ? (
                    <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100">
                      Tingkat {ctx.class.gradeLevel}
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-100">
                      Reguler
                    </span>
                  )}
                </div>

                {/* Title & Subject */}
                <div className="space-y-1.5">
                  <h3 className="text-base font-extrabold text-slate-900 group-hover:text-teal-700 transition-colors">
                    {ctx.class.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                    <GraduationCap className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>{ctx.subject.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {ctx.academicPeriod.year} ({ctx.academicPeriod.semester})
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div className="my-4 border-t border-slate-100"></div>

                {/* Footer: Students Count + Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Users className="w-4 h-4 text-teal-700" />
                    <span>{ctx.class._count.classStudents} Siswa</span>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 rounded-xl text-xs font-bold text-slate-600 hover:text-teal-700 hover:bg-teal-50 gap-1"
                      title="Edit Data Kelas"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOpenEditModal(ctx.class.id, ctx.class.name, ctx.class.gradeLevel);
                      }}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Button>

                    <ScheduleConfigDialog
                      teachingContextId={ctx.id}
                      contextTitle={`${ctx.subject.name} — ${ctx.class.name}`}
                      triggerButton={
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 rounded-xl text-xs font-bold text-teal-700 hover:bg-teal-50 gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Jadwal</span>
                        </Button>
                      }
                    />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {/* Empty State */}
        {filteredContexts.length === 0 && (
          <div className="col-span-full py-12 px-6 text-center border-2 border-dashed rounded-3xl bg-white space-y-4 shadow-2xs">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-700 shadow-2xs">
              <School className="h-6 w-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="font-bold text-lg text-slate-900">
                {searchQuery ? "Kelas Tidak Ditemukan" : "Belum Ada Kelas Mengajar"}
              </h3>
              <p className="text-xs text-slate-500">
                {searchQuery
                  ? `Tidak ada kelas yang cocok dengan kata kunci "${searchQuery}".`
                  : "Mulai dengan menambahkan kelas dan mata pelajaran yang Anda ampu di sekolah ini."}
              </p>
            </div>
            <Button onClick={handleOpenModal} className="gap-2 rounded-full bg-teal-700 hover:bg-teal-800 text-white font-bold">
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

      {/* Modal Dialog: Edit Kelas */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Edit3 className="h-5 w-5 text-teal-600" />
              Edit Data Kelas
            </DialogTitle>
            <DialogDescription>
              Ubah nama rombel atau tingkat kelas untuk {schoolName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            {/* Nama Kelas */}
            <div className="space-y-1.5">
              <Label htmlFor="editClassName" className="text-sm font-semibold">
                Nama Kelas / Rombel <span className="text-destructive">*</span>
              </Label>
              <Input
                id="editClassName"
                placeholder="Contoh: 8-B, 7A, X IPA 1"
                value={editClassName}
                onChange={(e) => setEditClassName(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Tingkat / Grade Level */}
            <div className="space-y-1.5">
              <Label htmlFor="editGradeLevel" className="text-sm font-semibold">
                Tingkat / Jenjang Kelas <span className="text-xs font-normal text-muted-foreground">(Opsional)</span>
              </Label>
              <Input
                id="editGradeLevel"
                placeholder="Contoh: 8, 7, 10, atau SD 1"
                value={editGradeLevel}
                onChange={(e) => setEditGradeLevel(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Isi dengan angka jenjang (contoh: 8) agar label tingkatan kelas tampil sesuai.
              </p>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button type="submit" loading={isPending} className="bg-teal-700 hover:bg-teal-800 text-white font-bold">
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
