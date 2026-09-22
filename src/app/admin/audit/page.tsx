import { prisma } from "@/lib/auth";
import { AuditViewer } from "./AuditViewer";

/**
 * Story 5 — AuditLog viewer (OQ-8): lintas-sekolah, filter aktor/aksi/target,
 * terpaginasi via index [actorId, createdAt] & [targetType, targetId] (N4).
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; targetType?: string; actorId?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 25;

  const where = {
    ...(sp.action ? { action: sp.action } : {}),
    ...(sp.targetType ? { targetType: sp.targetType } : {}),
    ...(sp.actorId ? { actorId: sp.actorId } : {}),
  };

  const [items, total, distinctActions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        actorType: true,
        actorId: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        ip: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      take: 100,
      orderBy: { action: "asc" },
    }),
  ]);

  return (
    <AuditViewer
      items={items.map((i) => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
      }))}
      total={total}
      page={page}
      pageSize={pageSize}
      actions={distinctActions.map((a) => a.action)}
      filters={{ action: sp.action ?? "", targetType: sp.targetType ?? "", actorId: sp.actorId ?? "" }}
    />
  );
}
