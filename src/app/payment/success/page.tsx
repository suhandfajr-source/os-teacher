"use client";

import { useState } from "react";
import { CheckCircle2, Lock, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
        
        {/* Success Icon */}
        <div className="w-16 h-16 bg-teal-50 border border-teal-100 rounded-full flex items-center justify-center mx-auto mb-6 text-teal-600">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <span className="inline-block bg-teal-50 text-teal-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3">
          Pembayaran Berhasil Diterima
        </span>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Terima Kasih Atas Kepercayaan Anda!
        </h1>

        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Tautan aktivasi akun dan pembuatan kata sandi baru telah kami kirimkan ke alamat email Anda.
        </p>

        {/* Info Box */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-left mb-6 space-y-2.5">
          <div className="flex items-start gap-2.5 text-xs text-slate-700">
            <span className="font-bold text-teal-600 mt-0.5">1.</span>
            <span>Buka inbox atau folder spam email Anda.</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-slate-700">
            <span className="font-bold text-teal-600 mt-0.5">2.</span>
            <span>Klik tautan <strong>"Aktifkan Akun & Buat Password"</strong>.</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-slate-700">
            <span className="font-bold text-teal-600 mt-0.5">3.</span>
            <span>Ikuti panduan singkat onboarding untuk mengatur ruang kelas Anda.</span>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <p className="text-xs text-slate-500 mb-4">
            Sudah menyelesaikan aktivasi sebelumnya?
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition"
          >
            <span>Masuk ke Ruang Guru</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </div>
  );
}
