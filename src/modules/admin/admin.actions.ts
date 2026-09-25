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

/**
 * Mengambil daftar sekolah dengan filter & pagination untuk Superadmin
 */
export async function listSchoolsAdminAction(params: {
  query?: string;
  statusFilter?: "ALL" | "ACTIVE" | "INACTIVE";
  page?: number;
  pageSize?: number;
}) {
  await requireSuperAdmin();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.SchoolWhereInput = {};
  if (params.query?.trim()) {
    const q = params.query.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { npsn: q },
      { city: { contains: q, mode: "insensitive" } },
    ];
  }

  if (params.statusFilter === "ACTIVE") {
    where.deactivatedAt = null;
  } else if (params.statusFilter === "INACTIVE") {
    where.deactivatedAt = { not: null };
  }

  const [total, schools] = await Promise.all([
    prisma.school.count({ where }),
    prisma.school.findMany({
      where,
      select: {
        id: true,
        name: true,
        npsn: true,
        city: true,
        province: true,
        deactivatedAt: true,
        createdAt: true,
        _count: {
          select: {
            students: true,
            memberships: { where: { status: "ACTIVE" } },
            classes: true,
          },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    success: true,
    data: schools,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Mengambil daftar guru / staf pengajar dengan filter untuk Superadmin
 */
export async function listTeachersAdminAction(params: {
  query?: string;
  schoolId?: string;
  statusFilter?: "ALL" | "ACTIVE" | "BANNED";
  page?: number;
  pageSize?: number;
}) {
  await requireSuperAdmin();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.UserWhereInput = {};

  if (params.query?.trim()) {
    const q = params.query.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  if (params.schoolId && params.schoolId !== "ALL") {
    where.teacherProfile = {
      memberships: {
        some: { schoolId: params.schoolId },
      },
    };
  }

  if (params.statusFilter === "ACTIVE") {
    where.banned = false;
  } else if (params.statusFilter === "BANNED") {
    where.banned = true;
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        role: true,
        banned: true,
        banReason: true,
        createdAt: true,
        teacherProfile: {
          select: {
            id: true,
            preferredName: true,
            activeSchoolId: true,
            memberships: {
              select: {
                id: true,
                status: true,
                workspaceRole: true,
                school: {
                  select: { id: true, name: true, npsn: true, deactivatedAt: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    success: true,
    data: users,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Mengambil daftar siswa dengan filter lengkap untuk Superadmin
 */
export async function listStudentsAdminAction(params: {
  query?: string;
  schoolId?: string;
  classId?: string;
  accountStatus?: "ALL" | "ACTIVE" | "PENDING" | "REJECTED";
  page?: number;
  pageSize?: number;
}) {
  await requireSuperAdmin();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.StudentWhereInput = {};

  if (params.query?.trim()) {
    const q = params.query.trim();
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { nis: { contains: q, mode: "insensitive" } },
      { id: q },
    ];
  }

  if (params.schoolId && params.schoolId !== "ALL") {
    where.schoolId = params.schoolId;
  }

  if (params.classId && params.classId !== "ALL") {
    where.classMemberships = {
      some: { classId: params.classId },
    };
  }

  if (params.accountStatus && params.accountStatus !== "ALL") {
    where.accountStatus = params.accountStatus;
  }

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        nis: true,
        accountStatus: true,
        status: true,
        failedAttempts: true,
        lockedUntil: true,
        lastLoginAt: true,
        createdAt: true,
        school: {
          select: { id: true, name: true },
        },
        classMemberships: {
          select: {
            id: true,
            class: {
              select: { id: true, name: true, gradeLevel: true },
            },
            academicPeriod: {
              select: { id: true, year: true, semester: true, status: true },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
  ]);

  return {
    success: true,
    data: students,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Mengambil daftar kelas / rombel untuk Superadmin
 */
export async function listClassesAdminAction(params: {
  query?: string;
  schoolId?: string;
  gradeLevel?: string;
  page?: number;
  pageSize?: number;
}) {
  await requireSuperAdmin();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.ClassWhereInput = {};

  if (params.query?.trim()) {
    const q = params.query.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { gradeLevel: { contains: q, mode: "insensitive" } },
    ];
  }

  if (params.schoolId && params.schoolId !== "ALL") {
    where.schoolId = params.schoolId;
  }

  if (params.gradeLevel && params.gradeLevel !== "ALL") {
    where.gradeLevel = params.gradeLevel;
  }

  const [total, classes] = await Promise.all([
    prisma.class.count({ where }),
    prisma.class.findMany({
      where,
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        status: true,
        joinCode: true,
        joinCodeLocked: true,
        school: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            classStudents: true,
            teachingContexts: true,
          },
        },
      },
      orderBy: [{ name: "asc" }],
      skip,
      take: pageSize,
    }),
  ]);

  return {
    success: true,
    data: classes,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Hapus / Arsip Sekolah secara aman
 */
export async function deleteOrArchiveSchoolAction(schoolId: string) {
  const { userId } = await requireSuperAdmin();

  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        _count: {
          select: { students: true, teachingContexts: true },
        },
      },
    });

    if (!school) {
      return { success: false, message: "Sekolah tidak ditemukan." };
    }

    // Jika memiliki data kegiatan/siswa, nonaktifkan permanen
    if (school._count.students > 0 || school._count.teachingContexts > 0) {
      await prisma.school.update({
        where: { id: schoolId },
        data: { deactivatedAt: new Date(), npsn: null },
      });
      await writeAudit(prisma, {
        actorType: "SUPERADMIN",
        actorId: userId,
        action: "SCHOOL_ARCHIVED_SAFE",
        targetType: "SCHOOL",
        targetId: schoolId,
        metadata: { name: school.name, reason: "Has related data, deactivated instead of hard delete" },
      });
      return { success: true, message: `Sekolah "${school.name}" dinonaktifkan & diarsipkan dengan aman.` };
    }

    // Jika sekolah kosong, boleh dihapus
    await prisma.school.delete({ where: { id: schoolId } });
    await writeAudit(prisma, {
      actorType: "SUPERADMIN",
      actorId: userId,
      action: "SCHOOL_DELETED",
      targetType: "SCHOOL",
      targetId: schoolId,
      metadata: { name: school.name },
    });

    return { success: true, message: `Sekolah "${school.name}" berhasil dihapus.` };
  } catch (err: unknown) {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * Lepas asosiasi guru dari sekolah
 */
export async function disassociateTeacherMembershipAction(membershipId: string) {
  const { userId } = await requireSuperAdmin();

  try {
    const mem = await prisma.teacherSchoolMembership.findUnique({
      where: { id: membershipId },
      include: {
        teacherProfile: { include: { user: true } },
        school: true,
      },
    });

    if (!mem) return { success: false, message: "Keanggotaan guru tidak ditemukan." };

    await prisma.teacherSchoolMembership.delete({ where: { id: membershipId } });

    await writeAudit(prisma, {
      actorType: "SUPERADMIN",
      actorId: userId,
      action: "TEACHER_MEMBERSHIP_REMOVED",
      targetType: "TEACHER_MEMBERSHIP",
      targetId: membershipId,
      metadata: {
        teacherUserId: mem.teacherProfile.userId,
        teacherEmail: mem.teacherProfile.user.email,
        schoolName: mem.school.name,
      },
    });

    return { success: true, message: `Guru berhasil dilepas dari keanggotaan ${mem.school.name}.` };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * Hapus Akun Guru (dengan guard superadmin & audit)
 */
export async function deleteTeacherAccountAction(userIdToDelete: string) {
  const { userId } = await requireSuperAdmin();

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: userIdToDelete },
      select: { id: true, email: true, platformRole: true },
    });

    if (!targetUser) return { success: false, message: "User tidak ditemukan." };
    if (targetUser.platformRole === "ADMIN") {
      return { success: false, message: "Tidak dapat menghapus akun SUPERADMIN." };
    }

    // Revoke sesi terlebih dahulu
    await prisma.session.deleteMany({ where: { userId: userIdToDelete } });
    await prisma.user.delete({ where: { id: userIdToDelete } });

    await writeAudit(prisma, {
      actorType: "SUPERADMIN",
      actorId: userId,
      action: "TEACHER_ACCOUNT_DELETED",
      targetType: "USER",
      targetId: userIdToDelete,
      metadata: { email: targetUser.email },
    });

    return { success: true, message: `Akun guru (${targetUser.email}) berhasil dihapus.` };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * Pindahkan siswa ke kelas / rombel lain
 */
export async function transferStudentClassAction(studentId: string, targetClassId: string) {
  const { userId } = await requireSuperAdmin();

  try {
    const [student, targetClass] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        include: { classMemberships: true },
      }),
      prisma.class.findUnique({
        where: { id: targetClassId },
        include: {
          school: {
            include: {
              academicPeriods: { where: { status: "ACTIVE" }, take: 1 },
            },
          },
        },
      }),
    ]);

    if (!student || !targetClass) {
      return { success: false, message: "Data siswa atau kelas target tidak valid." };
    }

    const activePeriod = targetClass.school.academicPeriods[0];
    if (!activePeriod) {
      return { success: false, message: "Sekolah kelas tujuan belum memiliki periode akademik aktif." };
    }

    await prisma.$transaction(async (tx) => {
      // Update schoolId siswa jika pindah sekolah
      if (student.schoolId !== targetClass.schoolId) {
        await tx.student.update({
          where: { id: studentId },
          data: { schoolId: targetClass.schoolId },
        });
      }

      // Hapus enrollment lama di periode yang sama
      await tx.classStudent.deleteMany({
        where: { studentId, academicPeriodId: activePeriod.id },
      });

      // Buat enrollment baru
      await tx.classStudent.create({
        data: {
          studentId,
          classId: targetClassId,
          academicPeriodId: activePeriod.id,
        },
      });

      await writeAudit(tx, {
        actorType: "SUPERADMIN",
        actorId: userId,
        action: "STUDENT_CLASS_TRANSFERRED_ADMIN",
        targetType: "STUDENT",
        targetId: studentId,
        metadata: {
          targetClassId,
          targetClassName: targetClass.name,
          schoolId: targetClass.schoolId,
        },
      });
    });

    return { success: true, message: `Siswa berhasil dipindahkan ke kelas ${targetClass.name}.` };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * Hapus data siswa oleh superadmin
 */
export async function deleteStudentAdminAction(studentId: string) {
  const { userId } = await requireSuperAdmin();

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, nis: true, schoolId: true },
    });

    if (!student) return { success: false, message: "Siswa tidak ditemukan." };

    await prisma.student.delete({ where: { id: studentId } });

    await writeAudit(prisma, {
      actorType: "SUPERADMIN",
      actorId: userId,
      action: "STUDENT_DELETED_ADMIN",
      targetType: "STUDENT",
      targetId: studentId,
      metadata: { fullName: student.fullName, nis: student.nis, schoolId: student.schoolId },
    });

    return { success: true, message: `Siswa "${student.fullName}" berhasil dihapus.` };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * Tambah Kelas baru oleh Superadmin
 */
export async function createClassAdminAction(params: {
  schoolId: string;
  name: string;
  gradeLevel?: string;
}) {
  const { userId } = await requireSuperAdmin();

  const cleanName = params.name?.trim();
  if (!cleanName) return { success: false, message: "Nama kelas wajib diisi." };

  try {
    const normalizedName = cleanName.toLowerCase().replace(/\s+/g, "");
    const created = await prisma.class.create({
      data: {
        schoolId: params.schoolId,
        name: cleanName,
        normalizedName,
        gradeLevel: params.gradeLevel?.trim() || null,
      },
    });

    await writeAudit(prisma, {
      actorType: "SUPERADMIN",
      actorId: userId,
      action: "CLASS_CREATED_ADMIN",
      targetType: "CLASS",
      targetId: created.id,
      metadata: { name: cleanName, schoolId: params.schoolId },
    });

    return { success: true, message: `Kelas "${cleanName}" berhasil dibuat.` };
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002") {
      return { success: false, message: "Kelas dengan nama ini sudah ada di sekolah tersebut." };
    }
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * Update data Kelas oleh Superadmin
 */
export async function updateClassAdminAction(params: {
  classId: string;
  name: string;
  gradeLevel?: string;
}) {
  const { userId } = await requireSuperAdmin();

  const cleanName = params.name?.trim();
  if (!cleanName) return { success: false, message: "Nama kelas wajib diisi." };

  try {
    const normalizedName = cleanName.toLowerCase().replace(/\s+/g, "");
    await prisma.class.update({
      where: { id: params.classId },
      data: {
        name: cleanName,
        normalizedName,
        gradeLevel: params.gradeLevel?.trim() || null,
      },
    });

    await writeAudit(prisma, {
      actorType: "SUPERADMIN",
      actorId: userId,
      action: "CLASS_UPDATED_ADMIN",
      targetType: "CLASS",
      targetId: params.classId,
      metadata: { name: cleanName },
    });

    return { success: true, message: `Kelas berhasil diperbarui.` };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * Hapus Kelas oleh Superadmin
 */
export async function deleteClassAdminAction(classId: string) {
  const { userId } = await requireSuperAdmin();

  try {
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        _count: {
          select: { classStudents: true, teachingContexts: true },
        },
      },
    });

    if (!cls) return { success: false, message: "Kelas tidak ditemukan." };

    if (cls._count.classStudents > 0 || cls._count.teachingContexts > 0) {
      return {
        success: false,
        message: `Kelas "${cls.name}" tidak dapat dihapus karena masih memiliki ${cls._count.classStudents} siswa atau aktivitas belajar.`,
      };
    }

    await prisma.class.delete({ where: { id: classId } });

    await writeAudit(prisma, {
      actorType: "SUPERADMIN",
      actorId: userId,
      action: "CLASS_DELETED_ADMIN",
      targetType: "CLASS",
      targetId: classId,
      metadata: { name: cls.name },
    });

    return { success: true, message: `Kelas "${cls.name}" berhasil dihapus.` };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * Detailing Data Sekolah untuk Superadmin
 */
export async function getSchoolDetailAdminAction(schoolId: string) {
  await requireSuperAdmin();

  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        academicPeriods: {
          orderBy: [{ year: "desc" }, { semester: "desc" }],
        },
        classes: {
          include: {
            _count: { select: { classStudents: true, teachingContexts: true } },
          },
          orderBy: { name: "asc" },
        },
        memberships: {
          include: {
            teacherProfile: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, banned: true, platformRole: true },
                },
                teachingContexts: {
                  where: { class: { schoolId } },
                  include: { subject: true, class: true },
                },
              },
            },
          },
        },
        students: {
          take: 50,
          orderBy: { fullName: "asc" },
          include: {
            classMemberships: {
              include: { class: true },
            },
          },
        },
        _count: {
          select: { students: true, classes: true, memberships: true, aiContentDrafts: true },
        },
      },
    });

    if (!school) return { success: false, message: "Sekolah tidak ditemukan." };
    return { success: true, data: school };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * Detailing Data Guru untuk Superadmin
 */
export async function getTeacherDetailAdminAction(userId: string) {
  await requireSuperAdmin();

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        banned: true,
        createdAt: true,
        teacherProfile: {
          include: {
            memberships: {
              include: {
                school: { select: { id: true, name: true, npsn: true, deactivatedAt: true } },
              },
            },
            teachingContexts: {
              include: {
                subject: true,
                class: {
                  include: {
                    school: { select: { id: true, name: true } },
                    _count: { select: { classStudents: true } },
                  },
                },
                academicPeriod: true,
                _count: { select: { teachingSessions: true, assessments: true } },
              },
            },
            aiContentDrafts: {
              take: 10,
              orderBy: { createdAt: "desc" },
              select: { id: true, title: true, topic: true, contentType: true, modelUsed: true, createdAt: true },
            },
          },
        },
      },
    });

    if (!user) return { success: false, message: "Pengguna / guru tidak ditemukan." };
    return { success: true, data: user };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * Detailing Data Siswa untuk Superadmin
 */
export async function getStudentDetailAdminAction(studentId: string) {
  await requireSuperAdmin();

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        school: { select: { id: true, name: true, npsn: true } },
        classMemberships: {
          include: {
            class: true,
            academicPeriod: true,
          },
        },
        attendanceRecords: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: {
            teachingSession: {
              include: {
                teachingContext: {
                  include: { subject: true },
                },
              },
            },
          },
        },
        assessmentResults: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: {
            assessment: {
              include: {
                teachingContext: {
                  include: { subject: true },
                },
              },
            },
          },
        },
      },
    });

    if (!student) return { success: false, message: "Data siswa tidak ditemukan." };
    return { success: true, data: student };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * Detailing Data Kelas untuk Superadmin
 */
export async function getClassDetailAdminAction(classId: string) {
  await requireSuperAdmin();

  try {
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        school: { select: { id: true, name: true, npsn: true } },
        classStudents: {
          include: {
            student: {
              select: { id: true, fullName: true, nis: true, accountStatus: true, accessPinHash: true },
            },
          },
          orderBy: { student: { fullName: "asc" } },
        },
        teachingContexts: {
          include: {
            subject: true,
            academicPeriod: true,
            teacherProfile: {
              include: {
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!cls) return { success: false, message: "Kelas tidak ditemukan." };
    return { success: true, data: cls };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * Ambil Statistik AI & Token untuk Superadmin
 */
export async function getAiUsageStatsAdminAction(schoolIdFilter?: string) {
  await requireSuperAdmin();
  try {
    const { getAiUsageStatsAdmin } = await import("./admin-stats.service");
    const stats = await getAiUsageStatsAdmin(schoolIdFilter === "ALL" ? undefined : schoolIdFilter);
    return { success: true, data: stats };
  } catch {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }
}


