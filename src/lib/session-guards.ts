import { prisma } from "@/lib/auth";

/**
 * Story 5 — fail-closed sekolah nonaktif pada pembuatan sesi BARU Better Auth
 * (OQ-6 + G-5). Diekstrak dari `src/lib/auth.ts` agar unit/integration-testable;
 * hook `databaseHooks.session.create.before` di auth.ts memanggil fungsi ini.
 *
 * Persona yang dicek:
 * - Guru: workspace aktifnya (TeacherProfile.activeSchoolId) sekolah nonaktif → deny.
 * - Parent: sekolah dari relasi siswanya (ParentStudentRelation → student.schoolId)
 *   nonaktif → deny.
 * - Persona lain / gagal resolusi → deny-by-default (fail-closed).
 *
 * Sesi EXISTING ditangani revoke saat deaktivasi sekolah (B5) — bukan di sini.
 */
export async function assertSessionCreationAllowed(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    // Persona guru: workspace aktifnya sekolah nonaktif → deny.
    const teacher = await prisma.teacherProfile.findUnique({
      where: { userId },
      select: { activeSchoolId: true },
    });
    if (teacher?.activeSchoolId) {
      const activeSchool = await prisma.school.findUnique({
        where: { id: teacher.activeSchoolId },
        select: { deactivatedAt: true },
      });
      if (activeSchool?.deactivatedAt) {
        return false;
      }
    }

    // Persona parent (G-5): sekolah dari relasi siswa nonaktif → deny.
    const parent = await prisma.parentProfile.findUnique({
      where: { userId },
      select: {
        studentRelations: {
          select: { student: { select: { schoolId: true } } },
        },
      },
    });
    if (parent) {
      const schoolIds = [...new Set(parent.studentRelations.map((r) => r.student.schoolId))];
      if (schoolIds.length > 0) {
        const deactivated = await prisma.school.findFirst({
          where: { id: { in: schoolIds }, deactivatedAt: { not: null } },
          select: { id: true },
        });
        if (deactivated) {
          return false;
        }
      }
    }

    return true;
  } catch {
    // Fail-closed: error resolusi persona menolak sesi baru.
    return false;
  }
}
