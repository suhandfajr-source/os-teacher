"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await (authClient as any).forgetPassword({
        email: email.trim(),
        redirectTo: "/reset-password",
      });

      if (res?.error) {
        setError(res.error.message || "Gagal mengirim permintaan atur ulang sandi.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col justify-center">
      {/* Back to Login Link */}
      <div className="mb-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke halaman masuk</span>
        </Link>
      </div>

      <div className="mb-6 space-y-1.5">
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          Lupa Kata Sandi
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Masukkan alamat email akun Klassa Anda. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi.
        </p>
      </div>

      {success ? (
        <div className="space-y-4 rounded-2xl border border-teal-200/80 bg-teal-50/80 dark:border-teal-900/60 dark:bg-teal-950/40 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-xs font-bold text-teal-900 dark:text-teal-200">
                Tautan Berhasil Dikirim
              </h2>
              <p className="text-xs text-teal-800/90 dark:text-teal-300/90 leading-relaxed">
                Jika email <strong className="font-semibold">{email}</strong> terdaftar, tautan verifikasi telah dikirimkan ke kotak masuk Anda. Tautan berlaku selama 1 jam.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Link href="/login">
              <Button
                variant="outline"
                className="w-full h-10 rounded-xl text-xs font-bold border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-200 hover:bg-teal-100/50"
              >
                Kembali Masuk
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive" className="rounded-2xl py-2 px-3 border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-200">
              <AlertDescription className="text-xs leading-relaxed">
                <strong className="block font-bold text-red-700 mb-0.5">Permintaan Gagal</strong>
                {error}
              </AlertDescription>
            </Alert>
          )}

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
                className="w-full h-11 pl-11 pr-4 bg-white/90 hover:bg-white focus:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 dark:focus:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white rounded-2xl border border-slate-200/80 shadow-xs focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#0F766E] to-[#14B8A6] hover:from-[#0D635C] hover:to-[#0F9E8E] text-white text-xs font-extrabold shadow-lg shadow-teal-700/25 hover:shadow-teal-700/35 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            disabled={loading}
          >
            <span>{loading ? "Mengirim Tautan..." : "Kirim Tautan Atur Ulang"}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
