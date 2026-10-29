import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDynamicAiContentProvider } from "../ai-provider.factory";
import { prisma } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { invalidateLlmSettingsCache } from "@/modules/system-settings/system-settings.service";
import { OpenAiCompatibleAiContentProvider } from "../openai-compatible.provider";
import { GeminiAiContentProvider } from "../gemini.provider";

vi.mock("@/lib/auth", () => ({
  prisma: {
    systemSetting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/modules/system-settings/llm-endpoint.server", () => ({
  createLlmEndpointFetch: vi.fn(() => vi.fn()),
}));

describe("AI Studio Scoped Provider Factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateLlmSettingsCache();
  });

  it("instantiates OpenAI-compatible provider with dedicated scoped config", async () => {
    const rawKey = "studio-key-1234567890";
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValueOnce([
      {
        key: "llm_scope_ai-studio",
        value: JSON.stringify({
          config: {
            provider: "openai-compatible",
            baseURL: "https://api.mistral.ai/v1",
            model: "mistral-large-latest",
            temperature: 0.6,
            allowedModels: ["mistral-large-latest"],
            allowTeacherCustomModel: false,
          },
          encryptedKey: encryptSecret(rawKey),
        }),
        description: null,
        updatedBy: "admin",
        updatedAt: new Date(),
      } as any,
    ]);

    const prevUseLive = process.env.USE_LIVE_GEMINI;
    process.env.USE_LIVE_GEMINI = "true";
    try {
      const provider = await getDynamicAiContentProvider();
      expect(provider).toBeInstanceOf(OpenAiCompatibleAiContentProvider);
      expect(provider.name).toBe("openai-compatible");
    } finally {
      process.env.USE_LIVE_GEMINI = prevUseLive;
    }
  });

  it("instantiates Gemini provider with native Google endpoint", async () => {
    const rawKey = "gemini-dedicated-key";
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValueOnce([
      {
        key: "llm_scope_ai-studio",
        value: JSON.stringify({
          config: {
            provider: "google",
            baseURL: "https://generativelanguage.googleapis.com/v1beta",
            model: "gemini-2.5-flash",
            temperature: 0.7,
            allowedModels: ["gemini-2.5-flash"],
            allowTeacherCustomModel: false,
          },
          encryptedKey: encryptSecret(rawKey),
        }),
        description: null,
        updatedBy: "admin",
        updatedAt: new Date(),
      } as any,
    ]);

    const prevUseLive = process.env.USE_LIVE_GEMINI;
    process.env.USE_LIVE_GEMINI = "true";
    try {
      const provider = await getDynamicAiContentProvider();
      expect(provider).toBeInstanceOf(GeminiAiContentProvider);
      expect(provider.name).toBe("gemini");
    } finally {
      process.env.USE_LIVE_GEMINI = prevUseLive;
    }
  });
});
