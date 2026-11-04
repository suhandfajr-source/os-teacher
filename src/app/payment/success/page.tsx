"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, ArrowRight } from "lucide-react";
import Link from "next/link";
import { PaymentTracking } from "@/components/payment/PaymentTracking";
import { disableMarketingTracking, type PaymentState } from "@/lib/meta-pixel";

export default function PaymentSuccessPage() {
  const [status, setStatus] = useState<PaymentState>("CHECKING");
  const [attempt, setAttempt] = useState(0);
  const [trackingOff, setTrackingOff] = useState(false);
  const paid = status === "PAID";
  const messages: Record<PaymentState, string> = {
    CHECKING: "Memeriksa status pembayaran…",
    PENDING: "Menunggu konfirmasi pembayaran DOKU",
    PAID: "Pembayaran berhasil dikonfirmasi",
    FAILED: "Pembayaran belum berhasil",
    EXPIRED: "Sesi pembayaran telah kedaluwarsa",
    UNVERIFIED: "Transaksi belum dapat diverifikasi",
    UNAVAILABLE: "Pemeriksaan sementara tidak tersedia",
  };
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <PaymentTracking onStatus={setStatus} attempt={attempt} />
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
        
        {/* Success Icon */}
        <div className="w-16 h-16 bg-teal-50 border border-teal-100 rounded-full flex items-center justify-center mx-auto mb-6 text-teal-600">
          {paid ? <CheckCircle2 className="w-8 h-8" /> : <Clock3 className="w-8 h-8" />}
        </div>

        <span role="status" aria-live="polite" className="inline-block bg-teal-50 text-teal-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3">
          {messages[status]}
        </span>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {paid ? "Terima Kasih Atas Kepercayaan Anda!" : "Status Pembayaran Anda"}
        </h1>

        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          {paid
            ? "Silakan periksa email untuk tautan aktivasi akun. Pengiriman dapat memerlukan beberapa saat; periksa juga folder spam."
            : "Halaman ini belum menjadi bukti pembayaran lunas. Jika Anda sudah membayar, tunggu konfirmasi DOKU lalu periksa kembali. Jangan melakukan pembayaran ulang hanya karena status belum diperbarui."}
        </p>

        {/* Info Box */}
        {paid && <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-left mb-6 space-y-2.5">
          <div className="flex items-start gap-2.5 text-xs text-slate-700">
            <span className="font-bold text-teal-600 mt-0.5">1.</span>
            <span>Buka inbox atau folder spam email Anda.</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-slate-700">
            <span className="font-bold text-teal-600 mt-0.5">2.</span>
            <span>Klik tautan <strong>&quot;Aktifkan Akun &amp; Buat Password&quot;</strong>.</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-slate-700">
            <span className="font-bold text-teal-600 mt-0.5">3.</span>
            <span>Ikuti panduan singkat onboarding untuk mengatur ruang kelas Anda.</span>
          </div>
        </div>}

        {!paid && <button type="button" onClick={() => setAttempt(value => value + 1)} className="mb-6 rounded-xl border border-teal-600 px-4 py-2 text-sm font-semibold text-teal-700">
          Periksa Status Lagi
        </button>}

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
        <button type="button" className="mt-5 text-xs text-slate-500 underline" onClick={() => { disableMarketingTracking(); setTrackingOff(true); }}>
          {trackingOff ? "Pelacakan dinonaktifkan pada halaman ini" : "Nonaktifkan pelacakan pemasaran di browser ini"}
        </button>

      </div>
    </div>
  );
}
