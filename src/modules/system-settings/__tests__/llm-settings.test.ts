import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  llmConfigSchema,
  normalizeApiUrl,
  scopedLlmInputSchema,
  scopedSettingKey,
  GOOGLE_API_URL,
  DEFAULT_COMPATIBLE_URL,
} from "../llm-settings.schema";
import {
  decodeScopedLlmRecord,
  getScopedLlmConfig,
  invalidateLlmSettingsCache,
  toLlmFeatureView,
} from "../system-settings.service";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/auth";

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

describe("LLM Settings Schema & Validation", () => {
  it("normalizes trailing slashes and validates URLs", () => {
    expect(normalizeApiUrl("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1");
    expect(normalizeApiUrl("https://generativelanguage.googleapis.com/v1beta/")).toBe(GOOGLE_API_URL);
  });

  it("rejects non-https URLs for remote targets", () => {
    expect(() => normalizeApiUrl("http://api.openai.com/v1")).toThrow("Gunakan HTTPS");
  });

  it("permits localhost http in development mode", () => {
    const prev = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "development");
    try {
      expect(normalizeApiUrl("http://127.0.0.1:11434/v1")).toBe("http://127.0.0.1:11434/v1");
      expect(normalizeApiUrl("http://localhost:11434/v1")).toBe("http://localhost:11434/v1");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects custom URLs for native Google provider", () => {
    expect(() =>
      llmConfigSchema.parse({
        provider: "google",
        baseURL: "https://my-proxy.com/v1",
        model: "gemini-2.5-flash",
      })
    ).toThrow("Gemini native memakai endpoint Google bawaan");
  });

  it("accepts OpenAI-compatible config with custom baseURL", () => {
    const parsed = llmConfigSchema.parse({
      provider: "openai-compatible",
      baseURL: "https://api.together.xyz/v1/",
      model: "meta-llama/Llama-3-70b-chat",
      temperature: 0.5,
    });
    expect(parsed.baseURL).toBe("https://api.together.xyz/v1");
    expect(parsed.allowedModels).toContain("meta-llama/Llama-3-70b-chat");
  });
});

describe("Scoped LLM Service Resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateLlmSettingsCache();
    delete process.env.AI_STUDIO_LLM_API_KEY;
    delete process.env.KLASSA_AGENT_LLM_API_KEY;
  });

  it("decodes scoped database record and masks key for view", () => {
    const rawKey = "sk-test-secret-key-12345678";
    const encrypted = encryptSecret(rawKey);
    const stored = JSON.stringify({
      config: {
        provider: "openai-compatible",
        baseURL: "https://open.bigmodel.cn/api/paas/v4",
        model: "glm-4-plus",
        temperature: 0.7,
        allowedModels: ["glm-4-plus"],
        allowTeacherCustomModel: false,
      },
      encryptedKey: encrypted,
    });

    const runtime = decodeScopedLlmRecord(stored);
    expect(runtime.apiKey).toBe(rawKey);
    expect(runtime.source).toBe("database");

    const view = toLlmFeatureView(runtime);
    expect(view.hasKey).toBe(true);
    expect(view.maskedKey).toContain("sk-");
    expect(view.maskedKey).not.toBe(rawKey);
  });

  it("falls back to legacy keys when no dedicated record exists", async () => {
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValueOnce([
      {
        key: "llm_key_glm",
        value: encryptSecret("legacy-glm-key-9999"),
        description: null,
        updatedBy: "admin",
        updatedAt: new Date(),
      } as any,
    ]);

    const config = await getScopedLlmConfig("agent", true);
    expect(config.source).toBe("legacy");
    expect(config.apiKey).toBe("legacy-glm-key-9999");
    expect(config.model).toBe("glm-4-plus");
  });
});
