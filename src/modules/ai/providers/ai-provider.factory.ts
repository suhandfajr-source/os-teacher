import { AiContentProvider } from "./ai-provider.interface";
import { GeminiAiContentProvider } from "./gemini.provider";
import { MockAiContentProvider, MockProviderOptions } from "./mock.provider";

let customProviderInstance: AiContentProvider | null = null;

/**
 * Sets a custom provider instance (used in tests for mocking/spying).
 */
export function setAiContentProviderForTest(provider: AiContentProvider | null) {
  customProviderInstance = provider;
}

/**
 * Creates and returns the active AI Content Provider based on runtime environment.
 * 
 * Rules:
 * - If a test provider is injected, returns the test provider.
 * - If explicit AI_PROVIDER=mock or NODE_ENV=test (and no live key requested), returns MockAiContentProvider.
 * - Otherwise (in production/pilot/live dev mode), returns GeminiAiContentProvider.
 * - If Gemini credentials are missing in production mode, GeminiAiContentProvider throws an explicit configuration error.
 *   Mock provider MUST NEVER silently replace Gemini in production use.
 */
export function getAiContentProvider(mockOptions?: MockProviderOptions): AiContentProvider {
  if (customProviderInstance) {
    return customProviderInstance;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const isExplicitMock = process.env.AI_PROVIDER === "mock";
  const isTestEnv = process.env.NODE_ENV === "test" && !process.env.USE_LIVE_GEMINI;

  // HARD GUARD: Production must NEVER serve MockAiContentProvider under any circumstances
  if (isProduction && isExplicitMock) {
    throw new Error("Mock AI provider is strictly prohibited in production environment.");
  }

  if (isExplicitMock || isTestEnv) {
    return new MockAiContentProvider(mockOptions);
  }

  return new GeminiAiContentProvider();
}
