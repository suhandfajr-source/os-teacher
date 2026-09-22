"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  approveStudentAction,
  rejectStudentAction,
  batchApproveStudentsAction,
  moveStudentClassAction,
  resetStudentPinAction,
  type PendingStudentView,
} from "@/modules/approvals/approvals.actions";
import {
  Hourglass,
  Check,
  X,
  Users,
  ArrowRightLeft,
  KeyRound,
  ListChecks,
} from "lucide-react";

interface ClassOption {
  id: string;
  name: string;
}

interface Props {
  initialPending: PendingStudentView[];
  escalatedThresholdHours: number;
  classes: ClassOption[];
}

const BATCH_APPROVE_MAX = 100; // G-8 — mirror validasi server-side

export function PersetujuanClient({ initialPending, escalatedThresholdHours, classes }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingStudentView[]>(initialPending);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [isTransition, startTransition] = useTransition();

  const [moveTarget, setMoveTarget] = useState<PendingStudentView | null>(null);
  const [moveClassId, setMoveClassId] = useState<string>("");
  const [pinTarget, setPinTarget] = useState<PendingStudentView | null>(null);
  const [newPin, setNewPin] = useState<string>("");

  const toggleCheck = (studentId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleApproveOne = (studentId: string) => {
    startTransition(async () => {
      const res = await approveStudentAction(studentId);
      if (res.success) {
        toast.success("Siswa disetujui.");
        setPending((prev) => prev.filter((p) => p.studentId !== studentId));
        setChecked((prev) => {
          const n = new Set(prev);
          n.delete(studentId);
          return n;
        });
        router.refresh();
      } else {
        toast.error(res.message || "Aksi gagal.");
      }
    });
  };

  const handleRejectOne = (studentId: string) => {
    const reason = window.prompt("Alasan penolakan (tercatat di jejak audit):");
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error("Alasan penolakan wajib diisi.");
      return;
    }
    startTransition(async () => {
      const res = await rejectStudentAction(studentId, reason);
      if (res.success) {
        toast.success("Siswa ditolak.");
        setPending((prev) => prev.filter((p) => p.studentId !== studentId));
        router.refresh();
      } else {
        toast.error(res.message || "Aksi gagal.");
      }
    });
  };

  const handleBatch = () => {
    const ids = [...checked];
    if (ids.length === 0) return;
    if (ids.length > BATCH_APPROVE_MAX) {
      toast.error(`Batch maksimal ${BATCH_APPROVE_MAX} siswa per aksi — pecah menjadi beberapa aksi.`);
      return;
    }
    startTransition(async () => {
      const res = await batchApproveStudentsAction(ids);
      if (res.success || res.approvedCount > 0) {
        toast.success(
          `${res.approvedCount} siswa disetujui${res.failed.length > 0 ? `, ${res.failed.length} gagal (dilaporkan)` : ""}.`
        );
        const failedIds = new Set(res.failed.map((f) => f.studentId));
        setPending((prev) => prev.filter((p) => !ids.includes(p.studentId) || failedIds.has(p.studentId)));
        setChecked(new Set());
        router.refresh();
      } else {
        toast.error(res.message || "Batch gagal.");
      }
    });
  };

  const handleMove = () => {
    if (!moveTarget || !moveClassId) return;
    startTransition(async () => {
      const res = await moveStudentClassAction(moveTarget.studentId, moveClassId);
      if (res.success) {
        toast.success("Siswa dipindah rombel.");
        router.refresh();
        setPending((prev) =>
          prev.map((p) =>
            p.studentId === moveTarget.studentId
              ? { ...p, classId: moveClassId, className: classes.find((c) => c.id === moveClassId)?.name ?? p.className }
              : p
          )
        );
        setMoveTarget(null);
      } else {
        toast.error(res.message || "Pindah rombel gagal.");
      }
    });
  };

  const handleResetPin = () => {
    if (!pinTarget) return;
    if (!/^\d{4}$/.test(newPin)) {
      toast.error("PIN baru harus 4 digit angka.");
      return;
    }
    startTransition(async () => {
      const res = await resetStudentPinAction(pinTarget.studentId, newPin);
      if (res.success) {
        toast.success("PIN direset. Sampaikan PIN baru secara langsung kepada siswa.");
        setPinTarget(null);
        setNewPin("");
      } else {
        toast.error(res.message || "Reset PIN gagal.");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Persetujuan Siswa</h1>
        <p className="text-muted-foreground mt-1">
          Panel sekolah — seluruh akun siswa PENDING lintas rombel &amp; periode. Merah = pending &gt;{" "}
          {escalatedThresholdHours} jam (eskalasi).
        </p>
      </div>

      {/* Batch bar (G-8: cap 100 server-side) */}
      <div className="flex items-center justify-between gap-3 sticky top-0 z-10 bg-background/95 backdrop-blur py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListChecks className="h-4 w-4" />
          {checked.size} dipilih
        </div>
        <Button size="sm" disabled={checked.size === 0 || isTransition} onClick={handleBatch}>
          <Check className="h-4 w-4 mr-1" /> Setujui ({checked.size})
        </Button>
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Tidak ada akun siswa pending di sekolah ini. 🎉
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {pending.map((p) => (
            <div
              key={p.studentId}
              className={`flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border p-4 ${
                p.escalated ? "border-red-300 bg-red-50/60" : "bg-card"
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={checked.has(p.studentId)}
                  onChange={() => toggleCheck(p.studentId)}
                  aria-label={`Pilih ${p.fullName}`}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{p.fullName}</span>
                    {p.nis && <Badge variant="outline">NIS {p.nis}</Badge>}
                    <Badge variant="secondary">
                      <Users className="h-3 w-3 mr-1" />
                      {p.className}
                    </Badge>
                    <Badge variant="outline">{p.academicPeriodLabel}</Badge>
                    {p.escalated && (
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                        <Hourglass className="h-3 w-3 mr-1" />
                        Eskalasi &gt;{escalatedThresholdHours} jam
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Button size="sm" disabled={isTransition} onClick={() => handleApproveOne(p.studentId)}>
                  <Check className="h-4 w-4 mr-1" /> Setujui
                </Button>
                <Button size="sm" variant="outline" disabled={isTransition} onClick={() => handleRejectOne(p.studentId)}>
                  <X className="h-4 w-4 mr-1" /> Tolak
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isTransition}
                  onClick={() => {
                    setMoveTarget(p);
                    setMoveClassId("");
                  }}
                >
                  <ArrowRightLeft className="h-4 w-4 mr-1" /> Pindah
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isTransition}
                  onClick={() => {
                    setPinTarget(p);
                    setNewPin("");
                  }}
                >
                  <KeyRound className="h-4 w-4 mr-1" /> Reset PIN
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog pindah rombel (N5/F12) */}
      <Dialog open={!!moveTarget} onOpenChange={(o) => !o && setMoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pindah Rombel — {moveTarget?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Rombel saat ini: <strong>{moveTarget?.className}</strong>. Pilih rombel tujuan (periode aktif).
            </p>
            <select
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              value={moveClassId}
              onChange={(e) => setMoveClassId(e.target.value)}
            >
              <option value="">— Pilih rombel tujuan —</option>
              {classes
                .filter((c) => c.id !== moveTarget?.classId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)}>
              Batal
            </Button>
            <Button disabled={!moveClassId || isTransition} onClick={handleMove}>
              Pindahkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog reset PIN (B2/OQ-4/F8) */}
      <Dialog open={!!pinTarget} onOpenChange={(o) => !o && setPinTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset PIN — {pinTarget?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Ketik PIN baru 4 digit. PIN dikirim sekali dan wajib berbeda dari PIN lama. Sampaikan secara
              langsung kepada siswa — sesi perangkat lain akan otomatis hangus.
            </p>
            <Input
              inputMode="numeric"
              maxLength={4}
              placeholder="PIN baru (4 digit)"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinTarget(null)}>
              Batal
            </Button>
            <Button disabled={newPin.length !== 4 || isTransition} onClick={handleResetPin}>
              Reset PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
