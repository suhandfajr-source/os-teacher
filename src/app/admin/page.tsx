import { getSuperadminOverviewStats } from "@/modules/admin/admin-stats.service";
import { prisma } from "@/lib/auth";
import { AdminConsoleClient } from "./AdminConsoleClient";

export const dynamic = "force-dynamic";

/**
 * Superadmin Cockpit Desktop Page (CAP-ADM-01 s/d CAP-ADM-09)
 * Server Component yang mengambil data statistik agregat awal dan data 4 pilar entitas.
 */
export default async function AdminPage() {
  const [
    stats,
    schoolsList,
    schoolsData,
    teachersData,
    studentsData,
    classesData,
  ] = await Promise.all([
    getSuperadminOverviewStats(),
    prisma.school.findMany({
      select: { id: true, name: true, npsn: true, deactivatedAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.school.findMany({
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
      take: 20,
    }),
    prisma.user.findMany({
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
      take: 20,
    }),
    prisma.student.findMany({
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
      take: 20,
    }),
    prisma.class.findMany({
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
      take: 20,
    }),
  ]);

  return (
    <AdminConsoleClient
      stats={stats}
      allSchools={schoolsList}
      initialSchools={schoolsData as any}
      initialTeachers={teachersData as any}
      initialStudents={studentsData as any}
      initialClasses={classesData as any}
    />
  );
}
