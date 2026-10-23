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
  KeyRound,
  Sparkles,
  Bot,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  Zap,
  Check,
  Gauge,
} from "lucide-react";
import {
  getLlmSettingsAdminAction,
  updateAiUsageLimitAdminAction,
  updateApiKeysAdminAction,
  updateLlmModelsAdminAction,
  testLlmConnectionAdminAction,
} from "@/modules/system-settings/system-settings.actions";
import type { SystemLlmConfig } from "@/modules/system-settings/system-settings.service";

const KNOWN_AGENT_MODELS = [
  { id: "glm-4-plus", name: "GLM-4 Plus (Zhipu)", provider: "openai-compatible" },
  { id: "glm-4.5", name: "GLM-4.5 Penalaran (Zhipu)", provider: "openai-compatible" },
  { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash (Google)", provider: "google" },
  { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash Penalaran (Google)", provider: "google" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Google)", provider: "google" },
  { id: "hermes-local", name: "Hermes Open-Weights (vLLM / Ollama Local)", provider: "openai-compatible" },
];

export function KlassaLlmSettingsTab() {
  const [config, setConfig] = useState<SystemLlmConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // API Key Form State
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [glmKeyInput, setGlmKeyInput] = useState("");
  const [glmBaseUrlInput, setGlmBaseUrlInput] = useState("");
  const [dailyLimitInput, setDailyLimitInput] = useState("20");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGlmKey, setShowGlmKey] = useState(false);

  // Model Form State
  const [aiStudioProvider, setAiStudioProvider] = useState<"google" | "openai-compatible">("google");
  const [aiStudioModel, setAiStudioModel] = useState("gemini-2.5-flash");
  const [aiStudioTemperature, setAiStudioTemperature] = useState(0.7);

  const [agentDefaultModel, setAgentDefaultModel] = useState("glm-4-plus");
  const [agentAllowedModels, setAgentAllowedModels] = useState<string[]>([]);
  const [allowTeacherCustomModel, setAllowTeacherCustomModel] = useState(true);

  // Test Connection State
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [testingGlm, setTestingGlm] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    const res = await getLlmSettingsAdminAction();
    if (res.success && res.data) {
      setConfig(res.data);
      setGlmBaseUrlInput(res.data.glm.baseURL || "");
      setDailyLimitInput(String(res.data.aiUsage?.dailyLimit ?? 20));
      setAiStudioProvider(res.data.aiStudio.provider);
      setAiStudioModel(res.data.aiStudio.model);
      setAiStudioTemperature(res.data.aiStudio.temperature);

      setAgentDefaultModel(res.data.agent.defaultModel);
      setAgentAllowedModels(res.data.agent.allowedModels || []);
      setAllowTeacherCustomModel(res.data.agent.allowTeacherCustomModel);
    } else {
      toast.error(res.error || "Gagal mengambil data pengaturan LLM.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveApiKeys = () => {
    startTransition(async () => {
      const res = await updateApiKeysAdminAction({
        geminiKey: geminiKeyInput.trim() || undefined,
        glmKey: glmKeyInput.trim() || undefined,
        glmBaseUrl: glmBaseUrlInput.trim() || undefined,
      });

      if (res.success) {
        toast.success("API Key berhasil disimpan terenkripsi!");
        setGeminiKeyInput("");
        setGlmKeyInput("");
        await loadSettings();
      } else {
        toast.error(res.error || "Gagal menyimpan API Key.");
      }
    });
  };

  const handleSaveDailyLimit = () => {
    startTransition(async () => {
      const parsed = parseInt(dailyLimitInput, 10);
      const res = await updateAiUsageLimitAdminAction({
        dailyLimit: Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
      });

      if (res.success) {
        toast.success("Batas AI harian berhasil diperbarui!");
        await loadSettings();
      } else {
        toast.error(res.error || "Gagal menyimpan batas AI.");
      }
    });
  };

  const handleSaveModels = () => {
    startTransition(async () => {
      const res = await updateLlmModelsAdminAction({
        aiStudio: {
          provider: aiStudioProvider,
          model: aiStudioModel.trim(),
          temperature: Number(aiStudioTemperature),
        },
        agent: {
          defaultModel: agentDefaultModel,
          allowedModels: agentAllowedModels,
          allowTeacherCustomModel,
        },
      });

      if (res.success) {
        toast.success("Pengaturan Model AI Studio & Klassa Agent berhasil diperbarui!");
        await loadSettings();
      } else {
        toast.error(res.error || "Gagal memperbarui model.");
      }
    });
  };

  const handleTestConnection = async (provider: "google" | "openai-compatible") => {
    if (provider === "google") {
      setTestingGoogle(true);
      const res = await testLlmConnectionAdminAction({
        provider: "google",
        apiKey: geminiKeyInput.trim() || undefined,
        model: aiStudioProvider === "google" ? aiStudioModel : "gemini-2.5-flash",
      });
      setTestingGoogle(false);
      if (res.success) {
        toast.success(res.message || "Tes koneksi Gemini berhasil!");
      } else {
        toast.error(res.error || "Tes koneksi Gemini gagal.");
      }
    } else {
      setTestingGlm(true);
      const res = await testLlmConnectionAdminAction({
        provider: "openai-compatible",
        apiKey: glmKeyInput.trim() || undefined,
        baseURL: glmBaseUrlInput.trim() || undefined,
        model: agentDefaultModel.startsWith("glm-") ? agentDefaultModel : "glm-4-plus",
      });
      setTestingGlm(false);
      if (res.success) {
        toast.success(res.message || "Tes koneksi GLM berhasil!");
      } else {
        toast.error(res.error || "Tes koneksi GLM gagal.");
      }
    }
  };

  const toggleAllowedModel = (modelId: string) => {
    if (agentAllowedModels.includes(modelId)) {
      if (agentAllowedModels.length === 1) {
        toast.error("Minimal harus ada satu model yang diizinkan untuk guru.");
        return;
      }
      setAgentAllowedModels(agentAllowedModels.filter((id) => id !== modelId));
    } else {
      setAgentAllowedModels([...agentAllowedModels, modelId]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <span>Memuat konfigurasi LLM sistem...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-teal-900 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-teal-800/40 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-teal-300" />
            <span className="text-xs font-bold tracking-wider text-teal-300 uppercase">
              Super Admin Security Vault
            </span>
          </div>
          <h2 className="text-lg font-bold">Konfigurasi Model LLM & API Vault</h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Atur kredensial API dan tentukan model LLM yang mengotaki AI Studio (pembuat modul ajar, LKPD, rubrik) serta KLASSA Agent chat. Semua kunci dienkripsi AES-256-GCM di database.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadSettings}
          disabled={isPending}
          className="bg-white/10 hover:bg-white/20 text-white border-white/20 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`} />
          Refresh Status
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: API KEYS VAULT */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-teal-600" />
                <CardTitle className="text-base font-bold text-slate-900">
                  Kredensial API Key Terenkripsi
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-xs font-mono bg-teal-50 text-teal-700 border-teal-200">
                AES-256-GCM
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Kunci baru langsung menimpa konfigurasi env tanpa perlu restart server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            {/* GOOGLE GEMINI */}
            <div className="space-y-2 p-3.5 rounded-lg border border-slate-200 bg-slate-50/30">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Google Gemini API Key</span>
                  {config?.gemini.hasKey ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px] px-1.5 py-0 h-4">
                      Tersedia
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      Kosong
                    </Badge>
                  )}
                </label>
                <span className="text-[11px] font-mono text-slate-500">
                  {config?.gemini.maskedKey || "Belum ada kunci"}
                </span>
              </div>
              <div className="relative">
                <Input
                  type={showGeminiKey ? "text" : "password"}
                  placeholder="Masukkan API Key Gemini baru untuk mengganti..."
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  className="pr-20 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1"
                >
                  {showGeminiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTestConnection("google")}
                  disabled={testingGoogle}
                  className="text-xs h-7 px-2.5"
                >
                  <Zap className={`h-3 w-3 mr-1.5 ${testingGoogle ? "animate-spin text-amber-500" : "text-amber-500"}`} />
                  {testingGoogle ? "Menguji..." : "Test Koneksi Gemini"}
                </Button>
              </div>
            </div>

            {/* ZHIPU GLM / OPENAI-COMPATIBLE */}
            <div className="space-y-2 p-3.5 rounded-lg border border-slate-200 bg-slate-50/30">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Zhipu GLM API Key (OpenAI-Compatible)</span>
                  {config?.glm.hasKey ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px] px-1.5 py-0 h-4">
                      Tersedia
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      Kosong
                    </Badge>
                  )}
                </label>
                <span className="text-[11px] font-mono text-slate-500">
                  {config?.glm.maskedKey || "Belum ada kunci"}
                </span>
              </div>
              <div className="relative">
                <Input
                  type={showGlmKey ? "text" : "password"}
                  placeholder="Masukkan API Key GLM baru untuk mengganti..."
                  value={glmKeyInput}
                  onChange={(e) => setGlmKeyInput(e.target.value)}
                  className="pr-20 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowGlmKey(!showGlmKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1"
                >
                  {showGlmKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="space-y-1 pt-1">
                <label className="text-[11px] text-slate-600 font-medium">Base URL (Opsional/Default)</label>
                <Input
                  type="text"
                  placeholder="https://open.bigmodel.cn/api/paas/v4/"
                  value={glmBaseUrlInput}
                  onChange={(e) => setGlmBaseUrlInput(e.target.value)}
                  className="text-xs font-mono h-8"
                />
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTestConnection("openai-compatible")}
                  disabled={testingGlm}
                  className="text-xs h-7 px-2.5"
                >
                  <Zap className={`h-3 w-3 mr-1.5 ${testingGlm ? "animate-spin text-amber-500" : "text-amber-500"}`} />
                  {testingGlm ? "Menguji..." : "Test Koneksi GLM"}
                </Button>
              </div>
            </div>

            <Button
              className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs h-9"
              onClick={handleSaveApiKeys}
              disabled={isPending || (!geminiKeyInput.trim() && !glmKeyInput.trim() && glmBaseUrlInput === config?.glm.baseURL)}
            >
              Simpan & Terapkan Kunci Baru
            </Button>
          </CardContent>
        </Card>

        {/* CARD 1b: BATAS AI HARIAN */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-base font-bold text-slate-900">Batas AI Harian</CardTitle>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Jatah gabungan per guru per hari (chat AI, modul ajar, asesmen, generate soal).
              Reset otomatis pukul 00:00 WIB. Superadmin bebas limit. Isi 0 untuk menonaktifkan AI bagi non-superadmin.
            </p>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800">Jatah per guru per hari</label>
              <Input
                type="number"
                min={0}
                placeholder="20"
                value={dailyLimitInput}
                onChange={(e) => setDailyLimitInput(e.target.value)}
                className="text-xs h-8 w-32"
              />
            </div>
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium text-xs h-9"
              onClick={handleSaveDailyLimit}
              disabled={isPending || dailyLimitInput === String(config?.aiUsage?.dailyLimit ?? 20)}
            >
              Simpan Batas AI
            </Button>
          </CardContent>
        </Card>

        {/* CARD 2: AI STUDIO CONFIGURATION */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                <CardTitle className="text-base font-bold text-slate-900">
                  Model AI Studio (Generator Dokumen)
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-xs font-mono bg-indigo-50 text-indigo-700 border-indigo-200">
                Modul Ajar & Rubrik
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Menentukan model yang dipakai ketika guru membuat RPP, LKPD, bahan tayang, atau rubrik asesmen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Provider Utama</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAiStudioProvider("google")}
                  className={`p-2.5 rounded-lg border text-left text-xs font-medium flex items-center justify-between transition-colors ${
                    aiStudioProvider === "google"
                      ? "border-teal-600 bg-teal-50 text-teal-900 font-bold"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span>Google Gemini</span>
                  {aiStudioProvider === "google" && <Check className="h-4 w-4 text-teal-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => setAiStudioProvider("openai-compatible")}
                  className={`p-2.5 rounded-lg border text-left text-xs font-medium flex items-center justify-between transition-colors ${
                    aiStudioProvider === "openai-compatible"
                      ? "border-teal-600 bg-teal-50 text-teal-900 font-bold"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span>GLM / OpenAI-Comp</span>
                  {aiStudioProvider === "openai-compatible" && <Check className="h-4 w-4 text-teal-600" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Nama Model ID</label>
              <Input
                type="text"
                placeholder={aiStudioProvider === "google" ? "gemini-2.5-flash / gemini-1.5-pro" : "glm-4-plus / glm-4.5"}
                value={aiStudioModel}
                onChange={(e) => setAiStudioModel(e.target.value)}
                className="text-xs font-mono"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(aiStudioProvider === "google"
                  ? ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.7-flash"]
                  : ["glm-4-plus", "glm-4.5"]
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAiStudioModel(preset)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Kreativitas / Temperature:</span>
                <span className="font-mono text-teal-700 font-bold">{aiStudioTemperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={aiStudioTemperature}
                onChange={(e) => setAiStudioTemperature(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0.0 (Presisi/Ketat)</span>
                <span>0.7 (Rekomendasi)</span>
                <span>1.0 (Sangat Kreatif)</span>
              </div>
            </div>

            <div className="pt-2">
              <Button
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs h-9"
                onClick={handleSaveModels}
                disabled={isPending}
              >
                Simpan Konfigurasi Model
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CARD 3: KLASSA AGENT MULTI-MODEL */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-teal-700" />
              <CardTitle className="text-base font-bold text-slate-900">
                Konfigurasi Model KLASSA Agent (Chatbot Asisten Guru)
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-xs font-mono bg-teal-50 text-teal-700 border-teal-200">
              Autonomous Tools & Memory
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Tentukan model bawaan dan batasi opsi model apa saja yang boleh dipilih oleh guru di jendela chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* DEFAULT MODEL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Model Default (Otomatis Aktif untuk Guru)
              </label>
              <select
                value={agentDefaultModel}
                onChange={(e) => setAgentDefaultModel(e.target.value)}
                className="w-full border border-slate-200 rounded-md p-2 text-xs font-medium bg-white text-slate-800"
              >
                {KNOWN_AGENT_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
              </select>
            </div>

            {/* TEACHER OVERRIDE TOGGLE */}
            <div className="space-y-1.5 flex flex-col justify-center">
              <label className="text-xs font-semibold text-slate-700">Kebijakan Pemilihan Model</label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allowTeacherCustomModel}
                  onChange={(e) => setAllowTeacherCustomModel(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <span>Izinkan guru mengganti model sendiri di dropdown chat Agent</span>
              </label>
            </div>
          </div>

          {/* ALLOWED MODELS CHECKLIST */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">
              Daftar Model yang Diizinkan Tersedia untuk Guru:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {KNOWN_AGENT_MODELS.map((m) => {
                const checked = agentAllowedModels.includes(m.id);
                return (
                  <div
                    key={m.id}
                    onClick={() => toggleAllowedModel(m.id)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer select-none transition-all flex items-start gap-2.5 ${
                      checked
                        ? "border-teal-500 bg-teal-50/50 text-teal-950 font-medium"
                        : "border-slate-200 bg-slate-50/50 text-slate-500 hover:bg-slate-100/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-900">{m.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{m.id}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              className="bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs h-9 px-6"
              onClick={handleSaveModels}
              disabled={isPending}
            >
              Simpan Pengaturan KLASSA Agent
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
