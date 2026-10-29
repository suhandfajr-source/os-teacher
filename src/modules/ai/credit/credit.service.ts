import { prisma } from "@/lib/auth";
import { getWibDateKey } from "@/modules/ai/ai-usage.service";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { resolveLlmEndpoint } from "@/modules/system-settings/llm-endpoint.server";

export const TOKENS_PER_CREDIT = 1000;
export const DEFAULT_DAILY_TOKENS = 50000; // 50 kredit/hari

export interface TeacherCreditStatus {
  tokensBalance: number;
  creditsBalance: number;
  dailyAllowanceCredits: number;
  isSuperadmin: boolean;
  hasByok: boolean;
  byokActive: boolean;
  byokProvider?: string;
  byokModel?: string;
  byokMaskedKey?: string;
}

export interface CreditPreCheckResult {
  allowed: boolean;
  useByok: boolean;
  byokConfig?: {
    provider: "google" | "openai-compatible";
    apiKey: string;
    baseURL?: string;
    model?: string;
  };
  reason?: string;
}

/**
 * Cek atau inisialisasi saldo kredit guru + auto-reset harian WIB
 */
export async function getOrInitTeacherCredit(teacherProfileId: string) {
  const today = getWibDateKey();
  let credit = await prisma.teacherCredit.findUnique({
    where: { teacherProfileId },
  });

  if (!credit) {
    credit = await prisma.teacherCredit.create({
      data: {
        teacherProfileId,
        balance: DEFAULT_DAILY_TOKENS,
        dailyAllowance: DEFAULT_DAILY_TOKENS,
        lastResetDate: today,
      },
    });
  } else if (credit.lastResetDate !== today) {
    // Reset harian
    credit = await prisma.teacherCredit.update({
      where: { teacherProfileId },
      data: {
        balance: credit.dailyAllowance,
        lastResetDate: today,
      },
    });
  }

  return credit;
}

/**
 * Mendapatkan status kredit dan status BYOK guru untuk UI Pengaturan
 */
export async function getTeacherCreditStatus(teacherProfileId: string): Promise<TeacherCreditStatus> {
  const profile = await prisma.teacherProfile.findUnique({
    where: { id: teacherProfileId },
    select: {
      user: { select: { platformRole: true } },
      aiKey: true,
    },
  });

  const isSuperadmin = profile?.user?.platformRole === "ADMIN";
  const credit = await getOrInitTeacherCredit(teacherProfileId);
  const byok = profile?.aiKey;

  let maskedKey = "";
  if (byok?.encryptedApiKey) {
    const raw = decryptSecret(byok.encryptedApiKey) || "";
    if (raw.length > 8) {
      maskedKey = `${raw.slice(0, 4)}...${raw.slice(-4)}`;
    } else if (raw.length > 0) {
      maskedKey = "••••••••";
    }
  }

  return {
    tokensBalance: isSuperadmin ? 999999999 : credit.balance,
    creditsBalance: isSuperadmin ? 999999 : Number((credit.balance / TOKENS_PER_CREDIT).toFixed(1)),
    dailyAllowanceCredits: Math.round(credit.dailyAllowance / TOKENS_PER_CREDIT),
    isSuperadmin,
    hasByok: Boolean(byok),
    byokActive: Boolean(byok?.isActive),
    byokProvider: byok?.provider,
    byokModel: byok?.customModel || undefined,
    byokMaskedKey: maskedKey || undefined,
  };
}

/**
 * Pre-Check Saldo Kredit sebelum memanggil LLM:
 * 1. Jika Superadmin -> bebas
 * 2. Jika saldo > 0 -> allowed pakai key sekolah
 * 3. Jika saldo habis (0 / negatif):
 *    - Cek apakah BYOK aktif & valid -> jika ya, jalankan pakai BYOK
 *    - Jika tidak ada BYOK -> tolak dengan pesan edukatif
 */
export async function preCheckAiCredit(teacherProfileId: string): Promise<CreditPreCheckResult> {
  const profile = await prisma.teacherProfile.findUnique({
    where: { id: teacherProfileId },
    select: {
      user: { select: { platformRole: true } },
      aiKey: true,
    },
  });

  if (profile?.user?.platformRole === "ADMIN") {
    return { allowed: true, useByok: false };
  }

  const credit = await getOrInitTeacherCredit(teacherProfileId);

  // Jika saldo kredit sekolah masih mencukupi (minimal 100 token)
  if (credit.balance >= 100) {
    return { allowed: true, useByok: false };
  }

  // Jika kredit habis, periksa alternatif BYOK guru
  const byok = profile?.aiKey;
  if (byok && byok.isActive && byok.encryptedApiKey) {
    const rawKey = decryptSecret(byok.encryptedApiKey);
    if (rawKey) {
      return {
        allowed: true,
        useByok: true,
        byokConfig: {
          provider: byok.provider as "google" | "openai-compatible",
          apiKey: rawKey,
          baseURL: byok.baseURL || undefined,
          model: byok.customModel || undefined,
        },
      };
    }
  }

  return {
    allowed: false,
    useByok: false,
    reason:
      "Kredit AI harian sekolah Anda telah habis (0 Kredit). " +
      "Kredit direset otomatis setiap pukul 00:00 WIB, atau Anda dapat mengaktifkan " +
      "API Key pribadi (BYOK) di Pengaturan Akun untuk terus menggunakan Klassa AI tanpa batas.",
  };
}

/**
 * Post-Deduct: Memotong saldo kredit guru berdasarkan token LLM riil dan mencatat ke Ledger.
 */
export async function recordAiTokenUsage(params: {
  teacherProfileId: string;
  feature: "AGENT" | "AI_STUDIO" | "QUIZ_GEN";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  modelUsed?: string;
  isByok?: boolean;
}) {
  const {
    teacherProfileId,
    feature,
    promptTokens,
    completionTokens,
    totalTokens,
    modelUsed,
    isByok = false,
  } = params;

  const creditCost = Number((totalTokens / TOKENS_PER_CREDIT).toFixed(2));

  // Catat transaksi ke ledger riwayat
  await prisma.teacherCreditLedger.create({
    data: {
      teacherProfileId,
      feature,
      promptTokens,
      completionTokens,
      totalTokens,
      creditCost,
      modelUsed,
      isByok,
    },
  });

  // Jika memakai BYOK, jatah kredit sekolah tidak dipotong
  if (isByok) {
    return;
  }

  // Cek apakah superadmin
  const profile = await prisma.teacherProfile.findUnique({
    where: { id: teacherProfileId },
    select: { user: { select: { platformRole: true } } },
  });

  if (profile?.user?.platformRole === "ADMIN") {
    return;
  }

  // Potong saldo di database
  await prisma.teacherCredit.update({
    where: { teacherProfileId },
    data: {
      balance: {
        decrement: totalTokens,
      },
    },
  });
}
