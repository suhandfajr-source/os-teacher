"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  approveStudentAction,
  rejectStudentAction,
} from "@/modules/approvals/approvals.actions";
import { ESCALATION_L1_HOURS } from "@/modules/approvals/approvals.constants";
import {
  Users,
  Search,
  GraduationCap,
  ChevronRight,
  UserCircle,
  Hourglass,
  Check,
  X,
} from "lucide-react";

interface StudentItem {
  id: string;
  fullName: string;
  nis: string | null;
}

interface ClassGroup {
  id: string;
  name: string;
  gradeLevel: string | null;
  students: StudentItem[];
}

/** Story 5 — Panel L1: siswa PENDING rombel yang diampu (periode aktif). */
interface PendingStudentItem {
  studentId: string;
  fullName: string;
  nis: string | null;
  className: string;
  escalated: boolean;
  accountRequestedAt: string | null;
}

interface Props {
  classGroups: ClassGroup[];
  totalStudents: number;
  pendingStudents?: PendingStudentItem[];
}

export function SiswaListClient({ classGroups, totalStudents, pendingStudents = [] }: Props) {
  const router = useRouter();
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [pending, setPending] = useState<PendingStudentItem[]>(pendingStudents);
  const [isPendingTransition, startTransition] = useTransition();

  const q = searchQuery.toLowerCase().trim();

  const handleApprove = (studentId: string) => {
    startTransition(async () => {
      const res = await approveStudentAction(studentId);
      if (res.success) {
        toast.success("Siswa disetujui. Akun aktif seketika.");
        setPending((prev) => prev.filter((p) => p.studentId !== studentId));
        router.refresh(); // BH-11: roster & panel server-side ikut sinkron
      } else {
        toast.error(res.message || "Aksi gagal.");
      }
    });
  };

  const handleReject = (studentId: string) => {
    const reason = window.prompt("Alasan penolakan (tercatat di jejak audit):");
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error("Alasan penolakan wajib diisi.");
      return;
    }
    startTransition(async () => {
      const res = await rejectStudentAction(studentId, reason);
      if (res.success) {
        toast.success("Siswa ditolak. Siswa dapat mendaftar ulang.");
        setPending((prev) => prev.filter((p) => p.studentId !== studentId));
        router.refresh();
      } else {
        toast.error(res.message || "Aksi gagal.");
      }
    });
  };

  // Filter classes & students
  const filteredGroups = classGroups
    .filter((cg) => selectedClassId === "ALL" || cg.id === selectedClassId)
    .map((cg) => ({
      ...cg,
      students: cg.students.filter(
        (s) =>
          !q ||
          s.fullName.toLowerCase().includes(q) ||
          (s.nis && s.nis.toLowerCase().includes(q))
      ),
    }))
    .filter((cg) => cg.students.length > 0 || !q);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Daftar Siswa</h1>
        <p className="text-muted-foreground mt-1">
          Daftar seluruh siswa terkelompok rapi berdasarkan kelas yang Anda ampu.
        </p>
      </div>

      {/* Story 5 — Panel L1: Menunggu Persetujuan (per-rombel pengampu) */}
      {pending.length > 0 && (
        <Card className="border-amber-300/60 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Hourglass className="h-4 w-4 text-amber-600" />
              Menunggu Persetujuan ({pending.length})
              <span className="text-xs font-normal text-muted-foreground">
                akun siswa PENDING rombel Anda · merah = &gt;{ESCALATION_L1_HOURS} jam (eskalasi)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map((p) => (
              <div
                key={p.studentId}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3 ${
                  p.escalated ? "border-red-300 bg-red-50/60" : "bg-white"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{p.fullName}</span>
                    {p.nis && <Badge variant="outline">NIS {p.nis}</Badge>}
                    <Badge variant="secondary">{p.className}</Badge>
                    {p.escalated && (
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                        Eskalasi &gt;{ESCALATION_L1_HOURS} jam
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    disabled={isPendingTransition}
                    onClick={() => handleApprove(p.studentId)}
                  >
                    <Check className="h-4 w-4 mr-1" /> Setujui
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPendingTransition}
                    onClick={() => handleReject(p.studentId)}
                  >
                    <X className="h-4 w-4 mr-1" /> Tolak
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        {/* Class Filter Tabs / Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <Button
            size="sm"
            variant={selectedClassId === "ALL" ? "default" : "outline"}
            onClick={() => setSelectedClassId("ALL")}
            className="rounded-full text-xs font-semibold shrink-0"
          >
            Semua Kelas ({totalStudents})
          </Button>
          {classGroups.map((cg) => (
            <Button
              key={cg.id}
              size="sm"
              variant={selectedClassId === cg.id ? "default" : "outline"}
              onClick={() => setSelectedClassId(cg.id)}
              className="rounded-full text-xs font-semibold shrink-0"
            >
              {cg.name} ({cg.students.length})
            </Button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau NIS siswa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm bg-card"
          />
        </div>
      </div>

      {/* Class Group Sections */}
      <div className="space-y-8">
        {filteredGroups.map((cg) => (
          <section key={cg.id} className="space-y-3">
            {/* Class Section Header */}
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">{cg.name}</h2>
                {cg.gradeLevel && (
                  <Badge variant="secondary" className="text-xs">
                    Tingkat {cg.gradeLevel}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-1">
                  ({cg.students.length} Siswa)
                </span>
              </div>
            </div>

            {/* Students Grid */}
            {cg.students.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {cg.students.map((s) => (
                  <Link href={`/siswa/${s.id}`} key={s.id} className="group">
                    <Card className="hover:border-primary transition-all duration-150 hover:shadow-xs cursor-pointer h-full">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors flex items-center gap-2">
                            <UserCircle className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                            <span className="truncate">{s.fullName}</span>
                          </CardTitle>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>NIS: {s.nis || "—"}</span>
                          <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-medium">
                            {cg.name}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-2">
                Tidak ada siswa di kelas ini yang cocok dengan pencarian.
              </p>
            )}
          </section>
        ))}

        {/* Global Empty State */}
        {filteredGroups.length === 0 && (
          <div className="py-12 px-6 text-center border-2 border-dashed rounded-xl bg-card space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-lg">
              {searchQuery ? "Siswa Tidak Ditemukan" : "Belum Ada Siswa"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {searchQuery
                ? `Tidak ada siswa yang sesuai dengan kata kunci "${searchQuery}".`
                : "Belum ada data siswa di kelas yang Anda ampu."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
