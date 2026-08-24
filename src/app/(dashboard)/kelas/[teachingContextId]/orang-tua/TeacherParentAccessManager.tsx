"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  createParentInvitationAction,
  revokeParentTeachingAccessAction,
  cancelParentInvitationAction,
} from "@/modules/parent/parent.actions";
import { TeacherParentAccessItem, TeacherParentInvitationItem } from "@/modules/parent/parent.types";
import { toast } from "sonner";
import { Copy, UserCheck, UserX, Send, Clock, CheckCircle2 } from "lucide-react";

interface StudentOption {
  id: string;
  fullName: string;
  nis?: string | null;
}

interface Props {
  teachingContextId: string;
  rosterStudents: StudentOption[];
  initialAccesses: TeacherParentAccessItem[];
  initialInvitations: TeacherParentInvitationItem[];
}

export function TeacherParentAccessManager({
  teachingContextId,
  rosterStudents,
  initialAccesses,
  initialInvitations,
}: Props) {
  const [accesses, setAccesses] = useState<TeacherParentAccessItem[]>(initialAccesses);
  const [invitations, setInvitations] = useState<TeacherParentInvitationItem[]>(initialInvitations);

  const [selectedStudentId, setSelectedStudentId] = useState(rosterStudents[0]?.id || "");
  const [parentEmail, setParentEmail] = useState("");
  const [relationshipLabel, setRelationshipLabel] = useState("Orang Tua");
  const [customRelationship, setCustomRelationship] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !parentEmail.trim()) {
      toast.error("Pilih siswa dan masukkan email orang tua");
      return;
    }

    const finalLabel = relationshipLabel === "Lainnya" ? customRelationship.trim() : relationshipLabel;

    setIsSubmitting(true);
    try {
      const res = await createParentInvitationAction({
        teachingContextId,
        studentId: selectedStudentId,
        recipientEmail: parentEmail.trim(),
        relationshipLabel: finalLabel || undefined,
      });

      if (res.success && res.rawToken) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const inviteUrl = `${origin}/parent/undangan/${res.rawToken}`;
        setCreatedInviteUrl(inviteUrl);
        toast.success("Undangan orang tua berhasil dibuat");
        setParentEmail("");
        setCustomRelationship("");

        // Refresh invitations list locally
        setInvitations((prev) => [
          {
            id: res.invitation.id,
            studentId: res.invitation.studentId,
            studentName: res.invitation.student.fullName,
            recipientEmail: res.invitation.recipientEmail,
            relationshipLabel: res.invitation.relationshipLabel,
            status: res.invitation.status,
            expiresAt: new Date(res.invitation.expiresAt),
            createdAt: new Date(res.invitation.createdAt),
          },
          ...prev.filter(
            (inv) =>
              !(
                inv.studentId === res.invitation.studentId &&
                inv.recipientEmail.toLowerCase() === res.invitation.recipientEmail.toLowerCase() &&
                inv.status === "PENDING"
              )
          ),
        ]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal membuat undangan";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (createdInviteUrl) {
      navigator.clipboard.writeText(createdInviteUrl);
      toast.success("Tautan undangan disalin ke clipboard");
    }
  };

  const handleRevokeAccess = async (accessId: string, studentName: string) => {
    if (!confirm(`Cabut akses pembelajaran untuk orang tua dari ${studentName}?`)) return;

    try {
      await revokeParentTeachingAccessAction(teachingContextId, accessId);
      toast.success("Akses orang tua berhasil dicabut");
      setAccesses((prev) =>
        prev.map((a) => (a.id === accessId ? { ...a, status: "REVOKED", revokedAt: new Date() } : a))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal mencabut akses";
      toast.error(message);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm("Batalkan undangan ini?")) return;

    try {
      await cancelParentInvitationAction(teachingContextId, invitationId);
      toast.success("Undangan berhasil dibatalkan");
      setInvitations((prev) =>
        prev.map((inv) => (inv.id === invitationId ? { ...inv, status: "REVOKED" } : inv))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal membatalkan undangan";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Create Invitation Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Undang Orang Tua / Wali Siswa
          </CardTitle>
          <CardDescription>
            Kirimkan tautan akses pembelajaran mandiri untuk orang tua siswa pada kelas ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateInvite} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Pilih Siswa (Roster Aktif)</label>
                <select
                  aria-label="Pilih Siswa"
                  className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  required
                >
                  {rosterStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} {s.nis ? `(${s.nis})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email Orang Tua / Wali</label>
                <Input
                  type="email"
                  placeholder="orangtua@email.com"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Hubungan</label>
                <select
                  aria-label="Hubungan"
                  className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                  value={relationshipLabel}
                  onChange={(e) => setRelationshipLabel(e.target.value)}
                >
                  <option value="Orang Tua">Orang Tua</option>
                  <option value="Ayah">Ayah</option>
                  <option value="Ibu">Ibu</option>
                  <option value="Wali">Wali</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
            </div>

            {relationshipLabel === "Lainnya" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Sebutkan Hubungan</label>
                <Input
                  placeholder="Contoh: Paman / Tante / Kakak"
                  value={customRelationship}
                  onChange={(e) => setCustomRelationship(e.target.value)}
                  required
                />
              </div>
            )}

            <Button type="submit" disabled={isSubmitting || rosterStudents.length === 0} className="w-full md:w-auto">
              {isSubmitting ? "Membuat Undangan..." : "Buat Undangan"}
            </Button>
          </form>

          {/* Generated Link Alert */}
          {createdInviteUrl && (
            <div className="mt-6 p-4 rounded-lg border bg-muted/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Tautan Undangan Berhasil Dibuat
                </span>
                <Button size="sm" variant="outline" onClick={handleCopyLink} className="flex items-center gap-1.5">
                  <Copy className="h-4 w-4" />
                  Salin Tautan
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Bagikan tautan ini kepada orang tua siswa. Tautan hanya dapat digunakan satu kali dan berlaku selama 7 hari.
              </p>
              <div className="p-2 bg-background rounded border text-xs font-mono break-all select-all">
                {createdInviteUrl}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Access List Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-green-600" />
            Akses Orang Tua Aktif
          </CardTitle>
          <CardDescription>
            Daftar akun orang tua yang telah terhubung dan memiliki hak akses melihat pembelajaran pada kelas ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accesses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Belum ada orang tua yang terhubung dengan kelas ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted text-muted-foreground border-b">
                  <tr>
                    <th className="py-3 px-4">Nama Siswa</th>
                    <th className="py-3 px-4">Orang Tua / Wali</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Hubungan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {accesses.map((acc) => (
                    <tr key={acc.id} className="hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{acc.studentName}</td>
                      <td className="py-3 px-4">{acc.parentName}</td>
                      <td className="py-3 px-4 font-mono text-xs">{acc.parentEmail}</td>
                      <td className="py-3 px-4">{acc.relationshipLabel || "-"}</td>
                      <td className="py-3 px-4">
                        {acc.status === "ACTIVE" ? (
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                            Aktif
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Dicabut</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {acc.status === "ACTIVE" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRevokeAccess(acc.id, acc.studentName)}
                            className="flex items-center gap-1"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            Cabut Akses
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invitations History Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            Riwayat Undangan
          </CardTitle>
          <CardDescription>Daftar undangan yang telah dibuat untuk kelas ini.</CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Belum ada undangan yang dibuat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted text-muted-foreground border-b">
                  <tr>
                    <th className="py-3 px-4">Nama Siswa</th>
                    <th className="py-3 px-4">Email Penerima</th>
                    <th className="py-3 px-4">Hubungan</th>
                    <th className="py-3 px-4">Dibuat</th>
                    <th className="py-3 px-4">Kedaluwarsa</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{inv.studentName}</td>
                      <td className="py-3 px-4 font-mono text-xs">{inv.recipientEmail}</td>
                      <td className="py-3 px-4">{inv.relationshipLabel || "-"}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleDateString("id-ID")}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {new Date(inv.expiresAt).toLocaleDateString("id-ID")}
                      </td>
                      <td className="py-3 px-4">
                        {inv.status === "PENDING" && (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            Menunggu
                          </Badge>
                        )}
                        {inv.status === "ACCEPTED" && (
                          <Badge variant="default" className="bg-green-600">
                            Diterima
                          </Badge>
                        )}
                        {inv.status === "REVOKED" && <Badge variant="secondary">Dibatalkan</Badge>}
                        {(inv.status as string) === "EXPIRED" && <Badge variant="destructive">Kedaluwarsa</Badge>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {inv.status === "PENDING" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelInvitation(inv.id)}
                            className="text-xs text-destructive hover:bg-destructive/10"
                          >
                            Batalkan
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
