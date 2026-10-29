import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDynamicAgentLanguageModel } from "../agent.router";
import { prisma } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { invalidateLlmSettingsCache } from "@/modules/system-settings/system-settings.service";

vi.mock("@/lib/auth", () => ({
  prisma: {
    systemSetting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn((opts) => (modelId: string) => ({
    modelId,
    provider: opts.name,
    baseURL: opts.baseURL,
    apiKey: opts.apiKey,
  })),
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn((opts) => (modelId: string) => ({
    modelId,
    provider: "google",
    apiKey: opts.apiKey,
  })),
}));

vi.mock("@/modules/system-settings/llm-endpoint.server", () => ({
  createLlmEndpointFetch: vi.fn(() => vi.fn()),
}));

describe("Agent Scoped Configuration Routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateLlmSettingsCache();
  });

  it("routes custom model ID directly without prefix inference when dedicated config exists", async () => {
    const rawKey = "agent-scoped-key-998877";
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValueOnce([
      {
        key: "llm_scope_agent",
        value: JSON.stringify({
          config: {
            provider: "openai-compatible",
            baseURL: "https://my-custom-proxy.internal.io/v1",
            model: "custom-math-reasoner-7b",
            temperature: 0.7,
            allowedModels: ["custom-math-reasoner-7b", "custom-code-14b"],
            allowTeacherCustomModel: true,
          },
          encryptedKey: encryptSecret(rawKey),
        }),
        description: null,
        updatedBy: "admin",
        updatedAt: new Date(),
      } as any,
    ]);

    const model: any = await getDynamicAgentLanguageModel("custom-code-14b");
    expect(model.modelId).toBe("custom-code-14b");
    expect(model.baseURL).toBe("https://my-custom-proxy.internal.io/v1");
    expect(model.apiKey).toBe(rawKey);
  });

  it("falls back to default configured model if teacher model is disallowed", async () => {
    const rawKey = "agent-scoped-key-112233";
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValueOnce([
      {
        key: "llm_scope_agent",
        value: JSON.stringify({
          config: {
            provider: "openai-compatible",
            baseURL: "https://open.bigmodel.cn/api/paas/v4",
            model: "glm-4-plus",
            temperature: 0.7,
            allowedModels: ["glm-4-plus"],
            allowTeacherCustomModel: false, // Disallowed override
          },
          encryptedKey: encryptSecret(rawKey),
        }),
        description: null,
        updatedBy: "admin",
        updatedAt: new Date(),
      } as any,
    ]);

    const model: any = await getDynamicAgentLanguageModel("disallowed-fancy-model");
    expect(model.modelId).toBe("glm-4-plus");
  });
});
