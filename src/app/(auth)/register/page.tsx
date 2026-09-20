"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff, User, Mail, Lock, ArrowRight } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
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
      setError(error.message || "Pendaftaran akun gagal");
      setLoading(false);
    } else {
      toast.success("Pendaftaran berhasil! Mari siapkan ruang kerja Anda.");
      router.push("/onboarding");
      router.refresh();
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Header Text */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-[#0F766E] text-[11px] font-extrabold tracking-wider uppercase border border-teal-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse"></span>
          <span>PENDAFTARAN AKUN RESMI GURU</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
          Mulai Perjalanan Mengajar <br />
          <span className="shimmer-text">Lebih Tenang & Berdaya.</span>
        </h1>

        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          Daftarkan akun Anda dan nikmati otomasi administrasi terpadu di KLASSA.
        </p>
      </div>

      {/* Form Body */}
      <form onSubmit={handleRegister} className="space-y-3">
        {error && (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-1">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <User className="w-4 h-4" />
            </div>
            <Input 
              type="text" 
              placeholder="Nama Lengkap & Gelar (cth: Rahmawati, S.Pd)" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required 
              className="w-full h-11 pl-11 pr-4 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-semibold text-slate-800 rounded-2xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <Input 
              type="email" 
              placeholder="Email Guru / Sekolah (nama@sekolah.sch.id)" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required 
              className="w-full h-11 pl-11 pr-4 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-semibold text-slate-800 rounded-2xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <Input 
              type={showPassword ? "text" : "password"} 
              placeholder="Kata sandi (min. 8 karakter)" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              minLength={8}
              className="w-full h-11 pl-11 pr-11 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-semibold text-slate-800 rounded-2xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <Input 
              type={showConfirmPassword ? "text" : "password"} 
              placeholder="Konfirmasi kata sandi" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required 
              minLength={8}
              className="w-full h-11 pl-11 pr-11 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-semibold text-slate-800 rounded-2xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              aria-label={showConfirmPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Buttons Action Row */}
        <div className="flex items-center gap-3 pt-2">
          <Button 
            type="submit" 
            className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-[#0F766E] to-[#14B8A6] hover:from-[#0D635C] hover:to-[#0F9E8E] text-white text-xs font-extrabold shadow-lg shadow-teal-700/25 hover:shadow-teal-700/35 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2" 
            disabled={loading}
          >
            <span>{loading ? "Mendaftarkan..." : "Daftar Akun Guru"}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Link
            href="/login"
            className="px-5 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center"
          >
            Masuk
          </Link>
        </div>
      </form>
    </div>
  );
}
