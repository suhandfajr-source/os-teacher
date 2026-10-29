import { AiContentProvider } from "./ai-provider.interface";
import { GeminiAiContentProvider } from "./gemini.provider";
import { OpenAiCompatibleAiContentProvider } from "./openai-compatible.provider";
import { MockAiContentProvider, MockProviderOptions } from "./mock.provider";
import {
  getEffectiveAiStudioConfig,
} from "@/modules/system-settings/system-settings.service";

import { createLlmEndpointFetch } from "@/modules/system-settings/llm-endpoint.server";

let customProviderInstance: AiContentProvider | null = null;

/**
 * Sets a custom provider instance (used in tests for mocking/spying).
 */
export function setAiContentProviderForTest(provider: AiContentProvider | null) {
  customProviderInstance = provider;
}

/**
 * Synchronous resolver for tests/mock environments.
 */
export function getAiContentProvider(mockOptions?: MockProviderOptions): AiContentProvider {
  if (customProviderInstance) {
    return customProviderInstance;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const isExplicitMock = process.env.AI_PROVIDER === "mock";
  const isTestEnv = process.env.NODE_ENV === "test" && !process.env.USE_LIVE_GEMINI;

  if (isProduction && isExplicitMock) {
    throw new Error("Mock AI provider is strictly prohibited in production environment.");
  }

  if (isExplicitMock || isTestEnv) {
    return new MockAiContentProvider(mockOptions);
  }

  return new GeminiAiContentProvider();
}

/**
 * Dynamic asynchronous resolver that respects database runtime settings configured by Super Admin, or BYOK guru.
 */
export async function getDynamicAiContentProvider(
  mockOptions?: MockProviderOptions,
  byokConfig?: {
    provider: "google" | "openai-compatible";
    apiKey: string;
    baseURL?: string;
    model?: string;
  }
): Promise<AiContentProvider> {
  if (customProviderInstance) {
    return customProviderInstance;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const isExplicitMock = process.env.AI_PROVIDER === "mock";
  const isTestEnv = process.env.NODE_ENV === "test" && !process.env.USE_LIVE_GEMINI;

  if (isProduction && isExplicitMock) {
    throw new Error("Mock AI provider is strictly prohibited in production environment.");
  }

  if (isExplicitMock || isTestEnv) {
    return new MockAiContentProvider(mockOptions);
  }

  // 0. Jika BYOK guru aktif
  if (byokConfig?.apiKey) {
    if (byokConfig.provider === "openai-compatible") {
      return new OpenAiCompatibleAiContentProvider(
        byokConfig.apiKey,
        byokConfig.model || "glm-4-plus",
        byokConfig.baseURL || "https://open.bigmodel.cn/api/paas/v4"
      );
    }
    return new GeminiAiContentProvider(byokConfig.apiKey, byokConfig.model || "gemini-2.5-flash");
  }

  const config = await getEffectiveAiStudioConfig();
  if (!config.apiKey) throw new Error("API key AI Studio belum dikonfigurasi.");
  const dedicated = config.source === "database" || config.source === "environment";
  if (config.provider === "openai-compatible") {
    return new OpenAiCompatibleAiContentProvider(config.apiKey, config.model, config.baseURL, {
      fetch: dedicated ? createLlmEndpointFetch(config.baseURL) : undefined,
      temperature: config.temperature,
    });
  }

  return new GeminiAiContentProvider(config.apiKey, config.model, { temperature: config.temperature, exactModel: dedicated });
}
