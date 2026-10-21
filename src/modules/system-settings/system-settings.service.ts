import { prisma } from "@/lib/auth";
import { decryptSecret, encryptSecret, maskApiKey } from "@/lib/crypto";

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
  gemini: {
    hasKey: boolean;
    maskedKey: string;
  };
  glm: {
    hasKey: boolean;
    maskedKey: string;
    baseURL: string;
  };
  aiStudio: {
    provider: "google" | "openai-compatible";
    model: string;
    temperature: number;
  };
  agent: {
    defaultModel: string;
    allowedModels: string[];
    allowTeacherCustomModel: boolean;
  };
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

async function getRawSettingsMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedSettings && cachedSettings.expiresAt > now) {
    return cachedSettings.data;
  }

  try {
    const settings = await prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    cachedSettings = {
      expiresAt: now + CACHE_TTL_MS,
      data: map,
    };
    return map;
  } catch (err) {
    console.error("[system-settings] Failed to fetch settings from DB, falling back to empty:", err);
    return {};
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
export async function getEffectiveAiStudioConfig(): Promise<{
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
 * Gets redacted safe configuration for Super Admin UI
 */
export async function getAdminLlmConfigView(): Promise<SystemLlmConfig> {
  const map = await getRawSettingsMap();

  // Gemini Key
  let geminiRaw = "";
  if (map["llm_key_gemini"]) {
    geminiRaw = decryptSecret(map["llm_key_gemini"]) || "";
  } else {
    geminiRaw = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
  }

  // GLM Key
  let glmRaw = "";
  if (map["llm_key_glm"]) {
    glmRaw = decryptSecret(map["llm_key_glm"]) || "";
  } else {
    glmRaw = process.env.GLM_API_KEY || "";
  }

  const aiStudio = await getEffectiveAiStudioConfig();
  const agent = await getEffectiveAgentConfig();
  const glmBaseUrl = await getEffectiveGlmBaseUrl();

  return {
    gemini: {
      hasKey: Boolean(geminiRaw),
      maskedKey: maskApiKey(geminiRaw),
    },
    glm: {
      hasKey: Boolean(glmRaw),
      maskedKey: maskApiKey(glmRaw),
      baseURL: glmBaseUrl,
    },
    aiStudio: {
      provider: aiStudio.provider,
      model: aiStudio.model,
      temperature: aiStudio.temperature,
    },
    agent: {
      defaultModel: agent.defaultModel,
      allowedModels: agent.allowedModels,
      allowTeacherCustomModel: agent.allowTeacherCustomModel,
    },
  };
}
