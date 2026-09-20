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
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    const { error } = await authClient.signIn.email({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setError(error.message || "Email atau kata sandi tidak sesuai");
      setLoading(false);
    } else {
      toast.success("Selamat datang kembali di KLASSA!");
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="w-full space-y-3.5">
      {/* Header Text */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-50 text-[#0F766E] text-[9px] font-extrabold tracking-wider uppercase border border-teal-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse"></span>
          <span>RUANG KERJA CERDAS GURU</span>
        </div>

        <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Bantu Guru Naik Kelas, <br />
          <span className="shimmer-text">Kurangi Rutinitas & Tingkatkan Produktivitas.</span>
        </h1>

        <p className="text-[11px] text-slate-500 leading-normal font-medium">
          Otomatisasi presensi harian, draf modul ajar AI, dan rekap nilai resmi dalam satu ruang kerja terpadu.
        </p>
      </div>

      {/* Form Body */}
      <form onSubmit={handleLogin} className="space-y-2.5">
        {error && (
          <Alert variant="destructive" className="rounded-xl py-1.5 px-3">
            <AlertDescription className="text-[11px]">{error}</AlertDescription>
          </Alert>
        )}

        {/* Input Email */}
        <div className="space-y-1">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Mail className="w-3.5 h-3.5" />
            </div>
            <Input 
              type="email" 
              placeholder="nama@sekolah.sch.id" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required 
              className="w-full h-10 pl-9 pr-3.5 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-semibold text-slate-800 rounded-xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
            />
          </div>
        </div>

        {/* Input Password */}
        <div className="space-y-1">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <Input 
              type={showPassword ? "text" : "password"} 
              placeholder="Kata sandi akun" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required 
              className="w-full h-10 pl-9 pr-9 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-semibold text-slate-800 rounded-xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Remember me & Forgot Password */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-0.5">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-3 h-3 rounded border-slate-300 text-teal-700 focus:ring-teal-500 accent-teal-700 cursor-pointer"
            />
            <span>Ingat sesi saya</span>
          </label>
          <span className="text-teal-700 hover:underline font-bold cursor-pointer">
            Lupa kata sandi?
          </span>
        </div>

        {/* Buttons Action Row */}
        <div className="flex items-center gap-2 pt-1">
          <Button 
            type="submit" 
            className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#0F766E] to-[#14B8A6] hover:from-[#0D635C] hover:to-[#0F9E8E] text-white text-xs font-extrabold shadow-md shadow-teal-700/20 hover:shadow-teal-700/30 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5" 
            disabled={loading}
          >
            <span>{loading ? "Memproses..." : "Masuk ke Ruang Kerja"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
          <Link
            href="/register"
            className="px-3.5 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center"
          >
            Daftar
          </Link>
        </div>
      </form>
    </div>
  );
}
