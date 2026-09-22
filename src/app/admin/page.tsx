import { prisma } from "@/lib/auth";
import { AdminConsoleClient } from "./AdminConsoleClient";

/**
 * Story 5 — Konsol superadmin (CAP-7). Data awal: seluruh sekolah (OQ-8 —
 * lintas-sekolah tanpa membership). Proteksi diwarisi dari layout /admin.
 */
export default async function AdminPage() {
  const schools = await prisma.school.findMany({
    select: {
      id: true,
      name: true,
      npsn: true,
      deactivatedAt: true,
      _count: { select: { students: true, memberships: true, classes: true } },
    },
    orderBy: { name: "asc" },
    take: 50,
  });

  return <AdminConsoleClient schools={schools} />;
}
