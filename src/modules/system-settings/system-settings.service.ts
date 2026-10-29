import { prisma } from "@/lib/auth";
import { decryptSecret, maskApiKey } from "@/lib/crypto";
import {
  DEFAULT_COMPATIBLE_URL, GOOGLE_API_URL, LlmSettingsError, llmConfigSchema, scopedSettingKey,
  type LlmScope, type LlmRuntimeConfig, type LlmFeatureView,
} from "./llm-settings.schema";

export interface LlmProviderConfig {
  provider: "google" | "openai-compatible";
  apiKey: string; // Plaintext when in-memory runtime, encrypted in DB
  baseURL?: string;
}

export interface AiStudioSettings {
  provider: "google" | "openai-compatible";
  model: string;
  temperature?: number;
  apiKey?: string; // If overridden specifically for AI Studio
}

export interface AgentSettings {
  defaultModel: string;
  allowedModels: string[];
  allowTeacherCustomModel: boolean;
}

export interface SystemLlmConfig {
  features: Record<LlmScope, LlmFeatureView>;
  aiUsage: { dailyLimit: number };
}

// In-memory cache to prevent DB overhead on high-frequency generation/chat requests
let cachedSettings: {
  expiresAt: number;
  data: Record<string, string>;
} | null = null;

const CACHE_TTL_MS = 60_000; // 60 seconds

export function invalidateLlmSettingsCache() {
  cachedSettings = null;
}

async function getRawSettingsMap(fresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!fresh && cachedSettings && cachedSettings.expiresAt > now) {
    return cachedSettings.data;
  }

  try {
    const settings = await prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    if (Array.isArray(settings)) {
      for (const s of settings) {
        map[s.key] = s.value;
      }
    }
    cachedSettings = {
      expiresAt: now + CACHE_TTL_MS,
      data: map,
    };
    return map;
  } catch (err) {
    if (process.env.NODE_ENV === "test") {
      return {};
    }
    // Never turn a DB outage into an implicit return to shared credentials.
    throw new LlmSettingsError("Tidak dapat memuat konfigurasi LLM. Coba lagi nanti.");
  }
}

/**
 * Returns effective Gemini API Key: DB encrypted setting first, then env variable.
 */
export async function getEffectiveGeminiKey(): Promise<string> {
  const map = await getRawSettingsMap();
  const dbEncrypted = map["llm_key_gemini"];
  if (dbEncrypted) {
    const decrypted = decryptSecret(dbEncrypted);
    if (decrypted && decrypted.trim()) return decrypted.trim();
  }
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
}

/**
 * Returns effective GLM API Key: DB encrypted setting first, then env variable.
 */
export async function getEffectiveGlmKey(): Promise<string> {
  const map = await getRawSettingsMap();
  const dbEncrypted = map["llm_key_glm"];
  if (dbEncrypted) {
    const decrypted = decryptSecret(dbEncrypted);
    if (decrypted && decrypted.trim()) return decrypted.trim();
  }
  return process.env.GLM_API_KEY || "";
}

/**
 * Returns effective GLM Base URL: DB setting first, then env variable.
 */
export async function getEffectiveGlmBaseUrl(): Promise<string> {
  const map = await getRawSettingsMap();
  return map["llm_base_url_glm"] || process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/";
}

/**
 * Returns effective AI Studio configuration (Modul Ajar, Asesmen, Rubrik, dll)
 */
async function getLegacyAiStudioConfig(): Promise<{
  provider: "google" | "openai-compatible";
  model: string;
  temperature: number;
  apiKey: string;
}> {
  const map = await getRawSettingsMap();
  let provider: "google" | "openai-compatible" = "google";
  let model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  let temperature = 0.7;

  if (map["llm_ai_studio"]) {
    try {
      const parsed = JSON.parse(map["llm_ai_studio"]);
      if (parsed.provider) provider = parsed.provider;
      if (parsed.model) model = parsed.model;
      if (typeof parsed.temperature === "number") temperature = parsed.temperature;
    } catch {
      // Ignore JSON parse error, use defaults
    }
  }

  const apiKey = provider === "google" ? await getEffectiveGeminiKey() : await getEffectiveGlmKey();
  return { provider, model, temperature, apiKey };
}

/**
 * Returns effective KLASSA Agent configuration (Chatbot, Task Runner)
 */
export async function getEffectiveAgentConfig(): Promise<{
  defaultModel: string;
  allowedModels: string[];
  allowTeacherCustomModel: boolean;
}> {
  const map = await getRawSettingsMap();
  let defaultModel = process.env.AGENT_DEFAULT_MODEL || process.env.GLM_MODEL || "glm-4-plus";
  let allowedModels = [
    "glm-4-plus",
    "glm-4.5",
    "gemini-3.5-flash",
    "gemini-3.7-flash",
    "hermes-local",
  ];
  let allowTeacherCustomModel = true;

  if (map["llm_agent"]) {
    try {
      const parsed = JSON.parse(map["llm_agent"]);
      if (parsed.defaultModel) defaultModel = parsed.defaultModel;
      if (Array.isArray(parsed.allowedModels) && parsed.allowedModels.length > 0) {
        allowedModels = parsed.allowedModels;
      }
      if (typeof parsed.allowTeacherCustomModel === "boolean") {
        allowTeacherCustomModel = parsed.allowTeacherCustomModel;
      }
    } catch {
      // Ignore JSON parse error
    }
  }

  return { defaultModel, allowedModels, allowTeacherCustomModel };
}

/**
 * Returns effective daily AI usage limit per teacher (gabungan: Agent Chat + AI Studio + Quiz AI).
 * Prioritas: DB setting "ai_daily_limit" > env AI_DAILY_LIMIT > default 20.
 * 0 = AI nonaktif untuk non-superadmin. Angka negatif/invalid diabaikan (pakai default).
 */
export async function getEffectiveAiDailyLimit(): Promise<number> {
  const map = await getRawSettingsMap();
  const raw = map["ai_daily_limit"] ?? process.env.AI_DAILY_LIMIT ?? "";
  const parsed = parseInt(String(raw).trim(), 10);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return 20;
}

/**
 * Gets redacted safe configuration for Super Admin UI
 */
export async function getAdminLlmConfigView(): Promise<SystemLlmConfig> {
  await getRawSettingsMap(true);
  return {
    features: {
      "ai-studio": toLlmFeatureView(await getScopedLlmConfig("ai-studio")),
      agent: toLlmFeatureView(await getScopedLlmConfig("agent")),
    },
    aiUsage: { dailyLimit: await getEffectiveAiDailyLimit() },
  };
}

export function toLlmFeatureView(runtime: LlmRuntimeConfig): LlmFeatureView {
  const { apiKey, ...config } = runtime;
  return { ...config, hasKey: Boolean(apiKey), maskedKey: maskApiKey(apiKey) };
}

/** Strict decoder: an existing dedicated record must never fall through to legacy. */
export function decodeScopedLlmRecord(value: string): LlmRuntimeConfig {
  try {
    const record = JSON.parse(value);
    const config = llmConfigSchema.parse(record.config);
    if (typeof record.encryptedKey !== "string" || !record.encryptedKey.startsWith("enc:v1:")) throw new Error();
    const apiKey = decryptSecret(record.encryptedKey);
    if (!apiKey?.trim()) throw new Error();
    return { ...config, apiKey, source: "database" };
  } catch {
    throw new LlmSettingsError("Konfigurasi LLM tersimpan tidak valid atau key tidak dapat dibuka. Simpan ulang dengan key baru.");
  }
}

export async function getScopedLlmConfig(scope: LlmScope, fresh = false): Promise<LlmRuntimeConfig> {
  const map = await getRawSettingsMap(fresh);
  const stored = map[scopedSettingKey(scope)];
  if (stored !== undefined) return decodeScopedLlmRecord(stored);

  const prefix = scope === "ai-studio" ? "AI_STUDIO_LLM_" : "KLASSA_AGENT_LLM_";
  if (["PROVIDER", "BASE_URL", "MODEL", "API_KEY"].some((key) => process.env[prefix + key] !== undefined)) {
    try {
      const config = llmConfigSchema.parse({
        provider: process.env[prefix + "PROVIDER"] || "openai-compatible",
        baseURL: process.env[prefix + "BASE_URL"], model: process.env[prefix + "MODEL"],
      });
      const apiKey = process.env[prefix + "API_KEY"]?.trim();
      if (!apiKey) throw new Error();
      return { ...config, apiKey, source: "environment" };
    } catch {
      throw new LlmSettingsError("Environment LLM khusus fitur belum lengkap. Isi provider, URL, model, dan API key.");
    }
  }

  if (scope === "ai-studio") {
    const legacy = await getLegacyAiStudioConfig();
    return {
      ...legacy, baseURL: legacy.provider === "google" ? GOOGLE_API_URL : await getEffectiveGlmBaseUrl(),
      allowedModels: [legacy.model], allowTeacherCustomModel: false,
      source: legacy.apiKey ? "legacy" : "missing",
    };
  }
  const agent = await getEffectiveAgentConfig();
  const provider = agent.defaultModel.startsWith("gemini") ? "google" : "openai-compatible";
  const local = /hermes|ollama|vllm|local/.test(agent.defaultModel);
  const apiKey = local ? process.env.AGENT_LOCAL_LLM_API_KEY || "local-no-key-required"
    : provider === "google" ? await getEffectiveGeminiKey() : await getEffectiveGlmKey();
  return {
    provider, model: agent.defaultModel, temperature: 0.7,
    baseURL: local ? process.env.AGENT_LOCAL_LLM_BASE_URL || "http://127.0.0.1:11434/v1"
      : provider === "google" ? GOOGLE_API_URL : await getEffectiveGlmBaseUrl() || DEFAULT_COMPATIBLE_URL,
    apiKey, allowedModels: agent.allowedModels, allowTeacherCustomModel: agent.allowTeacherCustomModel,
    source: apiKey ? "legacy" : "missing",
  };
}

export async function getEffectiveAiStudioConfig(): Promise<LlmRuntimeConfig> {
  const config = await getScopedLlmConfig("ai-studio");
  if (!config.apiKey) throw new LlmSettingsError("API key AI Studio belum dikonfigurasi.");
  return config;
}
