"use client";

import React, { useState } from "react";
import { ShieldAlert, PhoneCall, LogOut, Info, AlertTriangle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface AccountBannedBannerProps {
  banReason?: string | null;
}

export function AccountBannedBanner({ banReason }: AccountBannedBannerProps) {
  const router = useRouter();
  const [showContactModal, setShowContactModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      window.location.href = "/login";
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <div className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-4 py-3 shadow-md border-b border-red-800/40 relative z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-white/15 border border-white/20 shrink-0 mt-0.5 sm:mt-0 shadow-inner">
              <ShieldAlert className="w-5 h-5 text-red-100 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide bg-black/25 px-2 py-0.5 rounded-full border border-white/20">
                  Akun Dinonaktifkan
                </span>
                <span className="text-[11px] text-red-100 font-semibold hidden md:inline">
                  Mode Hanya-Baca (Read-Only)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-red-50 mt-1 font-medium leading-snug">
                Akun Anda telah dinonaktifkan oleh Administrator. Seluruh fitur perubahan data dinonaktifkan.
                {banReason && (
                  <span className="block text-[11px] text-red-200 mt-0.5 font-normal italic">
                    Catatan: &ldquo;{banReason}&rdquo;
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0 w-full sm:w-auto justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowContactModal(true)}
              className="h-8 text-xs font-bold bg-white text-red-700 hover:bg-red-50 hover:text-red-800 border-white shadow-xs rounded-xl flex items-center gap-1.5"
            >
              <PhoneCall className="w-3.5 h-3.5 text-red-600" />
              <span>Hubungi Admin</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="h-8 text-xs font-semibold text-white/90 hover:text-white hover:bg-white/20 rounded-xl flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isLoggingOut ? "Keluar..." : "Keluar"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Modal Detail Kontak Admin */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Aktivasi Kembali Akun Guru
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Informasi pemulihan akses akun
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <p>
                Status akun guru Anda saat ini berstatus <strong>Banned / Dinonaktifkan</strong> oleh administrator sekolah.
              </p>
              <p>
                Untuk mengaktifkan kembali akun dan memulihkan akses penuh:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-200 font-medium">
                <li>Hubungi Admin Kurikulum / Kepala Sekolah di instansi Anda.</li>
                <li>Sampaikan alamat email akun Anda.</li>
                <li>Minta administrator membuka konsol admin untuk memulihkan status akun.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="w-full h-9 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold"
              >
                Saya Mengerti
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
