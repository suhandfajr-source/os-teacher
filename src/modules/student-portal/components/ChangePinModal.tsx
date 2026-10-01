"use client";

import React, { useState } from "react";
import { KeyRound, ShieldAlert, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { changeStudentPinAction } from "@/modules/student-portal/student-portal.actions";

interface ChangePinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePinModal({ isOpen, onClose }: ChangePinModalProps) {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!/^\d{4}$/.test(oldPin)) {
      setError("PIN lama harus 4 digit angka.");
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setError("PIN baru harus 4 digit angka.");
      return;
    }
    if (newPin === oldPin) {
      setError("PIN baru tidak boleh sama dengan PIN lama.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("Konfirmasi PIN baru tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const res = await changeStudentPinAction({
        oldPin,
        newPin,
      });

      if (res.success) {
        toast.success(res.message || "PIN keamanan berhasil diubah!");
        setOldPin("");
        setNewPin("");
        setConfirmPin("");
        onClose();
      } else {
        setError(res.error || "Gagal mengubah PIN.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan sistem.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <h3 className="text-base font-black text-slate-900">
            Ganti PIN Keamanan
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Perbarui 4 digit PIN loginmu. Sesi akun di perangkat lain akan otomatis diakhiri.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="rounded-xl py-2 px-3">
            <AlertDescription className="text-xs flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          {/* PIN Lama */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block">
              PIN Saat Ini (4 Digit)
            </label>
            <Input
              type="password"
              maxLength={4}
              placeholder="••••"
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="h-10 text-xs font-mono font-black tracking-widest text-center rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white"
            />
          </div>

          {/* PIN Baru */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block">
              PIN Baru (4 Digit)
            </label>
            <Input
              type="password"
              maxLength={4}
              placeholder="••••"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="h-10 text-xs font-mono font-black tracking-widest text-center rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white"
            />
          </div>

          {/* Konfirmasi PIN Baru */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block">
              Ulangi PIN Baru
            </label>
            <Input
              type="password"
              maxLength={4}
              placeholder="••••"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="h-10 text-xs font-mono font-black tracking-widest text-center rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={onClose}
              className="flex-1 h-11 rounded-xl text-xs font-bold text-slate-700"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 h-11 rounded-xl bg-[#0F766E] hover:bg-[#0D655E] text-white text-xs font-bold shadow-md shadow-teal-900/10"
            >
              {loading ? "Menyimpan..." : "Simpan PIN"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
