"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { acceptParentInvitationAction } from "@/modules/parent/parent.actions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { HeartHandshake, CheckCircle2, AlertTriangle, ShieldCheck, UserCheck, ArrowRight } from "lucide-react";
import { AuthenticatedInvitationDetail, PublicInvitationInfo } from "@/modules/parent/parent.types";

interface Props {
  token: string;
  isAuthenticated: boolean;
  publicInfo?: PublicInvitationInfo;
  authenticatedDetail?: AuthenticatedInvitationDetail | null;
  emailMismatch?: boolean;
  currentEmail?: string;
  errorMessage?: string | null;
}

export function InvitationAcceptClient({
  token,
  isAuthenticated,
  publicInfo,
  authenticatedDetail,
  emailMismatch,
  currentEmail,
  errorMessage,
}: Props) {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);

  // 1. Error / Invalid State
  if (errorMessage || (publicInfo && !publicInfo.valid)) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <Card className="border-destructive/30 shadow-md">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-2 h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-800">Undangan Tidak Berlaku</CardTitle>
            <CardDescription>{errorMessage || publicInfo?.message || "Tautan undangan tidak valid atau telah kedaluwarsa."}</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center pt-2">
            <Link href="/parent">
              <Button variant="outline">Kembali ke Portal Orang Tua</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // 2. Unauthenticated State (Public Privacy Protection)
  if (!isAuthenticated) {
    const callbackUrl = `/parent/undangan/${token}`;
    return (
      <div className="max-w-lg mx-auto py-12">
        <Card className="shadow-lg border-emerald-200">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <HeartHandshake className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">Undangan Akses Pembelajaran</CardTitle>
            <CardDescription className="text-sm">
              Anda menerima undangan dari guru untuk mengakses data kehadiran dan hasil belajar siswa secara mandiri.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-center space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Email Penerima Undangan
              </span>
              <p className="text-base font-mono font-bold text-slate-800">{publicInfo?.maskedEmail}</p>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Untuk menjaga privasi siswa, silakan masuk atau daftar dengan email yang sesuai untuk melihat rincian dan menerima undangan.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2.5 pt-2">
            <Link href={`/parent/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="w-full">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2">
                Masuk ke Akun Orang Tua
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={`/parent/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="w-full">
              <Button variant="outline" className="w-full border-slate-300">
                Daftar Akun Baru
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // 3. Authenticated Email Mismatch State
  if (emailMismatch) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <Card className="border-amber-300 shadow-md">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-2 h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-800">Email Akun Tidak Sesuai</CardTitle>
            <CardDescription>
              Undangan ini ditujukan untuk email yang berbeda dengan akun yang sedang aktif.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert variant="destructive">
              <AlertTitle>Peringatan Otorisasi</AlertTitle>
              <AlertDescription>
                Akun yang sedang masuk: <strong className="font-mono">{currentEmail}</strong>.
                <br />
                Silakan keluar dan masuk menggunakan email yang didaftarkan oleh guru pada undangan ini.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center pt-2">
            <Link href="/parent">
              <Button variant="outline">Kembali ke Beranda</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // 4. Authenticated Valid Acceptance State
  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const res = await acceptParentInvitationAction(token);
      if (res.success) {
        toast.success("Undangan berhasil diterima! Selamat datang di Portal Orang Tua.");
        router.push(`/parent/anak/${res.studentId}/konteks/${res.teachingContextId}`);
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal menerima undangan";
      toast.error(message);
      setIsAccepting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8">
      <Card className="shadow-lg border-emerald-200">
        <CardHeader className="text-center pb-4 border-b bg-emerald-50/50">
          <div className="mx-auto mb-2 h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">Konfirmasi Penerimaan Akses</CardTitle>
          <CardDescription>
            Tinjau data pembelajaran siswa sebelum menghubungkan akun orang tua
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="rounded-xl border bg-slate-50/80 p-4 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-xs text-muted-foreground">Nama Siswa</span>
              <span className="font-bold text-slate-900 text-sm">{authenticatedDetail?.studentName}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-xs text-muted-foreground">Kelas</span>
              <span className="font-semibold text-slate-800 text-sm">{authenticatedDetail?.className}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-xs text-muted-foreground">Mata Pelajaran</span>
              <span className="font-semibold text-slate-800 text-sm">{authenticatedDetail?.subjectName}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-xs text-muted-foreground">Tahun / Semester</span>
              <span className="text-slate-700 text-sm">
                {authenticatedDetail?.academicYear} (Semester {authenticatedDetail?.academicSemester})
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Guru Pengajar</span>
              <span className="font-semibold text-emerald-700 text-sm">{authenticatedDetail?.teacherName}</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50 text-xs text-emerald-800 border border-emerald-200 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <span>
              Dengan menerima undangan ini, Anda akan dapat melihat riwayat kehadiran, topik pembelajaran yang telah selesai, dan nilai penilaian resmi untuk mata pelajaran ini.
            </span>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3 pt-2 border-t">
          <Button
            onClick={handleAccept}
            disabled={isAccepting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2"
          >
            <UserCheck className="h-4 w-4" />
            {isAccepting ? "Menghubungkan Akun..." : "Terima Undangan & Buka Portal"}
          </Button>
          <Link href="/parent" className="w-full sm:w-auto">
            <Button variant="ghost" className="w-full">
              Batal
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
