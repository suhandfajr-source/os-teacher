import { z } from "zod";

export const llmScopeSchema = z.enum(["ai-studio", "agent"]);
export type LlmScope = z.infer<typeof llmScopeSchema>;
export const GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_COMPATIBLE_URL = "https://open.bigmodel.cn/api/paas/v4";

export class LlmSettingsError extends Error {}

export function normalizeApiUrl(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch {
    throw new LlmSettingsError("API URL tidak valid.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && loopback && process.env.NODE_ENV === "development"))) {
    throw new LlmSettingsError("Gunakan HTTPS tanpa kredensial, query, atau fragment. HTTP localhost hanya untuk development.");
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || !host.includes(".")) {
    if (!(loopback && process.env.NODE_ENV === "development")) {
      throw new LlmSettingsError("Endpoint jaringan internal tidak diizinkan.");
    }
  }
  return url.toString().replace(/\/+$/, "");
}

const modelId = z.string().trim().min(1).max(200).regex(/^[^\s\x00-\x1f\x7f]+$/, "Model ID tidak valid.");
export const llmConfigSchema = z.object({
  provider: z.enum(["google", "openai-compatible"]),
  baseURL: z.string().trim().min(1).max(2048),
  model: modelId,
  temperature: z.number().min(0).max(2).default(0.7),
  allowedModels: z.array(modelId).max(50).default([]),
  allowTeacherCustomModel: z.boolean().default(false),
}).strict().transform((config) => {
  const baseURL = normalizeApiUrl(config.baseURL);
  if (config.provider === "google" && baseURL !== GOOGLE_API_URL) {
    throw new LlmSettingsError("Gemini native memakai endpoint Google bawaan. Pilih OpenAI-compatible untuk URL custom.");
  }
  return { ...config, baseURL, allowedModels: [...new Set([config.model, ...config.allowedModels])] };
});
export type LlmFeatureConfig = z.infer<typeof llmConfigSchema>;
export type LlmConfigSource = "database" | "environment" | "legacy" | "missing";
export interface LlmRuntimeConfig extends LlmFeatureConfig {
  apiKey: string;
  source: LlmConfigSource;
}
export interface LlmFeatureView extends LlmFeatureConfig {
  hasKey: boolean;
  maskedKey: string;
  source: LlmConfigSource;
}
export const scopedLlmInputSchema = z.object({
  scope: llmScopeSchema,
  config: llmConfigSchema,
  apiKey: z.string().trim().max(8192).optional(),
}).strict();
export type ScopedLlmInput = z.input<typeof scopedLlmInputSchema>;
export function scopedSettingKey(scope: LlmScope) { return `llm_scope_${scope}`; }

export function settingsErrorMessage(error: unknown): string {
  if (error instanceof LlmSettingsError) return error.message;
  if (error instanceof z.ZodError) return "Konfigurasi tidak valid. Periksa URL, Model ID, dan pengaturan lanjutan.";
  if (error instanceof Error && error.message.includes("Akses ditolak")) return error.message;
  return "Operasi LLM gagal. Periksa akses admin, konfigurasi, dan koneksi; lalu coba lagi.";
}
