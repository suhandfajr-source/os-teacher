import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { LanguageModel } from "ai";
import { DEFAULT_AGENT_MODEL } from "./agent.config";
import {
  getEffectiveAgentConfig,
  getEffectiveGeminiKey,
  getEffectiveGlmKey,
  getEffectiveGlmBaseUrl,
} from "@/modules/system-settings/system-settings.service";

/** Tipe struktural minimal untuk mendispatch pemanggilan model (spec v2-v4 kompatibel). */
interface DispatchableLanguageModel {
  readonly specificationVersion: string;
  readonly provider: string;
  readonly modelId: string;
  doGenerate(options: unknown): Promise<unknown>;
  doStream(options: unknown): Promise<unknown>;
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

function createFallbackModelChain(models: LanguageModel[]): LanguageModel {
  if (models.length === 1) return models[0];
  const chain = models.map((m) => m as unknown as DispatchableLanguageModel);
  let idx = 0;
  const active = () => chain[Math.min(idx, chain.length - 1)];
  const attempt = async <T>(op: (m: DispatchableLanguageModel) => Promise<T>): Promise<T> => {
    let lastErr: unknown;
    while (idx < chain.length) {
      const m = chain[idx];
      try {
        return await op(m);
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (!isRetryableProviderError(err) || idx === chain.length - 1) throw err;
        console.warn(
          `[agent-router] Model "${m.modelId}" tidak merespons (${msg.slice(0, 120)}…) — beralih ke "${chain[idx + 1].modelId}"`
        );
        idx++;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  };
  const wrapper: DispatchableLanguageModel = {
    get specificationVersion() {
      return active().specificationVersion;
    },
    get provider() {
      return active().provider;
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
 * Synchronous resolver for backwards compatibility & tests
 */
export function getAgentLanguageModel(modelId?: string): LanguageModel {
  const targetModel = remapDeprecated(modelId || DEFAULT_AGENT_MODEL);

  if (targetModel.startsWith("glm-")) {
    const apiKey = process.env.GLM_API_KEY;
    if (!apiKey) {
      throw new Error("GLM_API_KEY belum dikonfigurasi di environment variable.");
    }
    const baseURL = process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/";
    const glmClient = createOpenAICompatible({ name: "glm", baseURL, apiKey });
    const chain = [targetModel, ...GLM_FALLBACK_CHAIN.filter((m) => m !== targetModel)];
    return createFallbackModelChain([...new Set(chain)].map((m) => glmClient(m)));
  }

  if (targetModel.startsWith("gemini")) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY belum dikonfigurasi di environment variable.");
    }
    const google = createGoogleGenerativeAI({ apiKey });
    const chain = [targetModel, ...GOOGLE_FALLBACK_CHAIN.filter((m) => m !== targetModel), targetModel];
    return createFallbackModelChain([...new Set(chain)].map((m) => google(m)));
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

  if (process.env.GLM_API_KEY) {
    const baseURL = process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/";
    const glmClient = createOpenAICompatible({ name: "glm", baseURL, apiKey: process.env.GLM_API_KEY });
    const fallbackModel = "glm-4-plus";
    const chain = [fallbackModel, ...GLM_FALLBACK_CHAIN.filter((m) => m !== fallbackModel)];
    return createFallbackModelChain(chain.map((m) => glmClient(m)));
  }

  const fallbackKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!fallbackKey) {
    throw new Error("API Key untuk model agen belum dikonfigurasi.");
  }
  const google = createGoogleGenerativeAI({ apiKey: fallbackKey });
  const chain = ["gemini-3.5-flash", ...GOOGLE_FALLBACK_CHAIN.filter((m) => m !== "gemini-3.5-flash")];
  return createFallbackModelChain(chain.map((m) => google(m)));
}

/**
 * Dynamic asynchronous resolver that respects database runtime settings & encrypted API keys.
 */
export async function getDynamicAgentLanguageModel(modelId?: string): Promise<LanguageModel> {
  const agentConfig = await getEffectiveAgentConfig();
  const effectiveGlmKey = await getEffectiveGlmKey();
  const effectiveGeminiKey = await getEffectiveGeminiKey();
  const effectiveGlmBaseUrl = await getEffectiveGlmBaseUrl();

  const chosenModel = modelId || agentConfig.defaultModel;
  const targetModel = remapDeprecated(chosenModel);

  if (targetModel.startsWith("glm-")) {
    if (!effectiveGlmKey) {
      throw new Error("GLM API Key belum dikonfigurasi di pengaturan Super Admin / environment.");
    }
    const glmClient = createOpenAICompatible({
      name: "glm",
      baseURL: effectiveGlmBaseUrl,
      apiKey: effectiveGlmKey,
    });
    const chain = [targetModel, ...GLM_FALLBACK_CHAIN.filter((m) => m !== targetModel)];
    return createFallbackModelChain([...new Set(chain)].map((m) => glmClient(m)));
  }

  if (targetModel.startsWith("gemini")) {
    if (!effectiveGeminiKey) {
      throw new Error("Gemini API Key belum dikonfigurasi di pengaturan Super Admin / environment.");
    }
    const google = createGoogleGenerativeAI({ apiKey: effectiveGeminiKey });
    const chain = [targetModel, ...GOOGLE_FALLBACK_CHAIN.filter((m) => m !== targetModel), targetModel];
    return createFallbackModelChain([...new Set(chain)].map((m) => google(m)));
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

  if (effectiveGlmKey) {
    const glmClient = createOpenAICompatible({
      name: "glm",
      baseURL: effectiveGlmBaseUrl,
      apiKey: effectiveGlmKey,
    });
    const fallbackModel = "glm-4-plus";
    const chain = [fallbackModel, ...GLM_FALLBACK_CHAIN.filter((m) => m !== fallbackModel)];
    return createFallbackModelChain(chain.map((m) => glmClient(m)));
  }

  if (effectiveGeminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: effectiveGeminiKey });
    const chain = ["gemini-3.5-flash", ...GOOGLE_FALLBACK_CHAIN.filter((m) => m !== "gemini-3.5-flash")];
    return createFallbackModelChain(chain.map((m) => google(m)));
  }

  throw new Error("API Key untuk model agen belum dikonfigurasi.");
}
