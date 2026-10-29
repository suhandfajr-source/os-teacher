"use server";

import { prisma } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/superadmin";
import { encryptSecret } from "@/lib/crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, tool } from "ai";
import { z } from "zod";
import {
  decodeScopedLlmRecord, getAdminLlmConfigView, getScopedLlmConfig,
  invalidateLlmSettingsCache, toLlmFeatureView, type SystemLlmConfig,
} from "./system-settings.service";
import {
  llmScopeSchema, scopedLlmInputSchema, scopedSettingKey, settingsErrorMessage,
  LlmSettingsError, type LlmScope, type ScopedLlmInput, type LlmRuntimeConfig,
} from "./llm-settings.schema";
import { createLlmEndpointFetch, resolveLlmEndpoint } from "./llm-endpoint.server";

export async function getLlmSettingsAdminAction(): Promise<{
  success: boolean; data?: SystemLlmConfig; error?: string;
}> {
  try {
    await requireSuperAdmin();
    return { success: true, data: await getAdminLlmConfigView() };
  } catch (error) {
    return { success: false, error: settingsErrorMessage(error) };
  }
}

/** Daily quota remains shared across Studio, Agent and Quiz, as before. */
export async function updateAiUsageLimitAdminAction(payload: { dailyLimit: number | null }) {
  try {
    const { userId } = await requireSuperAdmin();
    if (payload.dailyLimit !== null && (!Number.isInteger(payload.dailyLimit) || payload.dailyLimit < 0)) {
      return { success: false, error: "Batas harus berupa angka bulat >= 0." };
    }
    if (payload.dailyLimit === null) {
      await prisma.systemSetting.deleteMany({ where: { key: "ai_daily_limit" } });
    } else {
      await prisma.systemSetting.upsert({
        where: { key: "ai_daily_limit" },
        update: { value: String(payload.dailyLimit), updatedBy: userId },
        create: { key: "ai_daily_limit", value: String(payload.dailyLimit), updatedBy: userId,
          description: "Batas pemakaian AI per guru per hari (WIB). 0 = nonaktif." },
      });
    }
    invalidateLlmSettingsCache();
    return { success: true };
  } catch (error) {
    return { success: false, error: settingsErrorMessage(error) };
  }
}

function retainedKey(current: LlmRuntimeConfig, input: z.output<typeof scopedLlmInputSchema>): string {
  if (input.apiKey) return input.apiKey;
  if (current.source !== "database" && current.source !== "environment") {
    throw new LlmSettingsError("Masukkan API key atau gunakan Salin konfigurasi lama terlebih dahulu.");
  }
  if (current.provider !== input.config.provider || current.baseURL !== input.config.baseURL) {
    throw new LlmSettingsError("URL/provider berubah. Masukkan API key baru agar key lama tidak terkirim ke endpoint lain.");
  }
  if (!current.apiKey) throw new LlmSettingsError("API key belum tersedia.");
  return current.apiKey;
}

async function persistFeature(input: z.output<typeof scopedLlmInputSchema>, userId: string, copying = false) {
  await resolveLlmEndpoint(input.config.baseURL);
  // A supplied new key also lets an administrator repair a malformed saved record.
  const fallback = !input.apiKey ? await getScopedLlmConfig(input.scope, true) : undefined;
  const saved = await prisma.$transaction(async (tx) => {
    const key = scopedSettingKey(input.scope);
    const row = await tx.systemSetting.findUnique({ where: { key } });
    if (copying && row) throw new LlmSettingsError("Fitur ini sudah memiliki konfigurasi sendiri.");
    const apiKey = input.apiKey || retainedKey(row ? decodeScopedLlmRecord(row.value) : fallback!, input);
    const value = JSON.stringify({ config: input.config, encryptedKey: encryptSecret(apiKey) });
    await tx.systemSetting.upsert({
      where: { key }, update: { value, updatedBy: userId },
      create: { key, value, updatedBy: userId, description: `Independent LLM configuration: ${input.scope}` },
    });
    await tx.auditLog.create({ data: {
      actorType: "USER", actorId: userId,
      action: copying ? "COPY_LEGACY_LLM_CONFIG" : "UPDATE_SCOPED_LLM_CONFIG",
      targetType: "SYSTEM_SETTING",
      metadata: { scope: input.scope, provider: input.config.provider, keyChanged: Boolean(input.apiKey) },
    } });
    return toLlmFeatureView({ ...input.config, apiKey, source: "database" });
  }, { isolationLevel: "Serializable" });
  invalidateLlmSettingsCache();
  return saved;
}

export async function saveLlmFeatureAdminAction(payload: ScopedLlmInput) {
  try {
    const { userId } = await requireSuperAdmin();
    const input = scopedLlmInputSchema.parse(payload);
    return { success: true as const, data: await persistFeature(input, userId) };
  } catch (error) {
    return { success: false as const, error: settingsErrorMessage(error) };
  }
}

export async function copyLegacyLlmFeatureAdminAction(scope: LlmScope) {
  try {
    const { userId } = await requireSuperAdmin();
    const parsedScope = llmScopeSchema.parse(scope);
    const current = await getScopedLlmConfig(parsedScope, true);
    if (current.source !== "legacy" || !current.apiKey) {
      throw new LlmSettingsError("Tidak ada konfigurasi lama yang dapat disalin untuk fitur ini.");
    }
    const { apiKey, source: _source, ...config } = current;
    const input = scopedLlmInputSchema.parse({ scope: parsedScope, config, apiKey });
    return { success: true as const, data: await persistFeature(input, userId, true) };
  } catch (error) {
    return { success: false as const, error: settingsErrorMessage(error) };
  }
}

/** Explicit draft test; no settings write and no real application tool execution. */
export async function testLlmConnectionAdminAction(payload: ScopedLlmInput) {
  try {
    await requireSuperAdmin();
    const input = scopedLlmInputSchema.parse(payload);
    const apiKey = input.apiKey || retainedKey(await getScopedLlmConfig(input.scope, true), input);
    await resolveLlmEndpoint(input.config.baseURL);
    const model = input.config.provider === "google"
      ? createGoogleGenerativeAI({ apiKey, fetch: (url, init) => fetch(url, { ...init, redirect: "error" }) })(input.config.model)
      : createOpenAICompatible({
          name: "scoped-connection-test", apiKey, baseURL: input.config.baseURL,
          fetch: createLlmEndpointFetch(input.config.baseURL),
        })(input.config.model);
    const start = Date.now();
    const response = await generateText({
      model,
      prompt: input.scope === "agent"
        ? "Call connection_check with status OK. This is a harmless connectivity test."
        : "Reply with OK. This is a connectivity test.",
      maxOutputTokens: 128, maxRetries: 0,
      abortSignal: AbortSignal.timeout(20_000),
      ...(input.scope === "agent" ? {
        tools: { connection_check: tool({
          description: "Harmless connectivity check; no data access or changes.",
          inputSchema: z.object({ status: z.literal("OK") }),
        }) },
        toolChoice: { type: "tool" as const, toolName: "connection_check" },
      } : {}),
    });
    if (input.scope === "agent" && !response.toolCalls?.some((call) => call.toolName === "connection_check")) {
      return { success: false as const, error: "Koneksi tersedia, tetapi dukungan tool calling Agent belum terverifikasi." };
    }
    if (input.scope === "ai-studio" && !response.text.trim()) {
      return { success: false as const, error: "Provider tidak menghasilkan teks. Periksa Model ID." };
    }
    return { success: true as const, latencyMs: Date.now() - start,
      message: input.scope === "agent" ? "Koneksi dan tool calling Agent berhasil." : "Koneksi AI Studio berhasil." };
  } catch (error) {
    console.error("[LLM Test Connection Error]:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return { success: false as const, error: error instanceof LlmSettingsError || error instanceof z.ZodError
      ? settingsErrorMessage(error)
      : `Tes gagal: ${detail.slice(0, 180)}` };
  }
}
