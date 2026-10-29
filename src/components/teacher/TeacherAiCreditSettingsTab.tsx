"use client";

import React, { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  KeyRound,
  Zap,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Coins,
  History,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  getTeacherCreditAction,
  getTeacherCreditLedgerAction,
  saveTeacherByokAction,
  testTeacherByokConnectionAction,
} from "@/modules/ai/credit/credit.actions";
import type { TeacherCreditStatus } from "@/modules/ai/credit/credit.service";

export function TeacherAiCreditSettingsTab() {
  const [status, setStatus] = useState<TeacherCreditStatus | null>(null);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // BYOK Form State
  const [provider, setProvider] = useState<"google" | "openai-compatible">("google");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [customModel, setCustomModel] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statusRes, ledgerRes] = await Promise.all([
        getTeacherCreditAction(),
        getTeacherCreditLedgerAction(),
      ]);

      if (statusRes.success && statusRes.data) {
        setStatus(statusRes.data);
        if (statusRes.data.byokProvider) {
          setProvider(statusRes.data.byokProvider as any);
        }
        if (statusRes.data.byokModel) {
          setCustomModel(statusRes.data.byokModel);
        }
        setIsActive(statusRes.data.byokActive);
      }
      if (ledgerRes.success && ledgerRes.data) {
        setLedgers(ledgerRes.data);
      }
    } catch (err: unknown) {
      toast.error("Gagal memuat status kredit AI.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestConnection = () => {
    if (!apiKey.trim() && !status?.hasByok) {
      toast.error("Masukkan API Key terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      setTestResult(null);
      const res = await testTeacherByokConnectionAction({
        provider,
        apiKey: apiKey.trim(),
        baseURL: baseURL.trim() || undefined,
        model: customModel.trim() || undefined,
      });
      setTestResult(res);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleSaveByok = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveTeacherByokAction({
        provider,
        apiKey: apiKey.trim(),
        baseURL: baseURL.trim() || undefined,
        customModel: customModel.trim() || undefined,
        isActive,
      });

      if (res.success) {
        toast.success("Pengaturan API Key pribadi (BYOK) berhasil disimpan!");
        setApiKey("");
        loadData();
      } else {
        toast.error(res.error || "Gagal menyimpan BYOK.");
      }
    });
  };

  if (loading && !status) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600" />
        Memuat data kredit & konfigurasi AI...
      </div>
    );
  }

  const percentLeft = status
    ? Math.min(100, Math.max(0, Math.round((status.creditsBalance / (status.dailyAllowanceCredits || 50)) * 100)))
    : 0;

  return (
    <div className="space-y-6">
      {/* 1. KARTU SALDO KREDIT SEKOLAH */}
      <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-teal-50 via-emerald-50/50 to-cyan-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-teal-950/20 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-100/70 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 text-[10px] font-extrabold uppercase">
                <Coins className="w-3 h-3 text-teal-600" />
                <span>Jatah Pemakaian AI Sekolah</span>
              </div>
              <CardTitle className="text-base font-black text-slate-900 dark:text-white">
                Saldo Kredit AI Harian
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                1 Kredit = 1.000 Token LLM resmi. Direset otomatis ke jatah awal setiap pukul 00:00 WIB.
              </CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isPending}
              className="h-8 rounded-xl text-xs gap-1.5 self-start sm:self-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
              Segarkan
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {status?.isSuperadmin ? "Unlimited" : `${status?.creditsBalance} Kredit`}
              </span>
              {!status?.isSuperadmin && (
                <span className="text-xs text-slate-500 ml-2">
                  / {status?.dailyAllowanceCredits} Kredit kuota harian ({status?.tokensBalance.toLocaleString()} Token)
                </span>
              )}
            </div>
            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-1 rounded-xl font-bold ${
                status?.isSuperadmin || percentLeft > 30
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : percentLeft > 0
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                  : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400"
              }`}
            >
              {status?.isSuperadmin
                ? "Bebas Kuota (Admin)"
                : percentLeft > 0
                ? `${percentLeft}% Tersedia Hari Ini`
                : "Kredit Sekolah Habis"}
            </Badge>
          </div>

          {!status?.isSuperadmin && (
            <div className="space-y-1">
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    percentLeft > 30
                      ? "bg-gradient-to-r from-teal-500 to-emerald-500"
                      : percentLeft > 10
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${percentLeft}%` }}
                />
              </div>
            </div>
          )}

          {status?.hasByok && (
            <div className="p-3 bg-teal-50/70 dark:bg-teal-950/30 rounded-2xl border border-teal-200/60 dark:border-teal-900/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  BYOK Aktif: <b>{status.byokProvider === "google" ? "Google Gemini" : "OpenAI Compatible"}</b> ({status.byokMaskedKey})
                </span>
              </div>
              <Badge className="bg-teal-600 text-white text-[10px]">Siap Fallback</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. FORM BYOK (BRING YOUR OWN KEY) */}
      <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-teal-600" />
            <CardTitle className="text-base font-black text-slate-900 dark:text-white">
              Kunci API Pribadi Guru (BYOK)
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 leading-relaxed">
            Jika kredit jatah sekolah habis, Klassa otomatis beralih menggunakan API Key pribadi Anda sehingga pekerjaan ajar tetap lancar tanpa terhenti.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSaveByok} className="space-y-4">
            {/* Pilihan Provider */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Penyedia AI (Provider)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProvider("google")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    provider === "google"
                      ? "border-teal-600 bg-teal-50/50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-bold shadow-xs"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900"
                  }`}
                >
                  <div className="text-xs font-bold">Google AI Studio (Gemini)</div>
                  <div className="text-[10px] text-slate-500 font-normal">Gratis & Resmi (Rekomendasi)</div>
                </button>
                <button
                  type="button"
                  onClick={() => setProvider("openai-compatible")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    provider === "openai-compatible"
                      ? "border-teal-600 bg-teal-50/50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-bold shadow-xs"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900"
                  }`}
                >
                  <div className="text-xs font-bold">OpenAI Compatible / Zhipu GLM</div>
                  <div className="text-[10px] text-slate-500 font-normal">OpenAI, GLM-4, Groq, atau vLLM</div>
                </button>
              </div>
            </div>

            {/* Input API Key */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  API Key Pribadi {status?.hasByok && <span className="font-normal text-slate-400">(Tersimpan aman)</span>}
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-teal-600 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Dapatkan API Key Gratis di Google AI Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder={status?.byokMaskedKey ? `Tersimpan (${status.byokMaskedKey}) — Kosongkan jika tidak diubah` : "Tempel API key pribadi Anda di sini..."}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="h-10 pr-10 text-xs font-mono rounded-xl bg-slate-50/80 dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Kunci Anda dienkripsi menggunakan AES-256 dan hanya digunakan saat kredit kuota sekolah Anda habis.
              </p>
            </div>

            {/* Opsi Tambahan jika OpenAI Compatible */}
            {provider === "openai-compatible" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Base URL API
                  </label>
                  <Input
                    type="url"
                    placeholder="https://open.bigmodel.cn/api/paas/v4"
                    value={baseURL}
                    onChange={(e) => setBaseURL(e.target.value)}
                    className="h-10 text-xs font-mono rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Model Kustom
                  </label>
                  <Input
                    type="text"
                    placeholder="glm-4-plus / gpt-4o-mini"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    className="h-10 text-xs font-mono rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Toggle Status Aktif */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="byokActiveToggle"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
              />
              <label htmlFor="byokActiveToggle" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                Aktifkan otomatis saat kredit sekolah habis
              </label>
            </div>

            {/* Feedback Test */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  testResult.success
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                type="submit"
                disabled={isPending}
                className="h-10 px-5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs"
              >
                {isPending ? "Menyimpan..." : "Simpan Pengaturan BYOK"}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={handleTestConnection}
                className="h-10 px-4 rounded-xl text-xs font-bold gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Uji Koneksi API
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 3. RIWAYAT PEMAKAIAN TOKEN & KREDIT */}
      <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-teal-600" />
            <CardTitle className="text-base font-black text-slate-900 dark:text-white">
              Riwayat Transaksi Token & Kredit
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500">
            Daftar pemotongan kredit LLM transparan berdasarkan token yang dihitung langsung oleh provider.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {ledgers.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Belum ada riwayat pemakaian kredit AI.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-2.5 font-bold">Waktu</th>
                    <th className="py-2.5 font-bold">Fitur</th>
                    <th className="py-2.5 font-bold">Model</th>
                    <th className="py-2.5 font-bold text-right">Total Token</th>
                    <th className="py-2.5 font-bold text-right">Biaya Kredit</th>
                    <th className="py-2.5 font-bold text-center">Sumber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {ledgers.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="py-2.5 text-slate-500 font-mono text-[11px]">
                        {new Date(l.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">
                        {l.feature === "AGENT"
                          ? "Klassa Agent"
                          : l.feature === "AI_STUDIO"
                          ? "AI Studio"
                          : l.feature}
                      </td>
                      <td className="py-2.5 text-slate-500 text-[11px] font-mono">
                        {l.modelUsed || "-"}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        {l.totalTokens.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-teal-700 dark:text-teal-400">
                        {l.isByok ? "0 (BYOK)" : `-${l.creditCost} Kr`}
                      </td>
                      <td className="py-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 rounded-lg ${
                            l.isByok
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {l.isByok ? "Key Pribadi" : "Kredit Sekolah"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
