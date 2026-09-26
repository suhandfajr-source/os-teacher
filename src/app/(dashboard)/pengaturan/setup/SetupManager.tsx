"use client";
import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClassAction } from "@/modules/classes/classes.actions";
import { requestRevokeTeacherMembership, cancelRevokeTeacherMembershipRequest } from "@/modules/schools/schools.actions";
import { switchActiveSchool } from "@/modules/teachers/teachers.actions";
import { toast } from "sonner";
import { Plus, GraduationCap, Users, School as SchoolIcon, ShieldAlert, ArrowLeftRight, Clock, AlertTriangle } from "lucide-react";
import { ScheduleConfigDialog } from "@/components/schedule/ScheduleConfigDialog";
import { Textarea } from "@/components/ui/textarea";
import type {
  TeacherProfile,
  AcademicPeriod,
  Subject,
  Class as PrismaClass,
  TeachingContext,
  School,
  TeacherSchoolMembership,
} from "@prisma/client";

export type SchoolTeacherItem = {
  id: string;
  teacherProfileId: string;
  workspaceRole: "OWNER" | "MEMBER";
  status: "ACTIVE" | "REVOKED";
  createdAt: Date | string;
  teacherProfile: {
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  };
  pendingRevocationRequest?: {
    id: string;
    reason: string;
    requesterName: string | null;
    requesterEmail: string;
    requesterProfileId: string;
    createdAt: Date | string;
  } | null;
};

type ProfileWithContext = TeacherProfile & {
  teachingContexts: (TeachingContext & { academicPeriod: AcademicPeriod; subject: Subject; class: PrismaClass })[];
  memberships?: (TeacherSchoolMembership & { school: School })[];
};

type SchoolWithMaster = School & {
  academicPeriods: AcademicPeriod[];
  subjects: Subject[];
  classes: PrismaClass[];
};

export default function SetupManager({
  initialProfile,
  activeSchool,
  schoolTeachers = [],
}: {
  initialProfile: ProfileWithContext;
  activeSchool: SchoolWithMaster;
  schoolTeachers?: SchoolTeacherItem[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("context");
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [targetToRevoke, setTargetToRevoke] = useState<SchoolTeacherItem | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [isPending, startTransition] = useTransition();

  // Form State Kelas
  const [className, setClassName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState(activeSchool.subjects[0]?.id || "");
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeSchool.academicPeriods.find((p) => p.status === "ACTIVE")?.id || activeSchool.academicPeriods[0]?.id || ""
  );

  // Cari membership pemanggil di sekolah aktif
  const callerMembership = schoolTeachers.find((t) => t.teacherProfileId === initialProfile.id);
  const isCallerOwner = callerMembership?.workspaceRole === "OWNER";

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

  const handleConfirmRevoke = () => {
    if (!targetToRevoke) return;
    if (revokeReason.trim().length < 5) {
      toast.error("Alasan permohonan pencabutan akses minimal 5 karakter.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await requestRevokeTeacherMembership({
          teacherSchoolMembershipId: targetToRevoke.id,
          reason: revokeReason.trim(),
        });
        toast.success(res.message);
        setTargetToRevoke(null);
        setRevokeReason("");
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal mengajukan pencabutan akses guru");
      }
    });
  };

  const handleCancelRevokeRequest = (requestId: string) => {
    startTransition(async () => {
      try {
        const res = await cancelRevokeTeacherMembershipRequest(requestId);
        toast.success(res.message);
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal membatalkan pengajuan");
      }
    });
  };

  const handleSwitchSchool = (newSchoolId: string) => {
    if (newSchoolId === activeSchool.id) return;
    startTransition(async () => {
      try {
        await switchActiveSchool(newSchoolId);
        toast.success("Sekolah aktif berhasil dialihkan.");
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal beralih sekolah");
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
          <Button
            variant={activeTab === "teachers" ? "default" : "ghost"}
            onClick={() => setActiveTab("teachers")}
            className="flex items-center gap-1.5"
          >
            <Users className="h-4 w-4" />
            Guru Sekolah ({schoolTeachers.length})
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
              {activeTab === "teachers" && `Daftar Guru di Sekolah Kita (${activeSchool.name})`}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === "context" && (
            <div className="space-y-4">
              {initialProfile.teachingContexts.map((ctx) => (
                <div
                  key={ctx.id}
                  className="p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card hover:border-primary/50 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-base">
                      {ctx.subject.name} — {ctx.class.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {ctx.academicPeriod.year} {ctx.academicPeriod.semester}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <ScheduleConfigDialog
                      teachingContextId={ctx.id}
                      contextTitle={`${ctx.subject.name} — ${ctx.class.name}`}
                    />
                  </div>
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

          {/* Tab Guru di Sekolah Kita (CAP-3) */}
          {activeTab === "teachers" && (
            <div className="space-y-6">
              {/* Header Info Sekolah & Saklar Sekolah Aktif */}
              <div className="p-4 bg-slate-50 border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <SchoolIcon className="h-5 w-5 text-teal-700" />
                    <span className="font-bold text-base text-slate-800">{activeSchool.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {activeSchool.city ? `${activeSchool.city} • ` : ""}
                    {activeSchool.npsn ? `NPSN: ${activeSchool.npsn}` : "NPSN: Belum diisi"}
                  </div>
                </div>

                {/* Saklar Sekolah Aktif jika memiliki lebih dari 1 sekolah */}
                {initialProfile.memberships && initialProfile.memberships.length > 1 && (
                  <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0">
                    <ArrowLeftRight className="h-4 w-4 text-slate-500" />
                    <span className="text-xs font-medium text-slate-600">Ganti Sekolah:</span>
                    <select
                      value={activeSchool.id}
                      onChange={(e) => handleSwitchSchool(e.target.value)}
                      disabled={isPending}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      {initialProfile.memberships.map((m) => (
                        <option key={m.schoolId} value={m.schoolId}>
                          {m.school.name} ({m.workspaceRole})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Daftar Guru */}
              <div className="space-y-3">
                {schoolTeachers.map((t) => {
                  const isSelf = t.teacherProfileId === initialProfile.id;
                  const isTargetOwner = t.workspaceRole === "OWNER";
                  // F2 CRITICAL: Member dilarang me-revoke Owner
                  const isForbiddenToRevoke = !isCallerOwner && isTargetOwner;
                  const isRevoked = t.status === "REVOKED";

                  return (
                    <div
                      key={t.id}
                      className="p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 text-sm">
                          {t.teacherProfile.user.name?.charAt(0).toUpperCase() || "G"}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                            {t.teacherProfile.user.name || "Guru"}
                            {isSelf && (
                              <span className="text-[11px] font-normal px-2 py-0.2 rounded-full bg-slate-100 text-slate-600">
                                Anda
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{t.teacherProfile.user.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        {/* Role Badge */}
                        <Badge
                          variant="outline"
                          className={
                            t.workspaceRole === "OWNER"
                              ? "bg-amber-50 text-amber-800 border-amber-300 font-semibold text-xs"
                              : "bg-slate-50 text-slate-700 border-slate-200 text-xs"
                          }
                        >
                          {t.workspaceRole === "OWNER" ? "Pengelola (Owner)" : "Anggota (Member)"}
                        </Badge>

                        {/* Status Badge */}
                        {t.pendingRevocationRequest ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-700 border-amber-300 text-xs flex items-center gap-1"
                            title={`Alasan: ${t.pendingRevocationRequest.reason} (Diajukan oleh ${t.pendingRevocationRequest.requesterName})`}
                          >
                            <Clock className="h-3 w-3 animate-pulse" />
                            Diajukan ke Superadmin
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={
                              t.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300 text-xs"
                                : "bg-rose-50 text-rose-700 border-rose-300 text-xs"
                            }
                          >
                            {t.status === "ACTIVE" ? "Aktif" : "Dinonaktifkan"}
                          </Badge>
                        )}

                        {/* Tombol Aksi */}
                        {!isSelf && !isRevoked && (
                          <>
                            {t.pendingRevocationRequest ? (
                              (isCallerOwner || t.pendingRevocationRequest.requesterProfileId === initialProfile.id) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isPending}
                                  onClick={() => handleCancelRevokeRequest(t.pendingRevocationRequest!.id)}
                                  className="text-xs text-slate-500 hover:text-slate-700 underline h-7 px-2"
                                  title="Batalkan permohonan pencabutan akses ini"
                                >
                                  Batalkan Pengajuan
                                </Button>
                              )
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isPending || isForbiddenToRevoke}
                                onClick={() => {
                                  setTargetToRevoke(t);
                                  setRevokeReason("");
                                }}
                                className="text-xs text-rose-700 border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                                title={
                                  isForbiddenToRevoke
                                    ? "Anggota (Member) tidak dapat mengajukan pencabutan Pengelola (Owner)"
                                    : "Ajukan permohonan pencabutan akses guru ini ke Superadmin"
                                }
                              >
                                Ajukan Cabut Akses
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
              <Button type="submit" disabled={isPending}>
                {isPending ? "Menyimpan..." : "Simpan Kelas"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Pengajuan Cabut Akses (Revoke Request) */}
      <Dialog open={!!targetToRevoke} onOpenChange={(open) => !open && setTargetToRevoke(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <ShieldAlert className="h-5 w-5" />
              Ajukan Pencabutan Akses Guru
            </DialogTitle>
            <DialogDescription>
              Permohonan ini akan dikirimkan ke <strong>Superadmin platform</strong> untuk diverifikasi dan disetujui.
            </DialogDescription>
          </DialogHeader>

          {targetToRevoke && (
            <div className="space-y-4 my-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-sm text-slate-900">
                <div className="font-semibold">{targetToRevoke.teacherProfile.user.name}</div>
                <div className="text-xs text-slate-500">{targetToRevoke.teacherProfile.user.email}</div>
                <div className="text-xs text-slate-500 pt-1">
                  Sekolah: <strong>{activeSchool.name}</strong> • Peran: <strong>{targetToRevoke.workspaceRole === "OWNER" ? "Pengelola" : "Anggota"}</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="revoke-reason" className="text-xs font-semibold text-slate-800">
                  Alasan Pencabutan Akses <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  id="revoke-reason"
                  placeholder="Contoh: Guru telah mutasi dinas / berhenti mengajar per semester ini."
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="text-xs min-h-[80px]"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Tuliskan alasan jelas agar Superadmin dapat memvalidasi pengajuan ini.
                </p>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  Guru target tetap memiliki akses pembelajaran sampai permohonan ini disetujui oleh Superadmin.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setTargetToRevoke(null)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRevoke}
              disabled={isPending || revokeReason.trim().length < 5}
            >
              {isPending ? "Mengirim..." : "Kirim Pengajuan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
