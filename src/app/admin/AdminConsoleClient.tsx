"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  lookupSchoolsForAdminAction,
  lookupUserForAdminAction,
  banTeacherAction,
  unbanTeacherAction,
  resetTeacherPasswordAction,
  deactivateSchoolAction,
  reactivateSchoolAction,
  setSchoolNpsnAction,
  forceResetStudentPinAction,
} from "@/modules/admin/admin.actions";

interface SchoolRow {
  id: string;
  name: string;
  npsn: string | null;
  deactivatedAt: string | Date | null;
  _count: { students: number; memberships: number; classes: number };
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  platformRole: string;
  role: string;
  banned: boolean;
  banReason: string | null;
  teacherProfile: {
    id: string;
    activeSchoolId: string | null;
    memberships: Array<{ school: { id: string; name: string; deactivatedAt: string | Date | null } }>;
  } | null;
}

export function AdminConsoleClient({ schools: initialSchools }: { schools: SchoolRow[] }) {
  const [schools, setSchools] = useState<SchoolRow[]>(initialSchools);
  const [schoolQuery, setSchoolQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [user, setUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [npsnInput, setNpsnInput] = useState<Record<string, string>>({});
  const [isTransition, startTransition] = useTransition();

  const searchSchools = () => {
    startTransition(async () => {
      const res = await lookupSchoolsForAdminAction(schoolQuery);
      if (res.success) setSchools(res.schools as SchoolRow[]);
    });
  };

  const searchUser = () => {
    startTransition(async () => {
      const res = await lookupUserForAdminAction(userQuery);
      if (res.success) setUser(res.user as UserRow);
      else {
        setUser(null);
        toast.error(res.message || "User tidak ditemukan.");
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* --- Manajemen Sekolah (B5/F7/G-6) --- */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-base">Sekolah — Nonaktifkan / Reaktivasi / NPSN</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Cari sekolah (nama / NPSN)..."
              value={schoolQuery}
              onChange={(e) => setSchoolQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchSchools()}
              className="bg-slate-800 border-slate-700"
            />
            <Button variant="secondary" disabled={isTransition} onClick={searchSchools}>
              Cari
            </Button>
          </div>

          <div className="space-y-3">
            {schools.map((s) => {
              const deactivated = !!s.deactivatedAt;
              return (
                <div key={s.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-slate-400">
                        NPSN: {s.npsn ?? "—"} · {s._count.students} siswa · {s._count.memberships} guru ·{" "}
                        {s._count.classes} rombel
                      </div>
                    </div>
                    {deactivated ? (
                      <Badge className="bg-red-950 text-red-300 hover:bg-red-950">NONAKTIF</Badge>
                    ) : (
                      <Badge className="bg-emerald-950 text-emerald-300 hover:bg-emerald-950">AKTIF</Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!deactivated ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isTransition}
                        onClick={() => {
                          if (!window.confirm(`Nonaktifkan sekolah "${s.name}"? Semua sesi guru & parent di-revoke dan NPSN di-clear.`)) return;
                          startTransition(async () => {
                            const res = await deactivateSchoolAction(s.id);
                            if (res.success) {
                              toast.success("Sekolah dinonaktifkan. NPSN di-clear, sesi di-revoke.");
                              setSchools((prev) =>
                                prev.map((x) => (x.id === s.id ? { ...x, deactivatedAt: new Date().toISOString(), npsn: null } : x))
                              );
                            } else toast.error(res.message || "Aksi gagal.");
                          });
                        }}
                      >
                        Nonaktifkan
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isTransition}
                        onClick={() =>
                          startTransition(async () => {
                            const res = await reactivateSchoolAction(s.id);
                            if (res.success) {
                              toast.success("Sekolah direaktivasi TANPA NPSN (G-6).");
                              setSchools((prev) =>
                                prev.map((x) => (x.id === s.id ? { ...x, deactivatedAt: null } : x))
                              );
                            } else toast.error(res.message || "Aksi gagal.");
                          })
                        }
                      >
                        Reaktivasi (tanpa NPSN)
                      </Button>
                    )}

                    <div className="flex items-center gap-1">
                      <Input
                        placeholder="NPSN baru (8 digit)"
                        inputMode="numeric"
                        maxLength={8}
                        value={npsnInput[s.id] ?? ""}
                        onChange={(e) =>
                          setNpsnInput((prev) => ({
                            ...prev,
                            [s.id]: e.target.value.replace(/\D/g, "").slice(0, 8),
                          }))
                        }
                        className="w-44 bg-slate-800 border-slate-700"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isTransition || deactivated || (npsnInput[s.id] ?? "").length !== 8}
                        onClick={() =>
                          startTransition(async () => {
                            const res = await setSchoolNpsnAction(s.id, npsnInput[s.id]);
                            if (res.success) {
                              toast.success("NPSN diperbarui.");
                              setSchools((prev) =>
                                prev.map((x) => (x.id === s.id ? { ...x, npsn: npsnInput[s.id] } : x))
                              );
                            } else toast.error(res.message || "Gagal (NPSN mungkin sudah dipakai sekolah lain).");
                          })
                        }
                      >
                        Set NPSN
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {schools.length === 0 && (
              <p className="text-sm text-slate-500">Cari sekolah untuk mulai mengelola.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* --- Manajemen User (B5/F6/G-3) --- */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-base">User — Ban / Unban / Reset Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Email user..."
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchUser()}
              className="bg-slate-800 border-slate-700"
            />
            <Button variant="secondary" disabled={isTransition} onClick={searchUser}>
              Cari
            </Button>
          </div>

          {user && (
            <div className="rounded-lg border border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-semibold">
                    {user.name} <span className="text-slate-400 text-sm">({user.email})</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    platformRole: {user.platformRole} · role: {user.role}
                    {user.banned && user.banReason ? ` · alasan ban: ${user.banReason}` : ""}
                  </div>
                </div>
                {user.platformRole === "ADMIN" && (
                  <Badge className="bg-amber-950 text-amber-300 hover:bg-amber-950">
                    SUPERADMIN — ban/reset password dilarang (F6/G-3)
                  </Badge>
                )}
                {user.banned && (
                  <Badge className="bg-red-950 text-red-300 hover:bg-red-950">BANNED</Badge>
                )}
              </div>

              {user.platformRole !== "ADMIN" && (
                <div className="flex flex-wrap gap-2">
                  {!user.banned ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isTransition}
                      onClick={() => {
                        const reason = window.prompt("Alasan ban:");
                        if (reason === null) return;
                        startTransition(async () => {
                          const res = await banTeacherAction(user.id, reason);
                          if (res.success) {
                            toast.success("User di-ban. SEMUA sesinya sudah di-revoke (B5).");
                            setUser({ ...user, banned: true, banReason: reason });
                          } else toast.error(res.message || "Aksi gagal.");
                        });
                      }}
                    >
                      Ban
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isTransition}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await unbanTeacherAction(user.id);
                          if (res.success) {
                            toast.success("User di-unban.");
                            setUser({ ...user, banned: false, banReason: null });
                          } else toast.error(res.message || "Aksi gagal.");
                        })
                      }
                    >
                      Unban
                    </Button>
                  )}

                  <div className="flex items-center gap-1">
                    <Input
                      type="password"
                      placeholder="Password baru (min 8)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-56 bg-slate-800 border-slate-700"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isTransition || newPassword.length < 8}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await resetTeacherPasswordAction(user.id, newPassword);
                          if (res.success) {
                            toast.success("Password direset. SEMUA sesi lama hangus (B5).");
                            setNewPassword("");
                          } else toast.error(res.message || "Aksi gagal.");
                        })
                      }
                    >
                      Reset Password
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Force approve/reject siswa (L3) --- */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-base">Force Approve / Reject Siswa (L3, lintas-sekolah)</CardTitle>
        </CardHeader>
        <CardContent>
          <ForceDecisionBlock disabled={isTransition} />
        </CardContent>
      </Card>

      {/* --- Force reset PIN siswa (B2/G-1) --- */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-base">Force Reset PIN Siswa (L3)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ForceResetPinBlock disabled={isTransition} />
        </CardContent>
      </Card>
    </div>
  );
}

function ForceDecisionBlock({ disabled }: { disabled: boolean }) {
  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState("");
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Student ID (cuid)..."
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="bg-slate-800 border-slate-700 w-72"
        />
        <Input
          placeholder="Alasan (untuk reject)..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="bg-slate-800 border-slate-700 w-56"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={disabled || studentId.length < 10}
          onClick={() =>
            startTransition(async () => {
              const { forceApproveStudentAction } = await import("@/modules/admin/admin.actions");
              const res = await forceApproveStudentAction(studentId);
              if (res.success) toast.success("Siswa di-force approve (ter-audit L3).");
              else toast.error(res.message || "Aksi gagal.");
            })
          }
        >
          Force Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || studentId.length < 10 || !reason.trim()}
          onClick={() =>
            startTransition(async () => {
              const { forceRejectStudentAction } = await import("@/modules/admin/admin.actions");
              const res = await forceRejectStudentAction(studentId, reason);
              if (res.success) toast.success("Siswa di-force reject (ter-audit L3).");
              else toast.error(res.message || "Aksi gagal.");
            })
          }
        >
          Force Reject
        </Button>
      </div>
    </div>
  );
}

function ForceResetPinBlock({ disabled }: { disabled: boolean }) {
  const [studentId, setStudentId] = useState("");
  const [pin, setPin] = useState("");
  const [, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Input
        placeholder="Student ID (cuid)..."
        value={studentId}
        onChange={(e) => setStudentId(e.target.value)}
        className="bg-slate-800 border-slate-700 w-72"
      />
      <Input
        inputMode="numeric"
        maxLength={4}
        placeholder="PIN baru"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="bg-slate-800 border-slate-700 w-32"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || studentId.length < 10 || pin.length !== 4}
        onClick={() =>
          startTransition(async () => {
            const res = await forceResetStudentPinAction(studentId, pin);
            if (res.success) toast.success("PIN siswa direset (ter-audit).");
            else toast.error(res.message || "Aksi gagal.");
          })
        }
      >
        Reset PIN Siswa
      </Button>
    </div>
  );
}
