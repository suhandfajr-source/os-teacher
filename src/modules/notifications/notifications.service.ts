import { prisma } from "@/lib/auth";

/**
 * Story 5 — infrastruktur notifikasi aditif (OQ-3, F4).
 *
 * Prinsip aggregate-per-aksi: satu aksi (individu maupun batch) menghasilkan
 * TEPAT SATU notifikasi ringkasan per penerima — bukan per-baris. Model ini
 * reusable untuk Gelombang 3 (koreksi tugas) dan Gelombang 4 (AI tutor).
 * Email = non-goal (belum ada SMTP).
 */

export interface NotificationSummaryPayload {
  title: string;
  body: string;
  link?: string;
  count?: number;
  [key: string]: unknown;
}

/**
 * Penerima = semua guru dengan membership ACTIVE pada sekolah tersebut.
 * `excludeUserId` dipakai agar aktor tidak menotifikasi dirinya sendiri.
 */
export async function notifySchoolTeachers(params: {
  schoolId: string;
  type: string;
  payload: NotificationSummaryPayload;
  excludeUserId?: string;
}): Promise<number> {
  const memberships = await prisma.teacherSchoolMembership.findMany({
    where: { schoolId: params.schoolId, status: "ACTIVE" },
    select: { teacherProfile: { select: { userId: true } } },
  });

  const recipientIds = [
    ...new Set(
      memberships
        .map((m) => m.teacherProfile.userId)
        .filter((id) => id && id !== params.excludeUserId)
    ),
  ];

  if (recipientIds.length === 0) return 0;

  const result = await prisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      schoolId: params.schoolId,
      type: params.type,
      payload: params.payload as object,
    })),
  });

  return result.count;
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}

export async function listNotifications(userId: string, take = 20) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      payload: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
  return result.count;
}
