import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveLlmFeatureAdminAction,
  copyLegacyLlmFeatureAdminAction,
  testLlmConnectionAdminAction,
} from "../system-settings.actions";
import { prisma } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/superadmin";
import { encryptSecret } from "@/lib/crypto";
import { invalidateLlmSettingsCache } from "../system-settings.service";
import { generateText } from "ai";

vi.mock("@/lib/auth", () => ({
  prisma: {
    systemSetting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(prisma)),
  },
}));

vi.mock("@/lib/superadmin", () => ({
  requireSuperAdmin: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
  tool: vi.fn((def) => def),
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => ({ modelId: "mock-google" }))),
}));

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => vi.fn(() => ({ modelId: "mock-openai-compat" }))),
}));

vi.mock("../llm-endpoint.server", () => ({
  resolveLlmEndpoint: vi.fn(async () => ({ address: "127.0.0.1", family: 4 })),
  createLlmEndpointFetch: vi.fn(() => vi.fn()),
}));

describe("LLM Settings Admin Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateLlmSettingsCache();
    vi.mocked(requireSuperAdmin).mockResolvedValue({
      userId: "admin-1",
    } as any);
  });

  it("saves AI Studio configuration independently without touching Agent", async () => {
    vi.mocked(prisma.systemSetting.upsert).mockResolvedValue({} as any);

    const res = await saveLlmFeatureAdminAction({
      scope: "ai-studio",
      config: {
        provider: "openai-compatible",
        baseURL: "https://api.custom-llm.com/v1",
        model: "custom-model-1",
        temperature: 0.8,
        allowedModels: ["custom-model-1"],
        allowTeacherCustomModel: false,
      },
      apiKey: "secret-new-key-12345",
    });

    expect(res.success).toBe(true);
    expect(res.data?.model).toBe("custom-model-1");
    expect(res.data?.hasKey).toBe(true);
    expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "llm_scope_ai-studio" },
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "UPDATE_SCOPED_LLM_CONFIG",
          metadata: expect.objectContaining({ scope: "ai-studio" }),
        }),
      })
    );
  });

  it("tests Agent connection and tool calling via mock", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      toolCalls: [{ toolName: "connection_check", args: { status: "OK" } }],
      text: "",
    } as any);

    const res = await testLlmConnectionAdminAction({
      scope: "agent",
      config: {
        provider: "openai-compatible",
        baseURL: "https://open.bigmodel.cn/api/paas/v4",
        model: "glm-4-plus",
        temperature: 0.7,
        allowedModels: ["glm-4-plus"],
        allowTeacherCustomModel: true,
      },
      apiKey: "test-glm-key-abcdef",
    });

    expect(res.success).toBe(true);
    expect(res.message).toContain("tool calling Agent berhasil");
  });

  it("denies access when user is not superadmin", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValueOnce(new Error("Akses ditolak: Hanya Super Admin"));

    const res = await saveLlmFeatureAdminAction({
      scope: "agent",
      config: {
        provider: "google",
        baseURL: "https://generativelanguage.googleapis.com/v1beta",
        model: "gemini-2.5-flash",
        temperature: 0.7,
        allowedModels: ["gemini-2.5-flash"],
        allowTeacherCustomModel: false,
      },
      apiKey: "gemini-key-12345",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Akses ditolak");
  });
});
