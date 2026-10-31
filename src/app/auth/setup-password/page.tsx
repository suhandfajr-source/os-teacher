"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Lock, CheckCircle2, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

function SetupPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [orderInfo, setOrderInfo] = useState<{ email: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Verifikasi keabsahan token saat halaman dibuka
  useEffect(() => {
    if (!token) {
      setError("Tautan aktivasi tidak ditemukan atau tidak lengkap.");
      setChecking(false);
      return;
    }

    async function verifyToken() {
      try {
        const res = await fetch(`/api/payment/verify-token?token=${token}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Tautan aktivasi tidak valid atau telah kedaluwarsa.");
        } else {
          setOrderInfo(data);
        }
      } catch (err) {
        setError("Gagal menghubungi server untuk memvalidasi token.");
      } finally {
        setChecking(false);
      }
    }

    verifyToken();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Kata sandi minimal harus 8 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/payment/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengaktifkan akun.");
      }

      setSuccess(true);
      // Tunggu 1 detik lalu redirect ke onboarding
      setTimeout(() => {
        router.push("/onboarding");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memproses aktivasi.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600 mb-3" />
        <p className="text-sm">Memverifikasi tautan aktivasi Anda...</p>
      </div>
    );
  }

  if (error && !orderInfo) {
    return (
      <div className="text-center p-4">
        <div className="w-12 h-12 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Tautan Tidak Valid</h2>
        <p className="text-sm text-slate-600 mb-6">{error}</p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700"
        >
          <span>Kembali ke Halaman Masuk</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center p-4">
        <div className="w-12 h-12 bg-teal-50 border border-teal-100 rounded-full flex items-center justify-center mx-auto mb-4 text-teal-600">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Akun Berhasil Diaktifkan!</h2>
        <p className="text-sm text-slate-600 mb-4">
          Mengalihkan Anda ke langkah pengisian profil mengajar (onboarding)...
        </p>
        <Loader2 className="w-5 h-5 animate-spin text-teal-600 mx-auto" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <div className="w-12 h-12 bg-teal-50 border border-teal-100 rounded-full flex items-center justify-center mx-auto mb-3 text-teal-600">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Buat Kata Sandi Akun</h1>
        <p className="text-xs text-slate-500 mt-1">
          Akun untuk <strong>{orderInfo?.email}</strong>
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Nama Lengkap
          </label>
          <input
            type="text"
            value={orderInfo?.name || ""}
            disabled
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Kata Sandi Baru (Min. 8 Karakter)
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Ulangi Kata Sandi
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition shadow-sm mt-6"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Menyimpan Kata Sandi...</span>
            </>
          ) : (
            <>
              <span>Aktifkan & Lanjut ke Onboarding</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <Suspense fallback={<div className="text-center p-4 text-sm text-slate-500">Memuat...</div>}>
          <SetupPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
