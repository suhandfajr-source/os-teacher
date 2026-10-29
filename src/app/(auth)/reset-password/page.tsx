"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authClient } from "@/lib/auth-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Token atur ulang kata sandi tidak valid atau hilang dari tautan.");
      return;
    }

    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setLoading(true);

    try {
      const res = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (res?.error) {
        setError(res.error.message || "Gagal mengatur ulang kata sandi. Tautan mungkin telah kedaluwarsa.");
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch {
      setError("Terjadi kesalahan pada server. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-4 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 p-4">
        <h2 className="text-xs font-bold text-red-800 dark:text-red-200">
          Tautan Tidak Valid
        </h2>
        <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
          Tautan atur ulang kata sandi tidak memuat token yang sah. Silakan minta tautan baru dari halaman lupa kata sandi.
        </p>
        <Link href="/forgot-password">
          <Button
            variant="outline"
            className="w-full h-10 rounded-xl text-xs font-bold border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 hover:bg-red-100/50 mt-2"
          >
            Minta Tautan Baru
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col justify-center">
      <div className="mb-6 space-y-1.5">
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          Kata Sandi Baru
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Masukkan kata sandi baru untuk akun Anda (minimal 8 karakter).
        </p>
      </div>

      {success ? (
        <div className="space-y-4 rounded-2xl border border-teal-200/80 bg-teal-50/80 dark:border-teal-900/60 dark:bg-teal-950/40 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-xs font-bold text-teal-900 dark:text-teal-200">
                Kata Sandi Berhasil Diperbarui
              </h2>
              <p className="text-xs text-teal-800/90 dark:text-teal-300/90 leading-relaxed">
                Kata sandi baru Anda telah aktif. Mengalihkan Anda ke halaman masuk dalam beberapa detik...
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Link href="/login">
              <Button className="w-full h-10 rounded-xl text-xs font-bold bg-teal-700 text-white hover:bg-teal-800">
                Masuk Sekarang
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <Alert variant="destructive" className="rounded-2xl py-2 px-3 border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-200">
              <AlertDescription className="text-xs leading-relaxed">
                <strong className="block font-bold text-red-700 mb-0.5">Gagal Mengubah Sandi</strong>
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Kata sandi baru (min. 8 karakter)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                className="w-full h-11 pl-11 pr-11 bg-white/90 hover:bg-white focus:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 dark:focus:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white rounded-2xl border border-slate-200/80 shadow-xs focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
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

          <div className="space-y-1">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Ulangi kata sandi baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                className="w-full h-11 pl-11 pr-4 bg-white/90 hover:bg-white focus:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 dark:focus:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white rounded-2xl border border-slate-200/80 shadow-xs focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#0F766E] to-[#14B8A6] hover:from-[#0D635C] hover:to-[#0F9E8E] text-white text-xs font-extrabold shadow-lg shadow-teal-700/25 hover:shadow-teal-700/35 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              disabled={loading}
            >
              <span>{loading ? "Menyimpan..." : "Simpan Kata Sandi Baru"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center text-xs text-slate-400">Memuat halaman...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
