"use server";

import { prisma } from "@/lib/auth";
import { verifyActiveSchoolMembership } from "@/lib/authorization";
import { redactMetadata } from "@/lib/audit-metadata";
import { validatePinFormat, hashPin, verifyPin } from "@/lib/student-pin";
import {
  notifySchoolTeachers,
  countUnreadNotifications,
  listNotifications,
  markNotificationsRead,
} from "@/modules/notifications/notifications.service";
import type { Prisma } from "@prisma/client";

/**
 * Story 5 — Panel Persetujuan Guru (CAP-4, CAP-7, B2, N5, N6, F1, F5, F8, F12,
 * OQ-1, OQ-2, OQ-4, G-1, G-2, G-7, G-8).
 *
 * Invariant kunci (lihat spec):
 * - Semua transisi status memakai conditional update `updateMany` berkondisi
 *   `accountStatus` lama + cek `count` (F5) — kebal race.
 * - Batch approve: satu `$transaction`, skip-baris-gagal + laporan (OQ-2),
 *   cap 100 baris server-side (G-8), `AuditLog` per-baris sukses (N6),
 *   satu notifikasi ringkasan per aksi (F4).
 * - Highlight eskalasi satu-satunya sumber: `Student.accountRequestedAt` (F2).
 * - Pengampu rombel = guru dengan TeachingContext pada rombel tsb di periode
 *   terkait (OQ-1). Kuasa pindah rombel: pengampu sumber ATAU tujuan (F12).
 * - Reset PIN: monopoli pengampu rombel / superadmin (B2), hygiene lengkap (F8),
 *   berlaku juga untuk siswa REJECTED (G-1).
 */

import {
  ESCALATION_L1_HOURS,
  ESCALATION_L2_HOURS,
  BATCH_APPROVE_MAX,
} from "./approvals.constants";

const GENERIC_ACTION_ERROR = "Aksi gagal. Muat ulang halaman dan coba lagi.";

// ---------------------------------------------------------------------------
// Audit helper
// ---------------------------------------------------------------------------

type PrismaTx = Prisma.TransactionClient;

async function writeAudit(
  tx: PrismaTx,
  params: {
    actorType: "USER" | "SUPERADMIN" | "SYSTEM";
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  await tx.auditLog.create({
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

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function escalationHoursSince(requestedAt: Date | null): number | null {
  if (!requestedAt) return null; // data pra-migrasi: tanpa highlight, tetap tampil
  return Math.floor((Date.now() - requestedAt.getTime()) / (60 * 60 * 1000));
}

/** Periode aktif sekolah — service layer WAJIB memvalidasi maksimal satu (BH-14/EC-6). */
async function getActivePeriod(schoolId: string) {
  const periods = await prisma.academicPeriod.findMany({
    where: { schoolId, status: "ACTIVE" },
    select: { id: true, year: true, semester: true },
  });
  if (periods.length === 0) return null;
  if (periods.length > 1) {
    // Data melanggar invariant — gagal keras agar tidak ada panel yang
    // diam-diam ter-scope ke periode yang salah.
    throw new Error("MULTIPLE_ACTIVE_PERIODS");
  }
  return periods[0];
}

/** OQ-1: pengampu rombel = guru dengan TeachingContext pada rombel & periode terkait. */
async function isPengampuRombel(teacherProfileId: string, classId: string, academicPeriodId: string) {
  const count = await prisma.teachingContext.count({
    where: { teacherProfileId, classId, academicPeriodId },
  });
  return count > 0;
}

/** Row ClassStudent siswa: prioritaskan periode aktif, fallback row terbaru. */
async function getStudentEnrollment(
  studentId: string,
  activePeriodId?: string | null,
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  const rows = await db.classStudent.findMany({
    where: { studentId },
    include: {
      class: { select: { id: true, name: true, schoolId: true } },
      academicPeriod: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (rows.length === 0) return null;
  if (activePeriodId) {
    const inActive = rows.find((r) => r.academicPeriodId === activePeriodId);
    if (inActive) return inActive;
  }
  return rows[0];
}

// ---------------------------------------------------------------------------
// Panel queries
// ---------------------------------------------------------------------------

export interface PendingStudentView {
  studentId: string;
  fullName: string;
  nis: string | null;
  classId: string;
  className: string;
  academicPeriodId: string;
  academicPeriodLabel: string;
  accountRequestedAt: string | null;
  escalationHours: number | null;
  escalated: boolean;
  reason: "MISMATCH_NAME" | "NEW_STUDENT" | "UNKNOWN";
}

function toPendingView(
  row: {
    student: {
      id: string;
      fullName: string;
      nis: string | null;
      accountRequestedAt: Date | null;
    };
    class: { id: string; name: string };
    academicPeriod: { id: string; year: string; semester: string };
  },
  thresholdHours: number
): PendingStudentView {
  const hours = escalationHoursSince(row.student.accountRequestedAt);
  return {
    studentId: row.student.id,
    fullName: row.student.fullName,
    nis: row.student.nis,
    classId: row.class.id,
    className: row.class.name,
    academicPeriodId: row.academicPeriod.id,
    academicPeriodLabel: `${row.academicPeriod.year} — ${row.academicPeriod.semester}`,
    accountRequestedAt: row.student.accountRequestedAt?.toISOString() ?? null,
    escalationHours: hours,
    escalated: hours !== null && hours > thresholdHours,
    reason: "UNKNOWN",
  };
}

const PENDING_INCLUDE = {
  student: {
    select: {
      id: true,
      fullName: true,
      nis: true,
      accountRequestedAt: true,
      status: true,
      accountStatus: true,
    },
  },
  class: { select: { id: true, name: true } },
  academicPeriod: { select: { id: true, year: true, semester: true } },
} as const;

/**
 * Panel L1 per-rombel — hanya pengampu rombel (OQ-1), scope periode aktif.
 * Highlight eskalasi >48 jam (F2).
 */
export async function getPendingStudentsForClassAction(classId: string) {
  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();
  const activePeriod = await getActivePeriod(activeSchoolId);
  if (!activePeriod) {
    return { success: true, pending: [], escalatedThresholdHours: ESCALATION_L1_HOURS, note: "NO_ACTIVE_PERIOD" };
  }

  // Verifikasi kuasa pengampu server-side (matrix: "Guru bukan pengampu").
  const pengampu = await isPengampuRombel(profile.id, classId, activePeriod.id);
  if (!pengampu) {
    return { success: false, pending: [], escalatedThresholdHours: ESCALATION_L1_HOURS, note: "NOT_PENGAMPU" };
  }

  const rows = await prisma.classStudent.findMany({
    where: {
      classId,
      academicPeriodId: activePeriod.id,
      student: { accountStatus: "PENDING", status: "ACTIVE", schoolId: activeSchoolId },
    },
    include: PENDING_INCLUDE,
    orderBy: [{ student: { accountRequestedAt: "asc" } }],
  });

  return {
    success: true,
    pending: rows.map((r) => toPendingView(r, ESCALATION_L1_HOURS)),
    escalatedThresholdHours: ESCALATION_L1_HOURS,
  };
}

/**
 * Panel L2 sekolah-wide — semua guru sekolah, TANPA filter periode (G-7).
 * Highlight eskalasi >7 hari (F2).
 */
export async function getPendingStudentsForSchoolAction() {
  const { activeSchoolId } = await verifyActiveSchoolMembership();

  const rows = await prisma.classStudent.findMany({
    where: {
      class: { schoolId: activeSchoolId },
      student: { accountStatus: "PENDING", status: "ACTIVE" },
    },
    include: PENDING_INCLUDE,
    orderBy: [{ student: { accountRequestedAt: "asc" } }],
  });

  return {
    success: true,
    pending: rows.map((r) => toPendingView(r, ESCALATION_L2_HOURS)),
    escalatedThresholdHours: ESCALATION_L2_HOURS,
  };
}

// ---------------------------------------------------------------------------
// Approve / Reject (L1/L2 — guru sekolah; conditional update F5)
// ---------------------------------------------------------------------------

/**
 * Approve satu siswa PENDING. Kuasa: guru sekolah (L1 bila pengampu rombelnya,
 * L2 bila bukan — tangga CAP-4). Approve L2 memicu notifikasi ringkasan (B2/F4).
 */
export async function approveStudentAction(studentId: string) {
  const { session, profile, activeSchoolId } = await verifyActiveSchoolMembership();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, schoolId: activeSchoolId },
        select: { id: true, accountStatus: true },
      });
      if (!student || student.accountStatus !== "PENDING") return null;

      const activePeriod = await tx.academicPeriod.findFirst({
        where: { schoolId: activeSchoolId, status: "ACTIVE" },
        select: { id: true },
      });
      // EC-7: preferensikan row periode aktif agar level L1/L2 akurat.
      const enrollment = await getStudentEnrollment(studentId, activePeriod?.id ?? null, tx);
      const approvalLevel =
        enrollment && (await isPengampuRombel(profile.id, enrollment.classId, enrollment.academicPeriodId))
          ? "L1"
          : "L2";

      // Conditional update (F5) — kalah race → count 0 → dilaporkan generik.
      const updated = await tx.student.updateMany({
        where: { id: studentId, accountStatus: "PENDING" },
        data: {
          accountStatus: "ACTIVE",
          approvedById: session.user.id,
          approvedAt: new Date(),
          accountRequestedAt: null, // F2
        },
      });
      if (updated.count !== 1) return null;

      await writeAudit(tx, {
        actorType: "USER",
        actorId: session.user.id,
        action: "STUDENT_ACCOUNT_APPROVED",
        targetType: "STUDENT",
        targetId: studentId,
        metadata: {
          approvalLevel,
          classId: enrollment?.classId ?? null,
          batch: false,
        },
      });

      return { approvalLevel, classId: enrollment?.classId ?? null };
    });

    if (!result) {
      return { success: false, message: GENERIC_ACTION_ERROR };
    }

    // Notifikasi ringkasan B2/F4 — hanya untuk approve L2 (eskalasi antar-guru).
    // EC-8: approval SUDAH commit — kegagalan notifikasi tidak boleh
    // mengubah hasil aksi menjadi gagal (memicu retry yang mustahil).
    if (result.approvalLevel === "L2") {
      await notifySchoolTeachers({
        schoolId: activeSchoolId,
        type: "STUDENT_APPROVAL_L2",
        payload: {
          title: "Siswa disetujui (eskalasi L2)",
          body: "Seorang guru sekolah menyetujui 1 akun siswa pending.",
          count: 1,
          link: "/persetujuan",
        },
        excludeUserId: session.user.id,
      }).catch(() => {
        /* best-effort — approval tetap sukses */
      });
    }

    return { success: true, approvalLevel: result.approvalLevel };
  } catch {
    return { success: false, message: GENERIC_ACTION_ERROR };
  }
}

/** Reject satu siswa PENDING dengan alasan (tersimpan di metadata AuditLog). */
export async function rejectStudentAction(studentId: string, reason: string) {
  const { session, activeSchoolId } = await verifyActiveSchoolMembership();

  if (!reason || !reason.trim()) {
    return { success: false, message: "Alasan penolakan wajib diisi." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, schoolId: activeSchoolId },
        select: { id: true, accountStatus: true },
      });
      if (!student || student.accountStatus !== "PENDING") return null;

      const updated = await tx.student.updateMany({
        where: { id: studentId, accountStatus: "PENDING" },
        data: {
          accountStatus: "REJECTED",
          accountRequestedAt: null, // F2
          approvedById: null,
          approvedAt: null,
        },
      });
      if (updated.count !== 1) return null;

      await writeAudit(tx, {
        actorType: "USER",
        actorId: session.user.id,
        action: "STUDENT_ACCOUNT_REJECTED",
        targetType: "STUDENT",
        targetId: studentId,
        metadata: { reason: reason.trim().slice(0, 256) },
      });

      return true;
    });

    if (!result) {
      return { success: false, message: GENERIC_ACTION_ERROR };
    }
    return { success: true };
  } catch {
    return { success: false, message: GENERIC_ACTION_ERROR };
  }
}

/**
 * Batch approve (N6, OQ-2, G-8): satu `$transaction`, baris kalah race di-skip
 * + dilaporkan, `AuditLog` per-baris sukses, satu notifikasi ringkasan.
 */
export async function batchApproveStudentsAction(studentIds: string[]) {
  const { session, profile, activeSchoolId } = await verifyActiveSchoolMembership();

  // G-8: cap 100 baris divalidasi server-side — lebih dari itu tolak generik + audit.
  if (!Array.isArray(studentIds) || studentIds.length === 0 || studentIds.length > BATCH_APPROVE_MAX) {
    try {
      await writeAudit(prisma, {
        actorType: "USER",
        actorId: session.user.id,
        action: "BATCH_APPROVE_LIMIT_REJECTED",
        targetType: "STUDENT",
        targetId: null,
        metadata: { requestedCount: Array.isArray(studentIds) ? studentIds.length : null },
      });
    } catch {
      /* audit best-effort */
    }
    return {
      success: false,
      message: `Batch approve maksimal ${BATCH_APPROVE_MAX} siswa per aksi.`,
      approvedCount: 0,
      failed: [],
    };
  }

  const approved: string[] = [];
  const failed: { studentId: string }[] = [];
  let anyL2 = false;

  try {
    await prisma.$transaction(async (tx) => {
      const activePeriod = await tx.academicPeriod.findFirst({
        where: { schoolId: activeSchoolId, status: "ACTIVE" },
        select: { id: true },
      });

      for (const studentId of studentIds) {
        const student = await tx.student.findFirst({
          where: { id: studentId, schoolId: activeSchoolId, accountStatus: "PENDING" },
          select: { id: true },
        });
        if (!student) {
          failed.push({ studentId });
          continue;
        }

        // BH-2: level per-baris — batch pengampu atas rombelnya sendiri adalah
        // L1 dan TIDAK memicu notifikasi sekolah.
        const enrollment = await getStudentEnrollment(studentId, activePeriod?.id ?? null, tx);
        const level: "L1" | "L2" =
          enrollment && (await isPengampuRombel(profile.id, enrollment.classId, enrollment.academicPeriodId))
            ? "L1"
            : "L2";
        if (level === "L2") anyL2 = true;

        const updated = await tx.student.updateMany({
          where: { id: studentId, accountStatus: "PENDING" },
          data: {
            accountStatus: "ACTIVE",
            approvedById: session.user.id,
            approvedAt: new Date(),
            accountRequestedAt: null,
          },
        });

        if (updated.count !== 1) {
          failed.push({ studentId }); // kalah race (F5) — dilaporkan, tanpa write senyap
          continue;
        }

        approved.push(studentId);
        await writeAudit(tx, {
          actorType: "USER",
          actorId: session.user.id,
          action: "STUDENT_ACCOUNT_APPROVED",
          targetType: "STUDENT",
          targetId: studentId,
          metadata: { batch: true, batchOf: studentIds.length, approvalLevel: level },
        });
      }
    });
  } catch {
    return {
      success: false,
      message: GENERIC_ACTION_ERROR,
      approvedCount: 0,
      failed: studentIds.map((id) => ({ studentId: id })),
    };
  }

  // Satu notifikasi ringkasan per aksi (F4) — bukan per-baris; hanya bila
  // ada baris L2 (BH-2). EC-9: best-effort — baris sudah commit.
  if (approved.length > 0 && anyL2) {
    await notifySchoolTeachers({
      schoolId: activeSchoolId,
      type: "STUDENT_APPROVAL_L2",
      payload: {
        title: "Siswa disetujui (batch)",
        body: `${approved.length} akun siswa pending telah disetujui.`,
        count: approved.length,
        link: "/persetujuan",
      },
      excludeUserId: session.user.id,
    }).catch(() => {
      /* best-effort — batch tetap sukses */
    });
  }

  return {
    success: approved.length > 0,
    approvedCount: approved.length,
    approved,
    failed,
  };
}

/**
 * L1 lintas-rombel untuk tab "Menunggu Persetujuan" di Daftar Siswa:
 * seluruh siswa PENDING pada rombel-rombel yang diampu guru di periode aktif.
 */
export async function getPendingStudentsForMyClassesAction() {
  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();
  const activePeriod = await getActivePeriod(activeSchoolId);
  if (!activePeriod) {
    return { success: true, pending: [], escalatedThresholdHours: ESCALATION_L1_HOURS, note: "NO_ACTIVE_PERIOD" };
  }

  const contexts = await prisma.teachingContext.findMany({
    where: { teacherProfileId: profile.id, academicPeriodId: activePeriod.id },
    select: { classId: true, class: { select: { id: true, name: true } } },
  });
  const classIds = [...new Set(contexts.map((c) => c.classId))];
  if (classIds.length === 0) {
    return { success: true, pending: [], escalatedThresholdHours: ESCALATION_L1_HOURS };
  }

  const rows = await prisma.classStudent.findMany({
    where: {
      classId: { in: classIds },
      academicPeriodId: activePeriod.id,
      student: { accountStatus: "PENDING", status: "ACTIVE", schoolId: activeSchoolId },
    },
    include: PENDING_INCLUDE,
    orderBy: [{ student: { accountRequestedAt: "asc" } }],
  });

  return {
    success: true,
    pending: rows.map((r) => toPendingView(r, ESCALATION_L1_HOURS)),
    escalatedThresholdHours: ESCALATION_L1_HOURS,
  };
}

/**
 * Daftar rombel sekolah (periode aktif) untuk dialog pindah rombel.
 */
export async function getSchoolClassesForMoveAction() {
  const { activeSchoolId } = await verifyActiveSchoolMembership();
  const activePeriod = await getActivePeriod(activeSchoolId);
  if (!activePeriod) return { success: true, classes: [] };

  const classes = await prisma.class.findMany({
    where: {
      schoolId: activeSchoolId,
      teachingContexts: { some: { academicPeriodId: activePeriod.id } },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return { success: true, classes };
}

// ---------------------------------------------------------------------------
// Pindah rombel (N5, F12) & Reset PIN (B2, OQ-4, F8, G-1)
// ---------------------------------------------------------------------------

/**
 * Pindah rombel siswa PENDING: UPDATE `classId` pada row `ClassStudent` existing
 * (N5) — bukan delete-insert. Kuasa: pengampu rombel sumber ATAU tujuan (F12).
 * Target wajib rombel sekolah sama yang terhubung periode aktif (G-7).
 */
export async function moveStudentClassAction(studentId: string, targetClassId: string) {
  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();
  const activePeriod = await getActivePeriod(activeSchoolId);
  if (!activePeriod) {
    return { success: false, message: GENERIC_ACTION_ERROR };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, schoolId: activeSchoolId },
        select: { id: true, accountStatus: true },
      });
      if (!student || student.accountStatus !== "PENDING") return { ok: false as const };

      const sourceRow = await getStudentEnrollment(studentId, null, tx);
      if (!sourceRow) return { ok: false as const };

      const targetClass = await tx.class.findFirst({
        where: {
          id: targetClassId,
          schoolId: activeSchoolId,
          teachingContexts: { some: { academicPeriodId: activePeriod.id } },
        },
        select: { id: true },
      });
      if (!targetClass) return { ok: false as const };

      // F12: kuasa = pengampu sumber (periode row sumber) ATAU pengampu tujuan (periode aktif).
      const sourcePengampu = await isPengampuRombel(profile.id, sourceRow.classId, sourceRow.academicPeriodId);
      const targetPengampu = await isPengampuRombel(profile.id, targetClassId, activePeriod.id);
      if (!sourcePengampu && !targetPengampu) return { ok: false as const };

      if (sourceRow.academicPeriodId === activePeriod.id) {
        // N5 — row periode aktif: UPDATE classId saja; @@unique terjaga.
        const updated = await tx.classStudent.updateMany({
          where: { id: sourceRow.id },
          data: { classId: targetClassId },
        });
        if (updated.count !== 1) return { ok: false as const };
      } else {
        // EC-10: row periode LAMPAU (pending lintas-periode, G-7) tidak boleh
        // dimutasi classId-nya — jadi row lama+kelas baru yang inkoheren.
        // Yang benar: siswa memperoleh row enrollmen periode aktif di rombel
        // tujuan (@@unique([studentId, academicPeriodId]) tidak dilanggar).
        await tx.classStudent.create({
          data: { studentId, classId: targetClassId, academicPeriodId: activePeriod.id },
        });
      }

      await writeAudit(tx, {
        actorType: "USER",
        actorId: profile.userId,
        action: "STUDENT_CLASS_MOVED",
        targetType: "STUDENT",
        targetId: studentId,
        metadata: {
          fromClassId: sourceRow.classId,
          toClassId: targetClassId,
          academicPeriodId: sourceRow.academicPeriodId,
        },
      });

      return { ok: true as const };
    });

    if (!result.ok) {
      return { success: false, message: GENERIC_ACTION_ERROR };
    }
    return { success: true };
  } catch {
    return { success: false, message: GENERIC_ACTION_ERROR };
  }
}

/**
 * Reset PIN siswa (B2, OQ-4, F8, G-1): HANYA pengampu rombel siswa di periode
 * terkait. Jalur superadmin = `forceResetStudentPinAction` di modul admin
 * (satu gerbang requireSuperAdmin). Berlaku untuk siswa PENDING/ACTIVE/REJECTED
 * (G-1 menjadikan reset PIN REJECTED sebagai jalur pulih daftar ulang).
 * Hygiene lengkap dalam satu transaksi (F8); rotasi `pinUpdatedAt` menghanguskan
 * sesi perangkat lain.
 */
export async function resetStudentPinAction(studentId: string, newPin: string) {
  const { session, profile, activeSchoolId } = await verifyActiveSchoolMembership();

  try {
    validatePinFormat(newPin);
  } catch {
    return { success: false, message: "PIN baru harus 4 digit angka." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, schoolId: activeSchoolId },
        select: { id: true, accessPinHash: true, accountStatus: true },
      });
      if (!student) return { ok: false as const };

      // B2: kuasa = pengampu rombel siswa (periode row terkait); superadmin
      // memakai modul admin (forceResetStudentPinAction).
      const enrollment = await getStudentEnrollment(studentId, null, tx);
      let authorized = false;
      if (enrollment) {
        authorized = await isPengampuRombel(profile.id, enrollment.classId, enrollment.academicPeriodId);
      }

      if (!authorized) return { ok: false as const };

      // OQ-4: PIN baru wajib berbeda dari PIN lama.
      if (student.accessPinHash && (await verifyPin(newPin, student.accessPinHash))) {
        return { ok: false as const, samePin: true as const };
      }

      const newHash = await hashPin(newPin);
      const now = new Date();

      // F8 hygiene lengkap dalam satu transaksi.
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
        actorType: "USER",
        actorId: session.user.id,
        action: "STUDENT_PIN_RESET",
        targetType: "STUDENT",
        targetId: studentId,
        metadata: {
          accountStatus: student.accountStatus,
          classId: enrollment?.classId ?? null,
        },
      });

      return { ok: true as const };
    });

    if (!result.ok) {
      if ("samePin" in result && result.samePin) {
        return { success: false, message: "PIN baru tidak boleh sama dengan PIN lama." };
      }
      return { success: false, message: GENERIC_ACTION_ERROR };
    }
    return { success: true };
  } catch {
    return { success: false, message: GENERIC_ACTION_ERROR };
  }
}

// ---------------------------------------------------------------------------
// Notifikasi — badge feed header dashboard (OQ-3)
// ---------------------------------------------------------------------------

export async function getMyNotificationsAction() {
  const { session } = await verifyActiveSchoolMembership();
  const [items, unreadCount] = await Promise.all([
    listNotifications(session.user.id),
    countUnreadNotifications(session.user.id),
  ]);
  return { success: true, items, unreadCount };
}

export async function markMyNotificationsReadAction(ids?: string[]) {
  const { session } = await verifyActiveSchoolMembership();
  const count = await markNotificationsRead(session.user.id, ids);
  return { success: true, count };
}
