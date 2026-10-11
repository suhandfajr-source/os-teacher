"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  joinCbtSessionByTokenAction,
  getStudentCbtSessionStatusAction,
} from "@/modules/cbt-live/cbt-live.actions";
import { CbtStudentLobbyView } from "@/modules/cbt-live/cbt-live.types";
import {
  KeyRound,
  Clock,
  Sparkles,
  ArrowRight,
  BookOpen,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export function CbtLobbyClient() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lobbyData, setLobbyData] = useState<CbtStudentLobbyView | null>(null);

  // Polling status saat di lobi menunggu ujian dimulai
  useEffect(() => {
    if (!lobbyData) return;

    // Jika sesi sudah ACTIVE, langsung redirect ke runner
    if (lobbyData.status === "ACTIVE") {
      router.push(`/siswa/portal/quiz/${lobbyData.shareToken}`);
      return;
    }

    const interval = setInterval(async () => {
      const res = await getStudentCbtSessionStatusAction(lobbyData.sessionId);
      if (res.success && res.status) {
        if (res.status === "ACTIVE") {
          toast.success("Ujian telah dimulai oleh guru!");
          router.push(`/siswa/portal/quiz/${lobbyData.shareToken}`);
        } else if (res.status === "ENDED") {
          toast.info("Sesi ujian telah diakhiri oleh guru.");
          setLobbyData(null);
        }
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [lobbyData, router]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenInput.trim().length !== 6) {
      toast.error("Masukkan 6 karakter PIN sesi.");
      return;
    }

    setLoading(true);
    try {
      const res = await joinCbtSessionByTokenAction(tokenInput);
      if (res.success && res.data) {
        setLobbyData(res.data);
        if (res.data.status === "ACTIVE") {
          router.push(`/siswa/portal/quiz/${res.data.shareToken}`);
        }
      } else {
        toast.error(res.error || "Gagal bergabung ke sesi.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {!lobbyData ? (
        /* ─────────────────────────────────────────────────────────────
            1. TOKEN ENTRY CARD
        ───────────────────────────────────────────────────────────── */
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
            <KeyRound className="w-6 h-6" />
          </div>

          <h1 className="text-xl font-bold text-slate-900">Ujian Serentak (CBT Live)</h1>
          <p className="text-xs text-slate-500 mt-1">
            Masukkan PIN 6 karakter yang diberikan oleh guru pengawas untuk bergabung ke ruang ujian.
          </p>

          <form onSubmit={handleJoin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                PIN Sesi Ujian
              </label>
              <input
                type="text"
                maxLength={6}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                placeholder="Misal: CBT88X"
                className="w-full text-center tracking-[0.35em] text-2xl font-mono font-bold uppercase py-3.5 px-4 rounded-2xl border border-slate-200 focus:border-purple-600 focus:ring-4 focus:ring-purple-100 outline-none transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:font-normal"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || tokenInput.length !== 6}
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                "Memeriksa Sesi..."
              ) : (
                <>
                  Masuk Ruang Ujian <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-2.5 text-[11px] text-slate-400">
            <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
            <span>
              Pastikan Anda menggunakan jaringan stabil dan perangkat tidak dalam mode hemat daya sebelum ujian dimulai.
            </span>
          </div>
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
            2. WAITING LOBBY CARD
        ───────────────────────────────────────────────────────────── */
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs text-center">
          <div className="w-16 h-16 rounded-3xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4 relative">
            <Sparkles className="w-8 h-8 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Ruang Tunggu Ujian
          </span>

          <h2 className="text-xl font-bold text-slate-900 mt-3">{lobbyData.quizTitle}</h2>
          <p className="text-xs text-slate-500 mt-1">{lobbyData.subjectName}</p>

          <div className="my-6 grid grid-cols-2 gap-3 max-w-xs mx-auto">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Durasi</span>
              <span className="text-sm font-bold text-slate-800 flex items-center justify-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                {lobbyData.durationMinutes ? `${lobbyData.durationMinutes}m` : "Bebas"}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Jumlah Soal</span>
              <span className="text-sm font-bold text-slate-800 flex items-center justify-center gap-1 mt-0.5">
                <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                {lobbyData.totalQuestions} Soal
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-center justify-center gap-3">
            <span className="w-3 h-3 rounded-full bg-purple-600 animate-ping" />
            <p className="text-xs font-semibold text-purple-900">
              Menunggu guru memulai ujian serentak...
            </p>
          </div>

          <p className="text-[11px] text-slate-400 mt-4">
            Halaman ini akan otomatis membuka lembar soal ketika pengawas mengaktifkan sesi.
          </p>

          <button
            onClick={() => setLobbyData(null)}
            className="mt-6 text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Keluar dari ruang tunggu
          </button>
        </div>
      )}
    </div>
  );
}
