import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redactMetadata } from "@/lib/audit-metadata";
import type { Prisma } from "@prisma/client";

/**
 * Story 5 — pelunasan deferred work Story 1 (kontrak terkeras hasil elicitation):
 *
 * - Deny-by-default, strict equality `platformRole === "ADMIN"` — nilai asing
 *   seperti `"MODERATOR"` tertolak (bukan pola `!== "USER"`).
 * - Tanpa sesi → denied.
 * - Satu jenis error tunggal `SuperAdminRequiredError` dengan pesan statis
 *   identik di semua jalur (anti-enumerasi).
 * - Baca role via `session.user` dengan fallback `prisma.user.findUnique`.
 * - Tanpa mengubah `src/lib/auth.ts` demi guard ini.
 *
 * Audit `ADMIN_ACCESS_DENIED` (OQ-7, F10, G-9): ditulis DI SINI (runtime Node —
 * Prisma tersedia), BUKAN dari `src/proxy.ts` yang berjalan di edge runtime dan
 * hanya boleh blok/redirect. Dedup 60 detik bersifat best-effort; hanya sesi
 * valid yang ter-audit (bot anonim tidak).
 */

export const SUPERADMIN_STATIC_ERROR_MESSAGE = "Akses ditolak.";

const ADMIN_ACCESS_DENIED_AUDIT_ACTION = "ADMIN_ACCESS_DENIED";
const ACCESS_DENIED_DEDUP_WINDOW_MS = 60_000;

export class SuperAdminRequiredError extends Error {
  constructor() {
    super(SUPERADMIN_STATIC_ERROR_MESSAGE);
    this.name = "SuperAdminRequiredError";
  }
}

/**
 * Inti pengecekan role — strict equality, tanpa fallback longgar.
 * Diekspor terpisah agar unit-testable tanpa `next/headers`.
 */
export function isPlatformAdminRole(platformRole: unknown): boolean {
  return platformRole === "ADMIN";
}

async function auditAccessDeniedOnce(actorId: string): Promise<void> {
  try {
    const dedupWindowStart = new Date(Date.now() - ACCESS_DENIED_DEDUP_WINDOW_MS);
    const recent = await prisma.auditLog.findFirst({
      where: {
        actorType: "USER",
        actorId,
        action: ADMIN_ACCESS_DENIED_AUDIT_ACTION,
        createdAt: { gte: dedupWindowStart },
      },
      select: { id: true },
    });
    if (recent) return; // dedup best-effort (F10) — request konkuren boleh lolos
    await prisma.auditLog.create({
      data: {
        actorType: "USER",
        actorId,
        action: ADMIN_ACCESS_DENIED_AUDIT_ACTION,
        targetType: "ADMIN_AREA",
        metadata: redactMetadata({ reason: "platformRole mismatch" }) as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Audit gagal tidak boleh mengubah keputusan deny — tetap denied.
  }
}

/**
 * Gerbang tunggal semua aksi admin (G-9). Dilarang menyebar pengecekan
 * `platformRole` manual di handler mana pun.
 */
export async function requireSuperAdmin(): Promise<{ userId: string }> {
  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch {
    session = null;
  }

  if (!session?.user?.id) {
    throw new SuperAdminRequiredError();
  }

  const userId = session.user.id;

  // Jalur 1: role dari session.user (bila tersedia di payload sesi).
  const sessionRole = (session.user as { platformRole?: unknown }).platformRole;
  if (isPlatformAdminRole(sessionRole)) {
    return { userId };
  }

  // Jalur 2: fallback baca DB (kontrak deferred work Story 1).
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { platformRole: true },
  });
  if (isPlatformAdminRole(dbUser?.platformRole)) {
    return { userId };
  }

  // Denied — pesan statis identik semua jalur (anti-enumerasi) + audit.
  await auditAccessDeniedOnce(userId);
  throw new SuperAdminRequiredError();
}

/** Single-Admin Lane I4 — apakah pemohon request ini superadmin?
 * Dipakai layout jalur guru ((dashboard)/(onboarding)) untuk melempar admin
 * ke /admin alih-alih menyodorkan wizard onboarding guru. */
export async function isCurrentPlatformAdmin(): Promise<boolean> {
  try {
    await requireSuperAdmin();
    return true;
  } catch {
    return false;
  }
}
