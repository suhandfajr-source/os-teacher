"use client";

import React, { useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff, User, Mail, Lock, ArrowRight, School } from "lucide-react";
import { validateSafeInternalPath } from "@/modules/parent/parent.utils";
import { KlassaLogo, ModularCockpitArtwork } from "@/components/brand";

interface PageProps {
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
}

export default function ParentRegisterPage({ searchParams }: PageProps) {
  const router = useRouter();
  const params = use(searchParams);
  const callbackUrl = validateSafeInternalPath(params.callbackUrl, "/parent");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok");
      return;
    }

    setLoading(true);
    setError("");

    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setError(error.message || "Pendaftaran akun orang tua gagal");
      setLoading(false);
    } else {
      toast.success("Pendaftaran berhasil! Selamat datang di Portal Orang Tua.");
      router.push(callbackUrl);
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen w-full bg-white text-slate-900 flex flex-col lg:flex-row relative overflow-x-hidden font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* ─────────────────────────────────────────────────────────────
          SISI KIRI: FORM & BRANDING (50% VIEWPORT EDGE-TO-EDGE)
      ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 p-6 sm:p-8 lg:p-12 pb-10 sm:pb-12 lg:pb-12 pl-8 sm:pl-12 lg:pl-16 flex flex-col justify-between z-10 bg-white min-h-screen">
        
        {/* Top Brand Logo & Badge */}
        <div className="flex items-center gap-2">
          <Link href="/" className="inline-flex items-center hover:opacity-90 transition-opacity">
            <KlassaLogo variant="horizontal" size="xs" priority />
          </Link>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
            Portal Keluarga
          </span>
        </div>

        {/* Form Content Area */}
        <div className="my-auto py-4 max-w-[360px] w-full space-y-3.5">
          
          {/* Header Text */}
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[9px] font-extrabold tracking-wider uppercase border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              <span>PENDAFTARAN AKUN ORANG TUA</span>
            </div>

            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Daftar Akun Orang Tua <br />
              <span className="shimmer-text-emerald">Dampingi Prestasi Anak.</span>
            </h1>

            <p className="text-[11px] text-slate-500 leading-normal font-medium">
              Buat akun untuk memantau kehadiran dan capaian hasil belajar putra/putri Anda.
            </p>
          </div>

          {/* Form Body */}
          <form onSubmit={handleRegister} className="space-y-2.5">
            {error && (
              <Alert variant="destructive" className="rounded-xl py-1.5 px-3">
                <AlertDescription className="text-[11px]">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <User className="w-3.5 h-3.5" />
                </div>
                <Input
                  type="text"
                  placeholder="Nama Lengkap Orang Tua / Wali (cth: Rina Kusumastuti)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                  className="w-full h-10 pl-9 pr-3.5 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-semibold text-slate-800 rounded-xl border border-transparent focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <Input
                  type="email"
                  placeholder="Email Orang Tua (nama@email.com)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full h-10 pl-9 pr-3.5 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-semibold text-slate-800 rounded-xl border border-transparent focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Kata sandi (min. 8 karakter)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full h-10 pl-9 pr-9 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-semibold text-slate-800 rounded-xl border border-transparent focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Ulangi kata sandi"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full h-10 pl-9 pr-9 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-semibold text-slate-800 rounded-xl border border-transparent focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showConfirmPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
                >
                  {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Buttons Row */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="submit"
                className="flex-1 h-10 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold shadow-md shadow-emerald-700/20 hover:shadow-emerald-700/30 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                disabled={loading}
              >
                <span>{loading ? "Mendaftarkan..." : "Daftar Akun"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
              <Link
                href={`/parent/login${callbackUrl !== "/parent" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
                className="px-3.5 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center"
              >
                Masuk
              </Link>
            </div>
          </form>

        </div>

        {/* Bottom Micro Switcher & Copyright */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>&copy; {new Date().getFullYear()} KLASSA &bull; Portal Orang Tua</span>
          <Link
            href="/login"
            className="text-emerald-700 font-bold hover:underline flex items-center gap-1 transition-colors"
          >
            <School className="w-3.5 h-3.5" />
            <span>Anda seorang Guru? Masuk Ruang Kerja Guru &rarr;</span>
          </Link>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          SISI KANAN: 50% VIEWPORT S-CURVE WAVE + 3D MODULAR COCKPIT
      ───────────────────────────────────────────────────────────── */}
      <ModularCockpitArtwork theme="emerald" portalType="parent" />

    </div>
  );
}
