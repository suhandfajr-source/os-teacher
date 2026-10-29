import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { LanguageModel } from "ai";
import { DEFAULT_AGENT_MODEL } from "./agent.config";
import {
  getEffectiveAgentConfig,
  getScopedLlmConfig,
  getEffectiveGeminiKey,
  getEffectiveGlmKey,
  getEffectiveGlmBaseUrl,
} from "@/modules/system-settings/system-settings.service";

import { createLlmEndpointFetch } from "@/modules/system-settings/llm-endpoint.server";

/** Tipe struktural minimal untuk mendispatch pemanggilan model (spec v2-v4 kompatibel). */
interface DispatchableLanguageModel {
  readonly specificationVersion: string;
  readonly provider: string;
  readonly modelId: string;
  doGenerate(options: unknown): Promise<unknown>;
  doStream(options: unknown): Promise<unknown>;
}

/** Tag penyedia untuk logika failover cross-provider (GLM ⇄ Gemini). */
type ProviderTag = "glm" | "google" | "local";

export interface ChainEntry {
  readonly modelId: string;
  readonly provider: ProviderTag;
  readonly model: LanguageModel;
}

const GOOGLE_FALLBACK_CHAIN = ["gemini-3.7-flash", "gemini-flash-latest"];
const GLM_FALLBACK_CHAIN = ["glm-4.5", "glm-4-plus"];

const RETRYABLE_ERROR_PATTERNS: RegExp[] = [
  /50[23]/i,
  /429/,
  /high demand/i,
  /overloaded/i,
  /unavailable/i,
  /resource_exhausted/i,
  /quota/i,
  /rate.?limit/i,
  /timeout|etimedout/i,
  /deadline_exceeded/i,
  /aborted?/i,
  /econnreset|econnrefused|fetch failed|network/i,
  /internal error/i,
  /try again/i,
];

const STREAM_START_DEADLINE_MS = Number(process.env.AGENT_STREAM_START_DEADLINE_MS || 18_000);
const GENERATE_DEADLINE_MS = Number(process.env.AGENT_GENERATE_DEADLINE_MS || 30_000);

async function withDeadline<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`DEADLINE_EXCEEDED: model "${label}" tidak merespons dalam ${ms}ms`)),
      ms
    );
  });
  p.catch(() => {});
  try {
    return await Promise.race([p, guard]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isRetryableProviderError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (!msg) return true;
  if (/api key|permission|invalid request|not found|unsupported/i.test(msg)) return false;
  return RETRYABLE_ERROR_PATTERNS.some((re) => re.test(msg));
}

/**
 * Error kredensial/otorisasi PROVIDER tertentu. Bukan error prompt/param —
 * sehingga layak dicoba ke PROVIDER BERBEDA (kunci GLM invalid ≠ kunci Gemini invalid).
 */
function isAuthLikeProviderError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /api key|permission|unauthorized|forbidden/i.test(msg);
}

/**
 * Rantai failover antar-model DAN antar-provider (Story #5a).
 *
 - Error retryable (503/429/network/deadline) → lanjut entri berikutnya.
 - Error auth-like (api key/permission) → lompat HANYA jika entri berikutnya
   berbeda provider (mencoba model lain di provider yang rusak percuma).
 - Error non-retryable lain (invalid request/not found/unsupported) → gagal cepat.
 */
export function createFallbackModelChain(entries: ChainEntry[]): LanguageModel {
  if (entries.length === 1) return entries[0].model;
  const chain = entries.map((e) => ({
    modelId: e.modelId,
    provider: e.provider,
    dlm: e.model as unknown as DispatchableLanguageModel,
  }));
  let idx = 0;
  const active = () => chain[Math.min(idx, chain.length - 1)];
  const attempt = async <T>(op: (m: DispatchableLanguageModel) => Promise<T>): Promise<T> => {
    let lastErr: unknown;
    while (idx < chain.length) {
      const entry = chain[idx];
      try {
        return await op(entry.dlm);
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const fail = (reason: string): never => {
          console.warn(
            `[agent-router] Model "${entry.modelId}" gagal (${msg.slice(0, 120)}…) — ${reason}`
          );
          throw err;
        };

        // 1) Error retryable (503/429/network/deadline) → entri berikutnya apa adanya.
        if (isRetryableProviderError(err)) {
          if (idx + 1 >= chain.length) return fail("tidak ada fallback tersisa");
          console.warn(
            `[agent-router] Model "${entry.modelId}" gagal (${msg.slice(0, 120)}…) — beralih ke "${chain[idx + 1].modelId}"${chain[idx + 1].provider !== entry.provider ? " [cross-provider]" : ""}`
          );
          idx++;
          continue;
        }

        // 2) Error auth-like (api key/permission provider) → skip SEMUA sisa model
        //    provider yang sama (percuma), lompat ke provider berbeda terdekat.
        if (isAuthLikeProviderError(err)) {
          const jumpIdx = chain.findIndex((e, i) => i > idx && e.provider !== entry.provider);
          if (jumpIdx === -1) return fail("tidak ada provider cadangan tersedia");
          console.warn(
            `[agent-router] Kredensial provider "${entry.provider}" bermasalah — lompat ke "${chain[jumpIdx].modelId}" [cross-provider]`
          );
          idx = jumpIdx;
          continue;
        }

        // 3) Non-retryable lain (invalid request/not found/unsupported) → gagal cepat.
        throw err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  };
  const wrapper: DispatchableLanguageModel = {
    get specificationVersion() {
      return active().dlm.specificationVersion;
    },
    get provider() {
      return active().dlm.provider;
    },
    get modelId() {
      return active().modelId;
    },
    doGenerate: (options) =>
      attempt((m) => withDeadline(m.doGenerate(options), GENERATE_DEADLINE_MS, m.modelId) as Promise<unknown>),
    doStream: (options) =>
      attempt((m) => withDeadline(m.doStream(options), STREAM_START_DEADLINE_MS, m.modelId) as Promise<unknown>),
  };
  return wrapper as unknown as LanguageModel;
}

function dedupeChain(entries: ChainEntry[]): ChainEntry[] {
  const seen = new Set<string>();
  const out: ChainEntry[] = [];
  for (const e of entries) {
    if (!seen.has(e.modelId)) {
      seen.add(e.modelId);
      out.push(e);
    }
  }
  return out;
}

function buildGlmEntries(apiKey: string, baseURL: string, modelIds: string[]): ChainEntry[] {
  if (!apiKey) return [];
  const glmClient = createOpenAICompatible({ name: "glm", baseURL, apiKey });
  return modelIds.map((id) => ({ modelId: id, provider: "glm" as const, model: glmClient(id) }));
}

function buildGoogleEntries(apiKey: string, modelIds: string[]): ChainEntry[] {
  if (!apiKey) return [];
  const google = createGoogleGenerativeAI({ apiKey });
  return modelIds.map((id) => ({ modelId: id, provider: "google" as const, model: google(id) }));
}

function remapDeprecated(modelId: string): string {
  if (modelId === "gemini-1.5-flash" || modelId === "gemini-3.6-flash") {
    return process.env.GEMINI_MODEL || "gemini-3.5-flash";
  }
  if (modelId === "gemini-1.5-pro") {
    return "gemini-3.7-flash";
  }
  return modelId;
}

/**
 * Synchronous resolver for backwards compatibility & tests.
 * Rantai cross-provider: GLM mati total → Gemini (dan sebaliknya), selama key penyedia cadangan tersedia.
 */
export function getAgentLanguageModel(modelId?: string): LanguageModel {
  const targetModel = remapDeprecated(modelId || DEFAULT_AGENT_MODEL);
  const glmKey = process.env.GLM_API_KEY || "";
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
  const glmBaseUrl = process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/";

  if (targetModel.startsWith("glm-")) {
    const entries = dedupeChain([
      ...buildGlmEntries(glmKey, glmBaseUrl, [targetModel, ...GLM_FALLBACK_CHAIN]),
      ...buildGoogleEntries(geminiKey, GOOGLE_FALLBACK_CHAIN),
    ]);
    if (entries.length === 0) {
      throw new Error("GLM_API_KEY belum dikonfigurasi di environment variable.");
    }
    return createFallbackModelChain(entries);
  }

  if (targetModel.startsWith("gemini")) {
    const entries = dedupeChain([
      ...buildGoogleEntries(geminiKey, [targetModel, ...GOOGLE_FALLBACK_CHAIN]),
      ...buildGlmEntries(glmKey, glmBaseUrl, GLM_FALLBACK_CHAIN),
    ]);
    if (entries.length === 0) {
      throw new Error("GEMINI_API_KEY belum dikonfigurasi di environment variable.");
    }
    return createFallbackModelChain(entries);
  }

  if (
    targetModel.includes("hermes") ||
    targetModel.includes("ollama") ||
    targetModel.includes("vllm") ||
    targetModel.includes("local")
  ) {
    const baseURL = process.env.AGENT_LOCAL_LLM_BASE_URL || "http://127.0.0.1:11434/v1";
    const apiKey = process.env.AGENT_LOCAL_LLM_API_KEY || "local-no-key-required";
    const openaiCompatible = createOpenAICompatible({ name: "local-hermes", baseURL, apiKey });
    return openaiCompatible(targetModel);
  }

  // Default: GLM utama, Gemini cadangan (cross-provider).
  const entries = dedupeChain([
    ...buildGlmEntries(glmKey, glmBaseUrl, ["glm-4-plus", ...GLM_FALLBACK_CHAIN]),
    ...buildGoogleEntries(geminiKey, ["gemini-3.5-flash", ...GOOGLE_FALLBACK_CHAIN]),
  ]);
  if (entries.length === 0) {
    throw new Error("API Key untuk model agen belum dikonfigurasi.");
  }
  return createFallbackModelChain(entries);
}

/**
 * Dynamic asynchronous resolver that respects database runtime settings, encrypted API keys, or BYOK guru.
 * Failover cross-provider: target GLM → jatuh ke Gemini (jika key Gemini tersedia), dan sebaliknya.
 */
export async function getDynamicAgentLanguageModel(
  modelId?: string,
  byokConfig?: {
    provider: "google" | "openai-compatible";
    apiKey: string;
    baseURL?: string;
    model?: string;
  }
): Promise<LanguageModel> {
  // 0. Jika BYOK Guru disertakan
  if (byokConfig?.apiKey) {
    const chosen = byokConfig.model || modelId || (byokConfig.provider === "google" ? "gemini-2.5-flash" : "glm-4-plus");
    return byokConfig.provider === "google"
      ? createGoogleGenerativeAI({ apiKey: byokConfig.apiKey })(chosen)
      : createOpenAICompatible({
          name: "teacher-byok",
          apiKey: byokConfig.apiKey,
          baseURL: byokConfig.baseURL || "https://open.bigmodel.cn/api/paas/v4",
          fetch: byokConfig.baseURL ? createLlmEndpointFetch(byokConfig.baseURL) : undefined,
        })(chosen);
  }

  const scoped = await getScopedLlmConfig("agent");
  if (scoped.source === "database" || scoped.source === "environment") {
    const chosen = scoped.allowTeacherCustomModel && modelId && scoped.allowedModels.includes(modelId)
      ? modelId : scoped.model;
    if (!scoped.apiKey) throw new Error("API key Klassa Agent belum dikonfigurasi.");
    // Dedicated configs are authoritative: exact IDs, no prefix inference or shared failover.
    return scoped.provider === "google"
      ? createGoogleGenerativeAI({ apiKey: scoped.apiKey })(chosen)
      : createOpenAICompatible({ name: "klassa-agent", apiKey: scoped.apiKey, baseURL: scoped.baseURL,
          fetch: createLlmEndpointFetch(scoped.baseURL) })(chosen);
  }
  const agentConfig = await getEffectiveAgentConfig();
  const effectiveGlmKey = await getEffectiveGlmKey();
  const effectiveGeminiKey = await getEffectiveGeminiKey();
  const effectiveGlmBaseUrl = await getEffectiveGlmBaseUrl();

  const chosenModel = agentConfig.allowTeacherCustomModel && modelId && agentConfig.allowedModels.includes(modelId)
    ? modelId : agentConfig.defaultModel;
  const targetModel = remapDeprecated(chosenModel);

  if (targetModel.startsWith("glm-")) {
    const entries = dedupeChain([
      ...buildGlmEntries(effectiveGlmKey, effectiveGlmBaseUrl, [targetModel, ...GLM_FALLBACK_CHAIN]),
      ...buildGoogleEntries(effectiveGeminiKey, GOOGLE_FALLBACK_CHAIN),
    ]);
    if (entries.length === 0) {
      throw new Error("GLM API Key belum dikonfigurasi di pengaturan Super Admin / environment.");
    }
    return createFallbackModelChain(entries);
  }

  if (targetModel.startsWith("gemini")) {
    const entries = dedupeChain([
      ...buildGoogleEntries(effectiveGeminiKey, [targetModel, ...GOOGLE_FALLBACK_CHAIN]),
      ...buildGlmEntries(effectiveGlmKey, effectiveGlmBaseUrl, GLM_FALLBACK_CHAIN),
    ]);
    if (entries.length === 0) {
      throw new Error("Gemini API Key belum dikonfigurasi di pengaturan Super Admin / environment.");
    }
    return createFallbackModelChain(entries);
  }

  if (
    targetModel.includes("hermes") ||
    targetModel.includes("ollama") ||
    targetModel.includes("vllm") ||
    targetModel.includes("local")
  ) {
    const baseURL = process.env.AGENT_LOCAL_LLM_BASE_URL || "http://127.0.0.1:11434/v1";
    const apiKey = process.env.AGENT_LOCAL_LLM_API_KEY || "local-no-key-required";
    const openaiCompatible = createOpenAICompatible({ name: "local-hermes", baseURL, apiKey });
    return openaiCompatible(targetModel);
  }

  // Default: GLM utama, Gemini cadangan (cross-provider).
  const entries = dedupeChain([
    ...buildGlmEntries(effectiveGlmKey, effectiveGlmBaseUrl, ["glm-4-plus", ...GLM_FALLBACK_CHAIN]),
    ...buildGoogleEntries(effectiveGeminiKey, ["gemini-3.5-flash", ...GOOGLE_FALLBACK_CHAIN]),
  ]);
  if (entries.length === 0) {
    throw new Error("API Key untuk model agen belum dikonfigurasi.");
  }
  return createFallbackModelChain(entries);
}
