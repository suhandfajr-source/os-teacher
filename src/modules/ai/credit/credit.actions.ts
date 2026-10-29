"use server";

import { prisma } from "@/lib/auth";
import { verifyActiveSchoolMembership } from "@/lib/authorization";
import { encryptSecret } from "@/lib/crypto";
import {
  getTeacherCreditStatus,
  recordAiTokenUsage,
  preCheckAiCredit,
  type TeacherCreditStatus,
} from "./credit.service";
import { resolveLlmEndpoint } from "@/modules/system-settings/llm-endpoint.server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

export async function getTeacherCreditAction(): Promise<{
  success: boolean;
  data?: TeacherCreditStatus;
  error?: string;
}> {
  try {
    const { profile } = await verifyActiveSchoolMembership();
    const data = await getTeacherCreditStatus(profile.id);
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengambil data kredit.",
    };
  }
}

export async function getTeacherCreditLedgerAction(): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    feature: string;
    totalTokens: number;
    creditCost: number;
    modelUsed: string | null;
    isByok: boolean;
    createdAt: string;
  }>;
  error?: string;
}> {
  try {
    const { profile } = await verifyActiveSchoolMembership();
    const rows = await prisma.teacherCreditLedger.findMany({
      where: { teacherProfileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        feature: r.feature,
        totalTokens: r.totalTokens,
        creditCost: r.creditCost,
        modelUsed: r.modelUsed,
        isByok: r.isByok,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengambil riwayat transaksi.",
    };
  }
}

export async function saveTeacherByokAction(payload: {
  provider: "google" | "openai-compatible";
  apiKey: string;
  baseURL?: string;
  customModel?: string;
  isActive: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await verifyActiveSchoolMembership();
    const cleanKey = payload.apiKey.trim();

    // Validasi URL jika OpenAI-compatible
    if (payload.provider === "openai-compatible" && payload.baseURL) {
      await resolveLlmEndpoint(payload.baseURL);
    }

    const existing = await prisma.teacherAiKey.findUnique({
      where: { teacherProfileId: profile.id },
    });

    let encrypted = existing?.encryptedApiKey || "";
    if (cleanKey) {
      encrypted = encryptSecret(cleanKey);
    } else if (!existing) {
      return { success: false, error: "API Key wajib diisi untuk setup baru." };
    }

    await prisma.teacherAiKey.upsert({
      where: { teacherProfileId: profile.id },
      create: {
        teacherProfileId: profile.id,
        provider: payload.provider,
        encryptedApiKey: encrypted,
        baseURL: payload.baseURL?.trim() || null,
        customModel: payload.customModel?.trim() || null,
        isActive: payload.isActive,
      },
      update: {
        provider: payload.provider,
        encryptedApiKey: encrypted,
        baseURL: payload.baseURL?.trim() || null,
        customModel: payload.customModel?.trim() || null,
        isActive: payload.isActive,
      },
    });

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan konfigurasi BYOK.",
    };
  }
}

export async function testTeacherByokConnectionAction(payload: {
  provider: "google" | "openai-compatible";
  apiKey: string;
  baseURL?: string;
  model?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const key = payload.apiKey.trim();
    if (!key) {
      return { success: false, message: "API Key tidak boleh kosong untuk pengujian." };
    }

    if (payload.provider === "google") {
      const google = createGoogleGenerativeAI({ apiKey: key });
      const testModel = payload.model || "gemini-2.5-flash";
      const model = google(testModel);
      const res = await generateText({
        model,
        prompt: "Tes koneksi API Key. Balas hanya satu kata: OK.",
      });
      return {
        success: true,
        message: `Koneksi Gemini (${testModel}) Berhasil! Respon: "${res.text.slice(0, 30).trim()}"`,
      };
    } else {
      const baseURL = payload.baseURL?.trim() || "https://open.bigmodel.cn/api/paas/v4";
      await resolveLlmEndpoint(baseURL);
      const compatible = createOpenAICompatible({
        name: "teacher-byok",
        baseURL,
        apiKey: key,
      });
      const testModel = payload.model || "glm-4-plus";
      const model = compatible(testModel);
      const res = await generateText({
        model,
        prompt: "Tes koneksi API Key. Balas hanya satu kata: OK.",
      });
      return {
        success: true,
        message: `Koneksi OpenAI-Compatible (${testModel}) Berhasil! Respon: "${res.text.slice(0, 30).trim()}"`,
      };
    }
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? `Gagal tes koneksi: ${err.message}` : "Gagal menghubungkan ke penyedia AI.",
    };
  }
}
