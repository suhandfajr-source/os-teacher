import { AiContentProvider } from "./ai-provider.interface";
import { GeminiAiContentProvider } from "./gemini.provider";
import { OpenAiCompatibleAiContentProvider } from "./openai-compatible.provider";
import { MockAiContentProvider, MockProviderOptions } from "./mock.provider";
import {
  getEffectiveAiStudioConfig,
  getEffectiveGlmBaseUrl,
} from "@/modules/system-settings/system-settings.service";

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
 * Dynamic asynchronous resolver that respects database runtime settings configured by Super Admin.
 */
export async function getDynamicAiContentProvider(mockOptions?: MockProviderOptions): Promise<AiContentProvider> {
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

  const config = await getEffectiveAiStudioConfig();
  if (config.provider === "openai-compatible") {
    const baseUrl = await getEffectiveGlmBaseUrl();
    return new OpenAiCompatibleAiContentProvider(config.apiKey, config.model, baseUrl);
  }

  return new GeminiAiContentProvider(config.apiKey, config.model);
}
