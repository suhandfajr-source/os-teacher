"use server";

import { prisma, auth } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/superadmin";
import { headers } from "next/headers";

/**
 * EC-1/2/3: endpoint plugin admin menuntut headers sesi aktor (adminMiddleware
 * + requireHeaders). Helper defensif: di server action produksi headers tersedia;
 * di harness test (tanpa request context) undefined — plugin stub tidak peduli,
 * dan tes plugin-real membuat headers sendiri.
 */
async function getActorHeaders(): Promise<Headers | undefined> {
  try {
    return await headers();
  } catch {
    return undefined;
  }
}
import { redactMetadata } from "@/lib/audit-metadata";
import { hashPin, verifyPin } from "@/lib/student-pin";
import type { Prisma } from "@prisma/client";

/**
 * Story 5 — Area backstop superadmin `/admin/*` (CAP-7, B5, F3, F6, F7, G-3,
 * G-4, G-6, G-9, G-11, OQ-8).
 *
 * Invariant kunci:
 * - Semua aksi lewat SATU gerbang `requireSuperAdmin()` (deny-by-default).
 * - Ban/reset password guru wajib revoke SEMUA sesi Better Auth (B5).
 * - Ban ATAU reset password terhadap `platformRole === "ADMIN"` ditolak keras
 *   (F6 + G-3) — recovery superadmin hanya via env allowlist + seeder.
 * - Deaktivasi sekolah: urutan aman tandai → revoke sesi → fail-closed →
 *   clear npsn → AuditLog (B5/F7). Reaktivasi sukses TANPA NPSN (G-6).
 * - `AuditLog` total, metadata bebas PIN/hash/secret (N4) via `redactMetadata()`.
 */

const GENERIC_ADMIN_ERROR = "Aksi admin gagal. Coba lagi.";

type PrismaTx = Prisma.TransactionClient;

async function writeAudit(
  db: PrismaTx | typeof prisma,
  params: {
    actorType: "USER" | "SUPERADMIN" | "STUDENT" | "SYSTEM";
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  await db.auditLog.create({
    data: {
      actorType: params.actorType,
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: redactMetadata(params.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

/**
 * L3 — Force approve siswa PENDING lintas-sekolah (OQ-8).
 * Conditional update (F5); aktor ter-audit sebagai SUPERADMIN.
 */
export async function forceApproveStudentAction(studentId: string) {
  const { userId } = await requireSuperAdmin();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId },
        select: { id: true, accountStatus: true, schoolId: true },
      });
      if (!student || student.accountStatus !== "PENDING") return null;

      const updated = await tx.student.updateMany({
        where: { id: studentId, accountStatus: "PENDING" },
        data: {
          accountStatus: "ACTIVE",
          approvedById: userId,
          approvedAt: new Date(),
          accountRequestedAt: null,
        },
      });
      if (updated.count !== 1) return null;

      await writeAudit(tx, {
        actorType: "SUPERADMIN",
        actorId: userId,
        action: "STUDENT_ACCOUNT_FORCE_APPROVED",
        targetType: "STUDENT",
        targetId: studentId,
        metadata: { schoolId: student.schoolId, approvalLevel: "L3" },
      });

      return true;
    });

    if (!result) return { success: false, message: GENERIC_ADMIN_ERROR };
    return { success: true };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * B5 — Ban guru: blokir login + revoke SEMUA sesi Better Auth aktif (F6, G-11).
 * Target `platformRole === "ADMIN"` ditolak keras (F6).
 */
export async function banTeacherAction(userId: string, reason: string) {
  const { userId: actorId } = await requireSuperAdmin();

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, platformRole: true, banned: true, teacherProfile: { select: { id: true } } },
    });
    if (!target) {
      return { success: false, message: GENERIC_ADMIN_ERROR };
    }

    // F6: superadmin dilarang mem-ban superadmin lain (audit wajib — matrix F6).
    if (target.platformRole === "ADMIN") {
      await writeAudit(prisma, {
        actorType: "SUPERADMIN",
        actorId,
        action: "TEACHER_BAN_DENIED",
        targetType: "USER",
        targetId: userId,
        metadata: { reason: "TARGET_IS_SUPERADMIN" },
      });
      return { success: false, message: GENERIC_ADMIN_ERROR };
    }

    // BH-8: aksi ini "ban guru" — target wajib memiliki TeacherProfile.
    if (!target.teacherProfile) {
      return { success: false, message: GENERIC_ADMIN_ERROR };
    }

    // Plugin admin: set banned + revoke semua sesi aktif milik user (B5).
    // EC-1: endpoint plugin menuntut headers sesi aktor (adminMiddleware +
    // requireHeaders) — tanpa ini selalu UNAUTHORIZED di produksi.
    // G-11: penolakan plugin (mis. role sesi stale) ditangkap jadi pesan generik.
    await auth.api.banUser({
      body: { userId, banReason: reason?.trim().slice(0, 256) || "Diblokir oleh superadmin" },
      headers: await getActorHeaders(),
    });

    await writeAudit(prisma, {
      actorType: "SUPERADMIN",
      actorId,
      action: "TEACHER_BANNED",
      targetType: "USER",
      targetId: userId,
      metadata: { reason: reason?.trim().slice(0, 256) || null },
    });

    return { success: true };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

export async function unbanTeacherAction(userId: string) {
  const { userId: actorId } = await requireSuperAdmin();

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, platformRole: true },
    });
    if (!target || target.platformRole === "ADMIN") {
      return { success: false, message: GENERIC_ADMIN_ERROR };
    }

    await auth.api.unbanUser({ body: { userId }, headers: await getActorHeaders() }); // EC-2: headers wajib

    await writeAudit(prisma, {
      actorType: "SUPERADMIN",
      actorId,
      action: "TEACHER_UNBANNED",
      targetType: "USER",
      targetId: userId,
    });

    return { success: true };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * B5 + G-3 — Reset password guru: password baru berlaku + SEMUA sesi lama
 * di-revoke. Target `platformRole === "ADMIN"` ditolak keras (G-3).
 */
export async function resetTeacherPasswordAction(userId: string, newPassword: string) {
  const { userId: actorId } = await requireSuperAdmin();

  if (!newPassword || newPassword.length < 8) {
    return { success: false, message: "Password baru minimal 8 karakter." };
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, platformRole: true },
    });
    if (!target) {
      return { success: false, message: GENERIC_ADMIN_ERROR };
    }

    // G-3: guard identik dengan ban — superadmin dilarang reset password superadmin lain.
    if (target.platformRole === "ADMIN") {
      await writeAudit(prisma, {
        actorType: "SUPERADMIN",
        actorId,
        action: "TEACHER_PASSWORD_RESET_DENIED",
        targetType: "USER",
        targetId: userId,
        metadata: { reason: "TARGET_IS_SUPERADMIN" },
      });
      return { success: false, message: GENERIC_ADMIN_ERROR };
    }

    // setUserPassword + revoke SEMUA sesi aktif (B5). EC-3: headers wajib.
    // EC-4: kegagalan revoke SETELAH password diganti = partial state — jangan
    // ditelan diam-diam; laporkan eksplisit + audit.
    await auth.api.setUserPassword({ body: { userId, newPassword }, headers: await getActorHeaders() });

    try {
      await auth.api.revokeUserSessions({ body: { userId }, headers: await getActorHeaders() });
    } catch {
      await writeAudit(prisma, {
        actorType: "SUPERADMIN",
        actorId,
        action: "TEACHER_PASSWORD_RESET_PARTIAL",
        targetType: "USER",
        targetId: userId,
        metadata: { note: "password changed but session revocation failed" },
      });
      return {
        success: false,
        message: "Password diganti tetapi pencabutan sesi gagal. Ulangi reset password.",
      };
    }

    await writeAudit(prisma, {
      actorType: "SUPERADMIN",
      actorId,
      action: "TEACHER_PASSWORD_RESET",
      targetType: "USER",
      targetId: userId,
    });

    return { success: true };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * B5 + F7 — Nonaktifkan sekolah dengan urutan aman:
 * (1) tandai nonaktif → (2) revoke sesi guru & parent → (3) fail-closed siswa/
 * portal/parent per-request (via verifyStudentSession & layanan parent yang
 * sudah mengecek deactivatedAt) → (4) clear npsn → (5) AuditLog.
 * Clear npsn SEBELUM status tercatat membuka jendela re-klaim — dilarang.
 */
export async function deactivateSchoolAction(schoolId: string) {
  const { userId } = await requireSuperAdmin();

  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, deactivatedAt: true },
    });
    if (!school) {
      return { success: false, message: GENERIC_ADMIN_ERROR };
    }

    // P1 (elicitation walkthrough): aksi IDEMPOTEN menuju goal-state. Kegagalan
    // di tengah urutan (mis. clear npsn) tidak boleh membuat retry mustahil —
    // panggilan ulang pada sekolah yang sudah nonaktif MENYELESAIKAN langkah
    // tersisa (revoke + clear npsn), bukan menolak dengan pesan generik.
    const firstTransition = !school.deactivatedAt;

    if (firstTransition) {
      const now = new Date();
      // (1) Tandai nonaktif dulu — menutup jendela re-klaim NPSN sejak detik ini.
      await prisma.school.update({
        where: { id: schoolId },
        data: { deactivatedAt: now },
      });
    }

    // (2) Revoke SEMUA sesi Better Auth aktif: guru (membership) + parent (relasi siswa).
    const memberships = await prisma.teacherSchoolMembership.findMany({
      where: { schoolId },
      select: { teacherProfile: { select: { userId: true } } },
    });
    const parentRelations = await prisma.parentStudentRelation.findMany({
      where: { student: { schoolId } },
      select: { parentProfile: { select: { userId: true } } },
    });

    const userIds = [
      ...new Set([
        ...memberships.map((m) => m.teacherProfile.userId),
        ...parentRelations.map((p) => p.parentProfile.userId),
      ]),
    ];

    // (2) Hapus row session langsung = revoke seketika di semua perangkat (B5).
    // EC-5: kegagalan per-user TIDAK ditelan senyap — dicatat di metadata audit;
    // sesi nyasar tetap ter-tutup oleh guard fail-closed per-request (langkah 3).
    const failedRevocations: string[] = [];
    for (const uid of userIds) {
      try {
        await prisma.session.deleteMany({ where: { userId: uid } });
      } catch {
        failedRevocations.push(uid);
      }
    }

    // (4) Clear npsn — NPSN sah dapat dipakai sekolah lain (B5).
    await prisma.school.update({
      where: { id: schoolId },
      data: { npsn: null },
    });

    // (5) AuditLog — langkah (3) fail-closed siswa/portal/parent berjalan
    //     per-request via choke point (verifyStudentSession & layanan parent),
    //     bukan operasi di sini. Audit transisi hanya pada firstTransition;
    //     retry idempoten tidak menulis duplikat.
    if (firstTransition) {
      await writeAudit(prisma, {
        actorType: "SUPERADMIN",
        actorId: userId,
        action: "SCHOOL_DEACTIVATED",
        targetType: "SCHOOL",
        targetId: schoolId,
        metadata: { revokedSessionUserCount: userIds.length, failedRevocations },
      });
    }

    return {
      success: true,
      resumed: !firstTransition,
      revokedSessionUserCount: userIds.length,
    };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * G-6 — Reaktivasi sekolah: sukses TANPA NPSN (`npsn` tetap null).
 * Pengisian NPSN ulang via `setSchoolNpsnAction` yang menangkap konflik
 * `@unique` menjadi pesan generik — tidak pernah P2002 mentah.
 */
export async function reactivateSchoolAction(schoolId: string) {
  const { userId } = await requireSuperAdmin();

  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, deactivatedAt: true },
    });
    if (!school || !school.deactivatedAt) {
      return { success: false, message: GENERIC_ADMIN_ERROR };
    }

    await prisma.school.update({
      where: { id: schoolId },
      data: { deactivatedAt: null, npsn: null }, // G-6: npsn tetap null
    });

    await writeAudit(prisma, {
      actorType: "SUPERADMIN",
      actorId: userId,
      action: "SCHOOL_REACTIVATED",
      targetType: "SCHOOL",
      targetId: schoolId,
      metadata: { npsnRestored: false },
    });

    return { success: true };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/** G-6 — Pengisian NPSN ulang (superadmin): konflik `@unique` → pesan generik. */
export async function setSchoolNpsnAction(schoolId: string, npsn: string) {
  const { userId } = await requireSuperAdmin();

  const cleanNpsn = npsn?.trim();
  if (!cleanNpsn || !/^\d{8}$/.test(cleanNpsn)) {
    return { success: false, message: "NPSN harus 8 digit angka." };
  }

  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, deactivatedAt: true },
    });
    if (!school || school.deactivatedAt) {
      return { success: false, message: GENERIC_ADMIN_ERROR };
    }

    try {
      await prisma.school.update({
        where: { id: schoolId },
        data: { npsn: cleanNpsn },
      });
    } catch (err: unknown) {
      // Konflik `@unique` (NPSN sudah dipakai sekolah lain) → generik, tanpa P2002 mentah.
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        return { success: false, message: "NPSN sudah terdaftar pada sekolah lain." };
      }
      throw err;
    }

    await writeAudit(prisma, {
      actorType: "SUPERADMIN",
      actorId: userId,
      action: "SCHOOL_NPSN_UPDATED",
      targetType: "SCHOOL",
      targetId: schoolId,
    });

    return { success: true };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * L3 — Force reject siswa PENDING lintas-sekolah (pasangan force approve).
 * Conditional update (F5).
 */
export async function forceRejectStudentAction(studentId: string, reason: string) {
  const { userId } = await requireSuperAdmin();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId },
        select: { id: true, accountStatus: true, schoolId: true },
      });
      if (!student || student.accountStatus !== "PENDING") return null;

      const updated = await tx.student.updateMany({
        where: { id: studentId, accountStatus: "PENDING" },
        data: {
          accountStatus: "REJECTED",
          accountRequestedAt: null,
          approvedById: null,
          approvedAt: null,
        },
      });
      if (updated.count !== 1) return null;

      await writeAudit(tx, {
        actorType: "SUPERADMIN",
        actorId: userId,
        action: "STUDENT_ACCOUNT_FORCE_REJECTED",
        targetType: "STUDENT",
        targetId: studentId,
        metadata: { reason: reason?.trim().slice(0, 256) || null, schoolId: student.schoolId },
      });

      return true;
    });

    if (!result) return { success: false, message: GENERIC_ADMIN_ERROR };
    return { success: true };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * Reset PIN siswa oleh superadmin (B2 — jalur superadmin; G-1 jalur pulih
 * REJECTED). Hygiene lengkap (F8), satu transaksi + AuditLog.
 */
export async function forceResetStudentPinAction(studentId: string, newPin: string) {
  const { userId } = await requireSuperAdmin();

  if (!/^\d{4}$/.test(newPin)) {
    return { success: false, message: "PIN baru harus 4 digit angka." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId },
        select: { id: true, accessPinHash: true, accountStatus: true },
      });
      if (!student) return { ok: false as const };

      if (student.accessPinHash && (await verifyPin(newPin, student.accessPinHash))) {
        return { ok: false as const, samePin: true as const };
      }

      const newHash = await hashPin(newPin);
      const now = new Date();

      const updated = await tx.student.updateMany({
        where: { id: studentId },
        data: {
          accessPinHash: newHash,
          pinUpdatedAt: now,
          failedAttempts: 0,
          lockedUntil: null,
        },
      });
      if (updated.count !== 1) return { ok: false as const };

      await writeAudit(tx, {
        actorType: "SUPERADMIN",
        actorId: userId,
        action: "STUDENT_PIN_RESET",
        targetType: "STUDENT",
        targetId: studentId,
        metadata: { accountStatus: student.accountStatus, via: "SUPERADMIN" },
      });

      return { ok: true as const };
    });

    if (!result.ok) {
      if ("samePin" in result && result.samePin) {
        return { success: false, message: "PIN baru tidak boleh sama dengan PIN lama." };
      }
      return { success: false, message: GENERIC_ADMIN_ERROR };
    }
    return { success: true };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * Pencarian user untuk panel admin (by email). Superadmin-only.
 */
export async function lookupUserForAdminAction(email: string) {
  await requireSuperAdmin();

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      id: true,
      name: true,
      email: true,
      platformRole: true,
      role: true,
      banned: true,
      banReason: true,
      banExpires: true,
      teacherProfile: {
        select: {
          id: true,
          activeSchoolId: true,
          memberships: {
            where: { status: "ACTIVE" },
            select: { school: { select: { id: true, name: true, deactivatedAt: true } } },
          },
        },
      },
    },
  });

  if (!user) return { success: false, message: "User tidak ditemukan." };
  return { success: true, user };
}

/**
 * Pencarian sekolah untuk panel admin (by nama/NPSN). Superadmin-only.
 */
export async function lookupSchoolsForAdminAction(query: string) {
  await requireSuperAdmin();

  const clean = query?.trim();
  if (!clean) return { success: true, schools: [] };

  const schools = await prisma.school.findMany({
    where: {
      OR: [
        { name: { contains: clean, mode: "insensitive" } },
        { npsn: clean },
      ],
    },
    select: {
      id: true,
      name: true,
      npsn: true,
      deactivatedAt: true,
      createdAt: true,
      _count: { select: { students: true, memberships: true, classes: true } },
    },
    take: 10,
    orderBy: { name: "asc" },
  });

  return { success: true, schools };
}
