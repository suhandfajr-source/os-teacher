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
  Bot,
  RefreshCw,
  Eye,
  EyeOff,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
  Copy,
  Gauge,
} from "lucide-react";
import {
  getLlmSettingsAdminAction,
  saveLlmFeatureAdminAction,
  copyLegacyLlmFeatureAdminAction,
  testLlmConnectionAdminAction,
  updateAiUsageLimitAdminAction,
} from "@/modules/system-settings/system-settings.actions";
import type { SystemLlmConfig } from "@/modules/system-settings/system-settings.service";
import type { LlmFeatureView, LlmScope } from "@/modules/system-settings/llm-settings.schema";
import { GOOGLE_API_URL, DEFAULT_COMPATIBLE_URL } from "@/modules/system-settings/llm-settings.schema";

interface FeatureDraft {
  provider: "google" | "openai-compatible";
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
  allowedModels: string[];
  allowTeacherCustomModel: boolean;
}

const KNOWN_PRESETS: Record<LlmScope, Array<{ label: string; model: string; provider: "google" | "openai-compatible"; baseURL: string }>> = {
  "ai-studio": [
    { label: "Google Gemini 2.5 Flash (Resmi)", model: "gemini-2.5-flash", provider: "google", baseURL: GOOGLE_API_URL },
    { label: "Google Gemini 3.5 Flash (Resmi)", model: "gemini-3.5-flash", provider: "google", baseURL: GOOGLE_API_URL },
    { label: "Zhipu GLM-4 Plus (OpenAI Compatible)", model: "glm-4-plus", provider: "openai-compatible", baseURL: DEFAULT_COMPATIBLE_URL },
  ],
  agent: [
    { label: "Zhipu GLM-4 Plus (Rekomendasi Agent)", model: "glm-4-plus", provider: "openai-compatible", baseURL: DEFAULT_COMPATIBLE_URL },
    { label: "Zhipu GLM-4.5 (Penalaran Agent)", model: "glm-4.5", provider: "openai-compatible", baseURL: DEFAULT_COMPATIBLE_URL },
    { label: "Google Gemini 3.7 Flash (Tools Support)", model: "gemini-3.7-flash", provider: "google", baseURL: GOOGLE_API_URL },
    { label: "Local vLLM / Ollama (Port 11434)", model: "hermes-local", provider: "openai-compatible", baseURL: "http://127.0.0.1:11434/v1" },
  ],
};

function initialDraftFromView(view?: LlmFeatureView, scope: LlmScope = "ai-studio"): FeatureDraft {
  const fallbackPreset = KNOWN_PRESETS[scope][0];
  return {
    provider: view?.provider || fallbackPreset.provider,
    baseURL: view?.baseURL || fallbackPreset.baseURL,
    apiKey: "",
    model: view?.model || fallbackPreset.model,
    temperature: view?.temperature ?? 0.7,
    allowedModels: view?.allowedModels?.length ? view.allowedModels : [view?.model || fallbackPreset.model],
    allowTeacherCustomModel: view?.allowTeacherCustomModel ?? false,
  };
}

export function KlassaLlmSettingsTab() {
  const [config, setConfig] = useState<SystemLlmConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyLimitInput, setDailyLimitInput] = useState("20");

  const [studioDraft, setStudioDraft] = useState<FeatureDraft>(initialDraftFromView(undefined, "ai-studio"));
  const [agentDraft, setAgentDraft] = useState<FeatureDraft>(initialDraftFromView(undefined, "agent"));

  const [showStudioKey, setShowStudioKey] = useState(false);
  const [showAgentKey, setShowAgentKey] = useState(false);
  const [showStudioAdvanced, setShowStudioAdvanced] = useState(false);
  const [showAgentAdvanced, setShowAgentAdvanced] = useState(false);

  const [activeTab, setActiveTab] = useState<LlmScope>("ai-studio");

  const [testingStudio, setTestingStudio] = useState(false);
  const [testingAgent, setTestingAgent] = useState(false);
  const [savingStudio, setSavingStudio] = useState(false);
  const [savingAgent, setSavingAgent] = useState(false);
  const [copyingScope, setCopyingScope] = useState<LlmScope | null>(null);

  const [isPending, startTransition] = useTransition();

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await getLlmSettingsAdminAction();
      if (res.success && res.data) {
        setConfig(res.data);
        setDailyLimitInput(String(res.data.aiUsage.dailyLimit ?? 20));
        setStudioDraft(initialDraftFromView(res.data.features["ai-studio"], "ai-studio"));
        setAgentDraft(initialDraftFromView(res.data.features.agent, "agent"));
      } else {
        toast.error(res.error || "Gagal memuat konfigurasi LLM.");
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan saat memuat konfigurasi LLM.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSaveFeature = async (scope: LlmScope) => {
    const isStudio = scope === "ai-studio";
    const draft = isStudio ? studioDraft : agentDraft;
    const view = config?.features[scope];

    if (!draft.baseURL.trim()) {
      toast.error("API URL wajib diisi.");
      return;
    }
    if (!draft.apiKey.trim() && !view?.hasKey) {
      toast.error("API Key wajib diisi untuk konfigurasi baru.");
      return;
    }
    if (!draft.model.trim()) {
      toast.error("Model ID wajib ditentukan di Pengaturan Lanjutan.");
      return;
    }

    if (isStudio) setSavingStudio(true);
    else setSavingAgent(true);

    try {
      const res = await saveLlmFeatureAdminAction({
        scope,
        config: {
          provider: draft.provider,
          baseURL: draft.baseURL,
          model: draft.model,
          temperature: draft.temperature,
          allowedModels: draft.allowedModels,
          allowTeacherCustomModel: draft.allowTeacherCustomModel,
        },
        apiKey: draft.apiKey.trim() || undefined,
      });

      if (res.success && res.data) {
        toast.success(`Pengaturan ${isStudio ? "AI Studio" : "Klassa Agent"} berhasil disimpan.`);
        setConfig((prev) =>
          prev
            ? {
                ...prev,
                features: {
                  ...prev.features,
                  [scope]: res.data!,
                },
              }
            : null
        );
        if (isStudio) {
          setStudioDraft((d) => ({ ...d, apiKey: "" }));
        } else {
          setAgentDraft((d) => ({ ...d, apiKey: "" }));
        }
      } else {
        toast.error(res.error || "Gagal menyimpan konfigurasi.");
      }
    } catch {
      toast.error("Terjadi kegagalan saat menyimpan konfigurasi.");
    } finally {
      if (isStudio) setSavingStudio(false);
      else setSavingAgent(false);
    }
  };

  const handleTestConnection = async (scope: LlmScope) => {
    const isStudio = scope === "ai-studio";
    const draft = isStudio ? studioDraft : agentDraft;
    const view = config?.features[scope];

    if (!draft.baseURL.trim()) {
      toast.error("API URL harus diisi untuk pengujian.");
      return;
    }
    if (!draft.apiKey.trim() && !view?.hasKey) {
      toast.error("API Key belum tersedia. Isi API Key sebelum mengetes.");
      return;
    }

    if (isStudio) setTestingStudio(true);
    else setTestingAgent(true);

    try {
      const res = await testLlmConnectionAdminAction({
        scope,
        config: {
          provider: draft.provider,
          baseURL: draft.baseURL,
          model: draft.model,
          temperature: draft.temperature,
          allowedModels: draft.allowedModels,
          allowTeacherCustomModel: draft.allowTeacherCustomModel,
        },
        apiKey: draft.apiKey.trim() || undefined,
      });

      if (res.success) {
        toast.success(`${res.message || "Tes berhasil"} (${res.latencyMs}ms)`);
      } else {
        toast.error(res.error || "Pengujian koneksi gagal.");
      }
    } catch {
      toast.error("Gagal menjalankan pengujian koneksi LLM.");
    } finally {
      if (isStudio) setTestingStudio(false);
      else setTestingAgent(false);
    }
  };

  const handleCopyLegacy = async (scope: LlmScope) => {
    setCopyingScope(scope);
    try {
      const res = await copyLegacyLlmFeatureAdminAction(scope);
      if (res.success && res.data) {
        toast.success(`Konfigurasi lama berhasil disalin ke ${scope === "ai-studio" ? "AI Studio" : "Klassa Agent"}.`);
        setConfig((prev) =>
          prev
            ? {
                ...prev,
                features: {
                  ...prev.features,
                  [scope]: res.data!,
                },
              }
            : null
        );
        if (scope === "ai-studio") {
          setStudioDraft(initialDraftFromView(res.data, "ai-studio"));
        } else {
          setAgentDraft(initialDraftFromView(res.data, "agent"));
        }
      } else {
        toast.error(res.error || "Gagal menyalin konfigurasi lama.");
      }
    } catch {
      toast.error("Terjadi kegagalan saat menyalin konfigurasi lama.");
    } finally {
      setCopyingScope(null);
    }
  };

  const handleSaveDailyLimit = () => {
    startTransition(async () => {
      const val = parseInt(dailyLimitInput, 10);
      if (isNaN(val) || val < 0) {
        toast.error("Batas harian harus berupa angka positif atau 0.");
        return;
      }
      try {
        const res = await updateAiUsageLimitAdminAction({ dailyLimit: val });
        if (res.success) {
          toast.success("Batas pemakaian AI per hari berhasil diperbarui.");
        } else {
          toast.error(res.error || "Gagal memperbarui batas kuota.");
        }
      } catch {
        toast.error("Terjadi kegagalan saat memperbarui batas kuota.");
      }
    });
  };

  const sourceBadge = (source: string | undefined) => {
    switch (source) {
      case "database":
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">Mandiri (Tersimpan di DB)</Badge>;
      case "environment":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-300 dark:border-blue-800">Mandiri (.env Server)</Badge>;
      case "legacy":
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800">Mewarisi Pengaturan Lama</Badge>;
      default:
        return <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-300 dark:border-rose-800">Belum Dikonfigurasi</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <RefreshCw className="h-6 w-6 animate-spin mb-2 text-teal-600" />
        <span className="text-sm">Memuat pengaturan LLM...</span>
      </div>
    );
  }

  const studioView = config?.features["ai-studio"];
  const agentView = config?.features.agent;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Pengaturan Independen Model AI & Kredensial
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Konfigurasikan AI Studio dan Klassa Agent secara terpisah dengan API URL dan API Key masing-masing.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadConfig}
          disabled={loading || isPending}
          className="text-xs h-8 gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Segarkan
        </Button>
      </div>

      {/* FEATURE SCOPE SWITCHER */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("ai-studio")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "ai-studio"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-t"
              : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          AI Studio (Modul & Materi)
          {sourceBadge(studioView?.source)}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("agent")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "agent"
              ? "border-teal-600 text-teal-600 dark:text-teal-400 dark:border-teal-400 bg-teal-50/50 dark:bg-teal-950/20 rounded-t"
              : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Bot className="h-4 w-4" />
          Klassa Agent (Chatbot Asisten)
          {sourceBadge(agentView?.source)}
        </button>
      </div>

      {/* TAB CONTENT: AI STUDIO */}
      {activeTab === "ai-studio" && (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Konfigurasi LLM AI Studio
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {studioView?.source === "legacy" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 gap-1 border-amber-300 text-amber-800 dark:text-amber-300"
                    onClick={() => handleCopyLegacy("ai-studio")}
                    disabled={copyingScope === "ai-studio"}
                  >
                    <Copy className="h-3 w-3" />
                    Salin Konfigurasi Lama
                  </Button>
                )}
              </div>
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Digunakan saat guru men-generate materi di AI Studio. Tidak mempengaruhi Klassa Agent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* PRIMARY: API URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                API URL (Endpoint LLM)
              </label>
              <Input
                value={studioDraft.baseURL}
                onChange={(e) => setStudioDraft({ ...studioDraft, baseURL: e.target.value })}
                placeholder="https://generativelanguage.googleapis.com/v1beta atau endpoint kompatibel OpenAI"
                className="text-xs font-mono h-9"
              />
              <p className="text-[11px] text-slate-500">
                Gunakan endpoint OpenAI-compatible jika menggunakan reverse proxy, Cloudflare AI Gateway, atau model mandiri.
              </p>
            </div>

            {/* PRIMARY: API KEY */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>API Key</span>
                {studioView?.hasKey && (
                  <span className="text-[11px] text-slate-500 font-mono font-normal">
                    Tersimpan: {studioView.maskedKey}
                  </span>
                )}
              </label>
              <div className="relative">
                <Input
                  type={showStudioKey ? "text" : "password"}
                  value={studioDraft.apiKey}
                  onChange={(e) => setStudioDraft({ ...studioDraft, apiKey: e.target.value })}
                  placeholder={
                    studioView?.hasKey
                      ? "Biarkan kosong jika tidak ingin mengubah API Key yang sudah tersimpan"
                      : "Masukkan API Key baru..."
                  }
                  className="pr-10 text-xs font-mono h-9"
                />
                <button
                  type="button"
                  onClick={() => setShowStudioKey(!showStudioKey)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showStudioKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* PRESETS BUTTONS */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[11px] text-slate-500 self-center mr-1">Preset cepat:</span>
              {KNOWN_PRESETS["ai-studio"].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setStudioDraft({
                      ...studioDraft,
                      provider: preset.provider,
                      baseURL: preset.baseURL,
                      model: preset.model,
                    })
                  }
                  className="text-[10px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* ADVANCED SETTINGS COLLAPSIBLE */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-md p-3 bg-slate-50/50 dark:bg-slate-900/30">
              <button
                type="button"
                onClick={() => setShowStudioAdvanced(!showStudioAdvanced)}
                className="flex items-center justify-between w-full text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                <span>Pengaturan Lanjutan (Provider, Model ID, Temperatur)</span>
                {showStudioAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showStudioAdvanced && (
                <div className="space-y-4 pt-3 mt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Protokol Provider
                      </label>
                      <select
                        value={studioDraft.provider}
                        onChange={(e) =>
                          setStudioDraft({
                            ...studioDraft,
                            provider: e.target.value as "google" | "openai-compatible",
                            baseURL:
                              e.target.value === "google"
                                ? GOOGLE_API_URL
                                : studioDraft.baseURL === GOOGLE_API_URL
                                ? DEFAULT_COMPATIBLE_URL
                                : studioDraft.baseURL,
                          })
                        }
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-md p-2 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                      >
                        <option value="google">Google Generative AI (Native SDK)</option>
                        <option value="openai-compatible">OpenAI-Compatible Endpoint</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Model ID
                      </label>
                      <Input
                        value={studioDraft.model}
                        onChange={(e) => setStudioDraft({ ...studioDraft, model: e.target.value })}
                        placeholder="gemini-2.5-flash, glm-4-plus, deepseek-chat, dll."
                        className="text-xs font-mono h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex justify-between">
                      <span>Temperatur: {studioDraft.temperature}</span>
                      <span className="text-[10px] text-slate-400">0.0 (Presisi) - 1.0 (Kreatif)</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={studioDraft.temperature}
                      onChange={(e) => setStudioDraft({ ...studioDraft, temperature: parseFloat(e.target.value) })}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ACTIONS */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTestConnection("ai-studio")}
                disabled={testingStudio || savingStudio}
                className="w-full sm:w-auto text-xs h-9 gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
              >
                {testingStudio ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                Tes Koneksi AI Studio
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => handleSaveFeature("ai-studio")}
                disabled={testingStudio || savingStudio}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 px-6 font-medium"
              >
                {savingStudio ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Simpan Konfigurasi AI Studio
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB CONTENT: KLASSA AGENT */}
      {activeTab === "agent" && (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Konfigurasi LLM Klassa Agent
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {agentView?.source === "legacy" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 gap-1 border-amber-300 text-amber-800 dark:text-amber-300"
                    onClick={() => handleCopyLegacy("agent")}
                    disabled={copyingScope === "agent"}
                  >
                    <Copy className="h-3 w-3" />
                    Salin Konfigurasi Lama
                  </Button>
                )}
              </div>
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Digunakan khusus oleh chatbot interaktif Klassa Agent dengan dukungan tool calling dan teacher memory.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* PRIMARY: API URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                API URL (Endpoint Agent)
              </label>
              <Input
                value={agentDraft.baseURL}
                onChange={(e) => setAgentDraft({ ...agentDraft, baseURL: e.target.value })}
                placeholder="https://open.bigmodel.cn/api/paas/v4 atau endpoint OpenAI compatible"
                className="text-xs font-mono h-9"
              />
              <p className="text-[11px] text-slate-500">
                Pastikan endpoint mendukung pemanggilan tools / function calling agar Agent dapat membaca konteks siswa & kelas.
              </p>
            </div>

            {/* PRIMARY: API KEY */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>API Key</span>
                {agentView?.hasKey && (
                  <span className="text-[11px] text-slate-500 font-mono font-normal">
                    Tersimpan: {agentView.maskedKey}
                  </span>
                )}
              </label>
              <div className="relative">
                <Input
                  type={showAgentKey ? "text" : "password"}
                  value={agentDraft.apiKey}
                  onChange={(e) => setAgentDraft({ ...agentDraft, apiKey: e.target.value })}
                  placeholder={
                    agentView?.hasKey
                      ? "Biarkan kosong jika tidak ingin mengubah API Key yang sudah tersimpan"
                      : "Masukkan API Key Agent baru..."
                  }
                  className="pr-10 text-xs font-mono h-9"
                />
                <button
                  type="button"
                  onClick={() => setShowAgentKey(!showAgentKey)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showAgentKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* PRESETS BUTTONS */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[11px] text-slate-500 self-center mr-1">Preset cepat:</span>
              {KNOWN_PRESETS.agent.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setAgentDraft({
                      ...agentDraft,
                      provider: preset.provider,
                      baseURL: preset.baseURL,
                      model: preset.model,
                    })
                  }
                  className="text-[10px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* ADVANCED SETTINGS COLLAPSIBLE */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-md p-3 bg-slate-50/50 dark:bg-slate-900/30">
              <button
                type="button"
                onClick={() => setShowAgentAdvanced(!showAgentAdvanced)}
                className="flex items-center justify-between w-full text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                <span>Pengaturan Lanjutan (Provider, Model Default, Opsi Guru)</span>
                {showAgentAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showAgentAdvanced && (
                <div className="space-y-4 pt-3 mt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Protokol Provider
                      </label>
                      <select
                        value={agentDraft.provider}
                        onChange={(e) =>
                          setAgentDraft({
                            ...agentDraft,
                            provider: e.target.value as "google" | "openai-compatible",
                            baseURL:
                              e.target.value === "google"
                                ? GOOGLE_API_URL
                                : agentDraft.baseURL === GOOGLE_API_URL
                                ? DEFAULT_COMPATIBLE_URL
                                : agentDraft.baseURL,
                          })
                        }
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-md p-2 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                      >
                        <option value="openai-compatible">OpenAI-Compatible (Rekomendasi Agent)</option>
                        <option value="google">Google Generative AI (Native SDK)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Model ID Default
                      </label>
                      <Input
                        value={agentDraft.model}
                        onChange={(e) => setAgentDraft({ ...agentDraft, model: e.target.value })}
                        placeholder="glm-4-plus, gemini-3.7-flash, qwen-2.5-72b, dll."
                        className="text-xs font-mono h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={agentDraft.allowTeacherCustomModel}
                        onChange={(e) =>
                          setAgentDraft({ ...agentDraft, allowTeacherCustomModel: e.target.checked })
                        }
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                      />
                      <span className="font-medium">
                        Izinkan guru memilih model alternatif di antarmuka chat Agent
                      </span>
                    </label>

                    {agentDraft.allowTeacherCustomModel && (
                      <div className="space-y-1.5 pl-6">
                        <label className="text-[11px] text-slate-500">
                          Daftar Model yang Diizinkan (pisahkan dengan koma):
                        </label>
                        <Input
                          value={agentDraft.allowedModels.join(", ")}
                          onChange={(e) =>
                            setAgentDraft({
                              ...agentDraft,
                              allowedModels: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="glm-4-plus, glm-4.5, gemini-3.7-flash"
                          className="text-xs font-mono h-8"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ACTIONS */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTestConnection("agent")}
                disabled={testingAgent || savingAgent}
                className="w-full sm:w-auto text-xs h-9 gap-1.5 border-teal-200 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300 dark:hover:bg-teal-950"
              >
                {testingAgent ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                Tes Koneksi & Tools Agent
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => handleSaveFeature("agent")}
                disabled={testingAgent || savingAgent}
                className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white text-xs h-9 px-6 font-medium"
              >
                {savingAgent ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Simpan Konfigurasi Klassa Agent
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CARD 3: KUOTA PENGGUNAAN HARIAN (GLOBAL) */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              Batas Kuota Pemakaian Harian AI
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Batas total pemanggilan AI harian (AI Studio, Klassa Agent, Pembuat Soal) per guru. Kuota direset otomatis setiap pukul 00:00 WIB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="w-full sm:w-48">
              <Input
                type="number"
                min={0}
                max={500}
                value={dailyLimitInput}
                onChange={(e) => setDailyLimitInput(e.target.value)}
                placeholder="20"
                className="text-xs h-9"
              />
            </div>
            <span className="text-xs text-slate-500">
              panggilan per guru / hari (isi <strong>0</strong> untuk tanpa batas).
            </span>
            <Button
              size="sm"
              onClick={handleSaveDailyLimit}
              disabled={isPending}
              className="text-xs h-9 ml-auto bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-slate-100 dark:text-slate-900 text-white font-medium"
            >
              Simpan Batas Kuota
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
