"use client";
import React, { useState, useTransition } from "react";
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
import { Plus, GraduationCap } from "lucide-react";
import type { TeacherProfile, AcademicPeriod, Subject, Class as PrismaClass, TeachingContext, School } from "@prisma/client";

type ProfileWithContext = TeacherProfile & {
  teachingContexts: (TeachingContext & { academicPeriod: AcademicPeriod, subject: Subject, class: PrismaClass })[];
};

type SchoolWithMaster = School & {
  academicPeriods: AcademicPeriod[];
  subjects: Subject[];
  classes: PrismaClass[];
};

export default function SetupManager({ initialProfile, activeSchool }: { initialProfile: ProfileWithContext, activeSchool: SchoolWithMaster }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("context");
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [className, setClassName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState(activeSchool.subjects[0]?.id || "");
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeSchool.academicPeriods.find(p => p.status === "ACTIVE")?.id || activeSchool.academicPeriods[0]?.id || ""
  );

  const handleCreateClass = (e: React.FormEvent) => {
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
          subjectId: selectedSubjectId || undefined,
          academicPeriodId: selectedPeriodId || undefined,
        });

        if (res.success) {
          toast.success(`Kelas "${className}" berhasil dibuat!`);
          setIsClassModalOpen(false);
          setClassName("");
          setGradeLevel("");
          router.refresh();
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Gagal menambahkan kelas";
        toast.error(msg);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center border-b pb-2 flex-wrap gap-2">
        <div className="flex space-x-2 overflow-x-auto pb-1">
          <Button variant={activeTab === "context" ? "default" : "ghost"} onClick={() => setActiveTab("context")}>
            Konteks Mengajar
          </Button>
          <Button variant={activeTab === "period" ? "default" : "ghost"} onClick={() => setActiveTab("period")}>
            Periode Akademik
          </Button>
          <Button variant={activeTab === "subject" ? "default" : "ghost"} onClick={() => setActiveTab("subject")}>
            Mata Pelajaran
          </Button>
          <Button variant={activeTab === "class" ? "default" : "ghost"} onClick={() => setActiveTab("class")}>
            Kelas
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setIsClassModalOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Tambah Kelas
          </Button>
          <a
            href="/onboarding/mid-semester"
            className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            Mulai di Tengah Semester
          </a>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              {activeTab === "context" && "Konteks Mengajar Aktif"}
              {activeTab === "period" && `Daftar Periode Akademik (${activeSchool.name})`}
              {activeTab === "subject" && `Daftar Mata Pelajaran (${activeSchool.name})`}
              {activeTab === "class" && `Daftar Kelas (${activeSchool.name})`}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === "context" && (
            <div className="space-y-4">
              {initialProfile.teachingContexts.map((ctx) => (
                <div key={ctx.id} className="p-4 border rounded-md">
                  <div className="font-semibold">{ctx.subject.name} — {ctx.class.name}</div>
                  <div className="text-sm text-muted-foreground">{ctx.academicPeriod.year} {ctx.academicPeriod.semester}</div>
                </div>
              ))}
              {initialProfile.teachingContexts.length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada konteks mengajar.</p>
              )}
            </div>
          )}
          {activeTab === "period" && (
            <div className="space-y-4">
              {activeSchool.academicPeriods.map((p) => (
                <div key={p.id} className="p-4 border rounded-md flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{p.year}</div>
                    <div className="text-sm text-muted-foreground">{p.semester}</div>
                  </div>
                  <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{p.status}</div>
                </div>
              ))}
            </div>
          )}
          {activeTab === "subject" && (
            <div className="space-y-4">
              {activeSchool.subjects.map((s) => (
                <div key={s.id} className="p-4 border rounded-md">
                  <div className="font-semibold">{s.name}</div>
                  {s.shortName && <div className="text-sm text-muted-foreground">{s.shortName}</div>}
                </div>
              ))}
            </div>
          )}
          {activeTab === "class" && (
            <div className="space-y-4">
              {activeSchool.classes.map((c) => (
                <div key={c.id} className="p-4 border rounded-md flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    {c.gradeLevel && <div className="text-sm text-muted-foreground">Tingkat {c.gradeLevel}</div>}
                  </div>
                </div>
              ))}
              {activeSchool.classes.length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada kelas yang terdaftar di sekolah ini.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Tambah Kelas */}
      <Dialog open={isClassModalOpen} onOpenChange={setIsClassModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Tambah Kelas Baru
            </DialogTitle>
            <DialogDescription>
              Buat kelas baru di {activeSchool.name} dan hubungkan dengan jadwal mengajar Anda.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateClass} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="setup-className" className="text-sm font-semibold">
                Nama Kelas <span className="text-destructive">*</span>
              </Label>
              <Input
                id="setup-className"
                placeholder="Contoh: X IPA 1, 7A, XII RPL"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="setup-gradeLevel" className="text-sm font-semibold">
                Tingkat / Jenjang <span className="text-xs font-normal text-muted-foreground">(Opsional)</span>
              </Label>
              <Input
                id="setup-gradeLevel"
                placeholder="Contoh: 10, 7, 12, atau SD 1"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
              />
            </div>

            {activeSchool.subjects.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Mata Pelajaran</Label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {activeSchool.subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeSchool.academicPeriods.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Periode Akademik</Label>
                <select
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {activeSchool.academicPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.year} — {p.semester}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsClassModalOpen(false)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button type="submit" loading={isPending}>
                Simpan Kelas
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

