"use server";

import { prisma } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/superadmin";
import { encryptSecret } from "@/lib/crypto";
import {
  getAdminLlmConfigView,
  invalidateLlmSettingsCache,
  SystemLlmConfig,
} from "./system-settings.service";
import { GoogleGenAI } from "@google/genai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

export async function getLlmSettingsAdminAction(): Promise<{
  success: boolean;
  data?: SystemLlmConfig;
  error?: string;
}> {
  try {
    await requireSuperAdmin();
    const config = await getAdminLlmConfigView();
    return { success: true, data: config };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat konfigurasi." };
  }
}

/**
 * Updates API Keys with encryption. If empty string is passed, existing key is kept.
 */
export async function updateApiKeysAdminAction(payload: {
  geminiKey?: string;
  glmKey?: string;
  glmBaseUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await requireSuperAdmin();

    const upsertSetting = async (key: string, value: string, description: string) => {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value, updatedBy: userId },
        create: { key, value, description, updatedBy: userId },
      });
    };

    if (payload.geminiKey && payload.geminiKey.trim()) {
      const encrypted = encryptSecret(payload.geminiKey.trim());
      await upsertSetting("llm_key_gemini", encrypted, "Encrypted Gemini API Key");
    }

    if (payload.glmKey && payload.glmKey.trim()) {
      const encrypted = encryptSecret(payload.glmKey.trim());
      await upsertSetting("llm_key_glm", encrypted, "Encrypted Zhipu GLM API Key");
    }

    if (payload.glmBaseUrl && payload.glmBaseUrl.trim()) {
      await upsertSetting("llm_base_url_glm", payload.glmBaseUrl.trim(), "GLM OpenAI Compatible Base URL");
    }

    // Record audit log
    await prisma.auditLog.create({
      data: {
        actorType: "USER",
        actorId: userId,
        action: "UPDATE_LLM_API_KEYS",
        targetType: "SYSTEM_SETTING",
        metadata: {
          updatedGeminiKey: Boolean(payload.geminiKey && payload.geminiKey.trim()),
          updatedGlmKey: Boolean(payload.glmKey && payload.glmKey.trim()),
          updatedGlmBaseUrl: Boolean(payload.glmBaseUrl && payload.glmBaseUrl.trim()),
        },
      },
    });

    invalidateLlmSettingsCache();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Gagal menyimpan API Key." };
  }
}

/**
 * Updates AI Studio & KLASSA Agent configuration
 */
export async function updateLlmModelsAdminAction(payload: {
  aiStudio: {
    provider: "google" | "openai-compatible";
    model: string;
    temperature: number;
  };
  agent: {
    defaultModel: string;
    allowedModels: string[];
    allowTeacherCustomModel: boolean;
  };
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await requireSuperAdmin();

    const upsertSetting = async (key: string, value: string, description: string) => {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value, updatedBy: userId },
        create: { key, value, description, updatedBy: userId },
      });
    };

    await upsertSetting(
      "llm_ai_studio",
      JSON.stringify(payload.aiStudio),
      "AI Studio Active LLM Configuration"
    );

    await upsertSetting(
      "llm_agent",
      JSON.stringify(payload.agent),
      "KLASSA Agent Active Models Configuration"
    );

    // Record audit log
    await prisma.auditLog.create({
      data: {
        actorType: "USER",
        actorId: userId,
        action: "UPDATE_LLM_MODELS",
        targetType: "SYSTEM_SETTING",
        metadata: {
          aiStudio: payload.aiStudio,
          agent: payload.agent,
        },
      },
    });

    invalidateLlmSettingsCache();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Gagal memperbarui konfigurasi LLM." };
  }
}

/**
 * Pre-flight test connection to verify API Key without saving
 */
export async function testLlmConnectionAdminAction(params: {
  provider: "google" | "openai-compatible";
  apiKey?: string;
  baseURL?: string;
  model?: string;
}): Promise<{ success: boolean; latencyMs?: number; message?: string; error?: string }> {
  try {
    await requireSuperAdmin();

    const startTime = Date.now();
    if (params.provider === "google") {
      let keyToTest = params.apiKey?.trim();
      if (!keyToTest) {
        const { getEffectiveGeminiKey } = await import("./system-settings.service");
        keyToTest = await getEffectiveGeminiKey();
      }
      if (!keyToTest) {
        return { success: false, error: "API Key Gemini kosong." };
      }

      const client = new GoogleGenAI({ apiKey: keyToTest });
      const testModel = params.model || "gemini-2.5-flash";
      const response = await client.models.generateContent({
        model: testModel,
        contents: "Tes koneksi super admin. Balas satu kata: OK.",
      });

      const latencyMs = Date.now() - startTime;
      const text = response.text || "";
      return {
        success: true,
        latencyMs,
        message: `Koneksi Google Gemini sukses (${latencyMs}ms). Output: ${text.slice(0, 30)}`,
      };
    }

    if (params.provider === "openai-compatible") {
      let keyToTest = params.apiKey?.trim();
      let baseUrlToTest = params.baseURL?.trim();
      if (!keyToTest) {
        const { getEffectiveGlmKey } = await import("./system-settings.service");
        keyToTest = await getEffectiveGlmKey();
      }
      if (!baseUrlToTest) {
        const { getEffectiveGlmBaseUrl } = await import("./system-settings.service");
        baseUrlToTest = await getEffectiveGlmBaseUrl();
      }
      if (!keyToTest) {
        return { success: false, error: "API Key GLM/OpenAI-compatible kosong." };
      }

      const client = createOpenAICompatible({
        name: "test-client",
        baseURL: baseUrlToTest,
        apiKey: keyToTest,
      });

      const testModel = params.model || "glm-4-plus";
      const response = await generateText({
        model: client(testModel),
        prompt: "Tes koneksi super admin. Balas satu kata: OK.",
      });

      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        latencyMs,
        message: `Koneksi OpenAI-compatible sukses (${latencyMs}ms). Output: ${response.text.slice(0, 30)}`,
      };
    }

    return { success: false, error: "Provider tidak dikenali." };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menguji koneksi.",
    };
  }
}
