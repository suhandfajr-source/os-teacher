import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_AGENT_MODEL,
  AVAILABLE_AGENT_MODELS,
  BASE_SYSTEM_PROMPT,
} from "../agent.config";
import { getAgentLanguageModel } from "../agent.router";

describe("Klassa Agent Core Runtime & Schema (BMad Build Story 1)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Agent Configuration & Safety Rules", () => {
    it("has GLM-4 Plus as the default lightweight model", () => {
      expect(DEFAULT_AGENT_MODEL).toBe("glm-4-plus");
      const defaultOption = AVAILABLE_AGENT_MODELS.find((m) => m.isDefault);
      expect(defaultOption?.id).toBe("glm-4-plus");
    });

    it("includes open-weights Hermes option for on-premise deployments", () => {
      const hermesOption = AVAILABLE_AGENT_MODELS.find((m) => m.id === "hermes-local");
      expect(hermesOption).toBeDefined();
      expect(hermesOption?.provider).toBe("openai-compatible");
    });

    it("enforces strict non-clinical/medical diagnosis refusal in system prompt", () => {
      expect(BASE_SYSTEM_PROMPT).toContain("BUKAN praktisi medis atau psikiater anak");
      expect(BASE_SYSTEM_PROMPT).toContain("ADHD, autisme");
      expect(BASE_SYSTEM_PROMPT).toContain("Bimbingan Konseling (BK)");
    });

    it("enforces topic guidelines (general education answered 100%, non-education deflected)", () => {
      expect(BASE_SYSTEM_PROMPT).toContain("Topik Pendidikan Umum (DILAYANI 100%)");
      expect(BASE_SYSTEM_PROMPT).toContain("Topik Non-Pendidikan / Di Luar Konteks (TOLAK SECARA HALUS)");
    });

    it("enforces deterministic calculation constraint in system prompt", () => {
      expect(BASE_SYSTEM_PROMPT).toContain("DILARANG menghitung rata-rata nilai");
      expect(BASE_SYSTEM_PROMPT).toContain("100% akurat");
    });

    it("enforces pedagogical context clarification before recommending teaching methods", () => {
      expect(BASE_SYSTEM_PROMPT).toContain("PROAKTIF MENDALAMI KONTEKS SEBELUM REKOMENDASI");
      expect(BASE_SYSTEM_PROMPT).toContain("Materi/Topik apa yang akan dibahas");
    });
  });

  describe("Universal Model Router Dispatcher", () => {
    it("throws a descriptive error when GLM_API_KEY is not configured", () => {
      delete process.env.GLM_API_KEY;

      expect(() => getAgentLanguageModel("glm-4-plus")).toThrowError(
        /GLM_API_KEY belum dikonfigurasi/
      );
    });

    it("successfully creates a GLM model when key is present", () => {
      process.env.GLM_API_KEY = "test-fake-key-for-glm";
      const model = getAgentLanguageModel("glm-4-plus");
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe("glm-4-plus");
    });

    it("throws a descriptive error when GEMINI_API_KEY is not configured", () => {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      expect(() => getAgentLanguageModel("gemini-1.5-flash")).toThrowError(
        /GEMINI_API_KEY belum dikonfigurasi/
      );
    });

    it("successfully creates a Google Generative AI model when key is present and remaps legacy model", () => {
      process.env.GEMINI_API_KEY = "test-fake-key-for-gemini";
      const model = getAgentLanguageModel("gemini-3.5-flash");
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe("gemini-3.5-flash");

      // Remap legacy model automatically (mengikuti GEMINI_MODEL di .env — kini gemini-3.8-flash)
      const legacyModel = getAgentLanguageModel("gemini-1.5-flash");
      expect((legacyModel as any).modelId).toBe(process.env.GEMINI_MODEL || "gemini-3.5-flash");
    });

    it("dispatches to OpenAI-compatible endpoint when hermes model is requested", () => {
      process.env.AGENT_LOCAL_LLM_BASE_URL = "http://127.0.0.1:11434/v1";
      const model = getAgentLanguageModel("hermes-local");
      expect(model).toBeDefined();
      expect((model as any).modelId).toBe("hermes-local");
    });
  });
});
