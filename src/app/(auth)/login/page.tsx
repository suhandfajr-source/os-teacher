"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isBannedError, setIsBannedError] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setIsBannedError(false);
    
    const { error } = await authClient.signIn.email({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("ban") || error.status === 403) {
        setIsBannedError(true);
        setError("Akun Anda telah dinonaktifkan / diblokir oleh Administrator. Silakan hubungi admin sekolah untuk mengaktifkan kembali akun Anda.");
      } else {
        setError(error.message || "Email atau kata sandi tidak sesuai");
      }
      setLoading(false);
    } else {
      toast.success("Selamat datang kembali di KLASSA!");
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="w-full space-y-3.5">
      {/* Interactive Mobile Hero Card Banner (Ditempatkan langsung di atas form wizard) */}
      <div className="lg:hidden p-3.5 rounded-2xl bg-gradient-to-r from-teal-700 via-teal-600 to-teal-800 text-white shadow-lg shadow-teal-900/15 flex items-center justify-between gap-3 relative overflow-hidden">
        <div className="absolute -right-4 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
        <div className="space-y-0.5 relative z-10">
          <span className="text-[10px] font-bold text-teal-200 uppercase tracking-wider flex items-center gap-1">
            Ruang Kerja Guru
          </span>
          <h2 className="text-sm font-black tracking-tight leading-tight">
            Selamat Datang, Bapak/Ibu Guru
          </h2>
          <p className="text-[11px] text-teal-100/90 leading-tight">
            Kelola rombel, modul ajar AI, dan rekap nilai otomatis.
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0 text-white font-black text-xs shadow-inner">
          AI
        </div>
      </div>

      {/* Header Text (Desktop Only) */}
      <div className="hidden lg:block space-y-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-300 text-[10px] font-extrabold tracking-wider uppercase border border-teal-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse"></span>
          <span>RUANG KERJA CERDAS GURU</span>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          Bantu Guru Naik Kelas, <br />
          <span className="shimmer-text">Kurangi Rutinitas & Tingkatkan Produktivitas.</span>
        </h1>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal font-medium">
          Otomatisasi presensi harian, draf modul ajar AI, dan rekap nilai resmi dalam satu ruang kerja terpadu.
        </p>
      </div>

      {/* Segmented Switcher Masuk / Daftar Guru */}
      <div className="p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center border border-slate-200/80 dark:border-slate-800">
        <div className="flex-1 py-2 rounded-xl text-xs font-bold transition-all text-center bg-white dark:bg-slate-800 text-[#0F766E] dark:text-teal-300 shadow-sm cursor-default">
          Masuk Akun
        </div>
        <Link
          href="/register"
          className="flex-1 py-2 rounded-xl text-xs font-bold transition-all text-center text-slate-500 hover:text-slate-700"
        >
          Daftar Guru Baru
        </Link>
      </div>

      {/* Form Body */}
      <form onSubmit={handleLogin} className="space-y-3">
        {error && (
          <Alert variant={isBannedError ? "destructive" : "destructive"} className="rounded-2xl py-2 px-3 border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-200">
            <AlertDescription className="text-xs leading-relaxed">
              <strong className="block font-bold text-red-700 mb-0.5">
                {isBannedError ? "⚠️ Akses Akun Dibatasi" : "Gagal Masuk"}
              </strong>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Input Email */}
        <div className="space-y-1">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <Input 
              type="email" 
              placeholder="nama@sekolah.sch.id" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required 
              className="w-full h-11 pl-11 pr-4 bg-white/90 hover:bg-white focus:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 dark:focus:bg-slate-900 text-xs font-semibold text-slate-800 rounded-2xl border border-slate-200/80 shadow-xs focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
            />
          </div>
        </div>

        {/* Input Password */}
        <div className="space-y-1">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <Input 
              type={showPassword ? "text" : "password"} 
              placeholder="Kata sandi akun" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required 
              className="w-full h-11 pl-11 pr-11 bg-white/90 hover:bg-white focus:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 dark:focus:bg-slate-900 text-xs font-semibold text-slate-800 rounded-2xl border border-slate-200/80 shadow-xs focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Forgot Password */}
        <div className="flex items-center justify-end text-xs text-slate-500 font-medium pt-0.5">
          <span className="text-teal-700 hover:underline font-bold cursor-pointer">
            Lupa kata sandi?
          </span>
        </div>

        {/* Buttons Action Row */}
        <div className="pt-2">
          <Button 
            type="submit" 
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#0F766E] to-[#14B8A6] hover:from-[#0D635C] hover:to-[#0F9E8E] text-white text-xs font-extrabold shadow-lg shadow-teal-700/25 hover:shadow-teal-700/35 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2" 
            disabled={loading}
          >
            <span>{loading ? "Memproses..." : "Masuk ke Ruang Kerja"}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
