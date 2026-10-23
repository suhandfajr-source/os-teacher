import { prisma } from "@/lib/auth";
import { getEffectiveAiDailyLimit } from "@/modules/system-settings/system-settings.service";

/**
 * Kuota pemakaian AI harian (Story #5b) — SATU jatah gabungan untuk semua fitur AI:
 * Klassa Agent (chat), AI Studio (modul ajar/asesmen/rubrik), dan Quiz AI (generate/konversi soal).
 *
 * - Dihitung per teacherProfile per kalender hari WIB (Asia/Jakarta, tanpa DST).
 * - Superadmin (platformRole === "ADMIN") bebas limit.
 * - Limit configurable dari panel Super Admin (SystemSetting "ai_daily_limit"),
 *   fallback env AI_DAILY_LIMIT, default 20.
 */

export interface AiQuotaInfo {
  /** Jumlah pemakaian hari ini (0 untuk exempt). */
  used: number;
  /** Limit hari ini. -1 berarti unlimited (superadmin). */
  limit: number;
  /** true jika user dikecualikan dari limit. */
  exempt: boolean;
}

export class AiQuotaExceededError extends Error {
  readonly used: number;
  readonly limit: number;

  constructor(used: number, limit: number) {
    super(
      `Jatah penggunaan AI harian sudah habis (${used}/${limit}). ` +
        `Jatah direset otomatis setiap pukul 00:00 WIB. ` +
        `Hubungi admin sekolah jika membutuhkan penambahan kuota.`
    );
    this.name = "AiQuotaExceededError";
    this.used = used;
    this.limit = limit;
  }
}

/** Tanggal kalender hari ini dalam WIB, format YYYY-MM-DD. */
export function getWibDateKey(now: Date = new Date()): string {
  // Asia/Jakarta = UTC+7 tetap (tanpa DST) — cukup geser timestamp.
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function isSuperadminTeacherProfile(teacherProfileId: string): Promise<boolean> {
  const profile = await prisma.teacherProfile.findUnique({
    where: { id: teacherProfileId },
    select: { user: { select: { platformRole: true } } },
  });
  return profile?.user?.platformRole === "ADMIN";
}

/** Info kuota tanpa mengubah hitungan. */
export async function getAiQuotaInfo(teacherProfileId: string): Promise<AiQuotaInfo> {
  if (await isSuperadminTeacherProfile(teacherProfileId)) {
    return { used: 0, limit: -1, exempt: true };
  }
  const limit = await getEffectiveAiDailyLimit();
  const row = await prisma.aiUsageCounter.findUnique({
    where: {
      teacherProfileId_usageDate: { teacherProfileId, usageDate: getWibDateKey() },
    },
    select: { count: true },
  });
  return { used: row?.count ?? 0, limit, exempt: false };
}

/**
 * Cek kuota lalu increment 1 pemakaian. Throw `AiQuotaExceededError` jika jatah habis.
 * Dipanggil SEBELUM pemanggilan LLM di setiap entry point AI (chat, generate, refine, quiz).
 */
export async function consumeAiUsage(teacherProfileId: string): Promise<AiQuotaInfo> {
  const info = await getAiQuotaInfo(teacherProfileId);
  if (info.exempt) return info;
  if (info.used >= info.limit) {
    throw new AiQuotaExceededError(info.used, info.limit);
  }
  await prisma.aiUsageCounter.upsert({
    where: {
      teacherProfileId_usageDate: { teacherProfileId, usageDate: getWibDateKey() },
    },
    update: { count: { increment: 1 } },
    create: { teacherProfileId, usageDate: getWibDateKey(), count: 1 },
  });
  return { ...info, used: info.used + 1 };
}
