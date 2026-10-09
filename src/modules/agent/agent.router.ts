import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { LanguageModel } from "ai";
import { DEFAULT_AGENT_MODEL } from "./agent.config";

/** Tipe struktural minimal untuk mendispatch pemanggilan model (spec v2-v4 kompatibel). */
interface DispatchableLanguageModel {
  readonly specificationVersion: string;
  readonly provider: string;
  readonly modelId: string;
  doGenerate(options: unknown): Promise<unknown>;
  doStream(options: unknown): Promise<unknown>;
}

/**
 * Universal Multi-Model Router
 * Mengembalikan instance LanguageModel Vercel AI SDK yang sesuai dengan model yang diminta.
 *
 * Fitur fallback instan (Story reliabilitas): jika model utama menolak permintaan
 * karena beban tinggi (503/429/overloaded/quota), wrapper langsung beralih ke model
 * cadangan pada percobaan yang sama — TANPA exponential backoff ala SDK (yang terbukti
 * membuat chat macet 50+ detik lalu gagal total saat provider sedang ramai).
 */

/** Model cadangan lintas generasi — diuji berurutan sampai ada yang hidup. */
// Catatan reliabilitas: traffic function-calling (tools) pada keluarga flash kerap
// di-503 ("high demand"), sedangkan 3.7-flash stabil untuk tools — maka ditaruk kedua.
const GOOGLE_FALLBACK_CHAIN = ["gemini-3.7-flash", "gemini-flash-latest"];

/** Pesan error provider yang layak di-fallback ke model lain (transien, bukan bug input). */
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

/** Deadline "awal respons" per model (ms): doStream resolve begitu respons HTTP diterima —
 *  stream panjang setelahnya TIDAK terdampak. Cegah request menggantung tanpa batas. */
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
  // Cegah unhandled rejection bila promise asli selesai setelah race dimenangkan guard.
  p.catch(() => {});
  try {
    return await Promise.race([p, guard]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isRetryableProviderError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (!msg) return true; // gagal tanpa pesan (koneksivitas) — coba model berikutnya
  // Error validasi input TIDAK di-fallback (ganti model tidak akan menolong).
  if (/api key|permission|invalid request|not found|unsupported/i.test(msg)) return false;
  return RETRYABLE_ERROR_PATTERNS.some((re) => re.test(msg));
}

/** Bungkus beberapa model menjadi satu LanguageModel dengan failover otomatis. */
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

export function getAgentLanguageModel(modelId?: string): LanguageModel {
  const targetModel = remapDeprecated(modelId || DEFAULT_AGENT_MODEL);

  // 1. Google Gemini Family
  if (targetModel.startsWith("gemini")) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY belum dikonfigurasi di environment variable.");
    }
    const google = createGoogleGenerativeAI({ apiKey });
    // Rantai failover: model pilihan guru → cadangan lintas generasi → retry model pilihan
    // (spike 503 Google biasanya singkat — retry terakhir sering langsung lolos).
    const chain = [
      targetModel,
      ...GOOGLE_FALLBACK_CHAIN.filter((m) => m !== targetModel),
      targetModel,
    ];
    return createFallbackModelChain([...new Set(chain)].map((m) => google(m)));
  }

  // 2. OpenAI-Compatible Endpoint (Hermes, vLLM, Ollama, Groq, DeepSeek, Local)
  if (
    targetModel.includes("hermes") ||
    targetModel.includes("ollama") ||
    targetModel.includes("vllm") ||
    targetModel.includes("local")
  ) {
    const baseURL = process.env.AGENT_LOCAL_LLM_BASE_URL || "http://127.0.0.1:11434/v1";
    const apiKey = process.env.AGENT_LOCAL_LLM_API_KEY || "local-no-key-required";
    const openaiCompatible = createOpenAICompatible({
      name: "local-hermes",
      baseURL,
      apiKey,
    });
    return openaiCompatible(targetModel);
  }

  // Fallback default to Google Gemini Flash
  const fallbackKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!fallbackKey) {
    throw new Error("API Key untuk model agen belum dikonfigurasi.");
  }
  const google = createGoogleGenerativeAI({ apiKey: fallbackKey });
  const chain = [DEFAULT_AGENT_MODEL, ...GOOGLE_FALLBACK_CHAIN.filter((m) => m !== DEFAULT_AGENT_MODEL)];
  return createFallbackModelChain(chain.map((m) => google(m)));
}
