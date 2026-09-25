import { prisma } from "@/lib/auth";

export interface GradeDistributionItem {
  gradeKey: string;
  gradeLabel: string;
  classCount: number;
  studentCount: number;
  classes: Array<{ id: string; name: string; schoolName: string; studentCount: number }>;
}

export interface SuperadminOverviewStats {
  schools: {
    total: number;
    active: number;
    inactive: number;
  };
  teachers: {
    total: number;
    active: number;
    banned: number;
    superadmins: number;
  };
  students: {
    total: number;
    active: number;
    pending: number;
    rejected: number;
  };
  classes: {
    total: number;
    totalEnrollments: number;
  };
  gradeDistribution: GradeDistributionItem[];
  recentAuditLogs: Array<{
    id: string;
    action: string;
    actorType: string;
    actorId: string | null;
    targetType: string;
    targetId: string | null;
    createdAt: Date;
    metadata: unknown;
  }>;
}

/**
 * Normalizer tingkat kelas pintar:
 * Mendeteksi angka Arab (1-12), Romawi (I-XII), atau nama kelas (7-A, Kelas 8B, X RPL 1).
 */
export function normalizeGradeKey(rawGradeLevel: string | null | undefined, className: string): { key: string; label: string; order: number } {
  const combined = `${rawGradeLevel || ""} ${className || ""}`.trim();

  // Deteksi Romawi / Angka dengan prefix/suffix umum (e.g., 7A, 8-B, Kelas 9, XII RPL)
  const patterns: Array<{ regex: RegExp; key: string; label: string; order: number }> = [
    { regex: /(?:^|[^\w])(12|xii|duabelas)(?:[^\w]|$|[a-z])/i, key: "12", label: "Kelas 12 (SMA/SMK)", order: 12 },
    { regex: /(?:^|[^\w])(11|xi|sebelas)(?:[^\w]|$|[a-z])/i, key: "11", label: "Kelas 11 (SMA/SMK)", order: 11 },
    { regex: /(?:^|[^\w])(10|x|sepuluh)(?:[^\w]|$|[a-z])/i, key: "10", label: "Kelas 10 (SMA/SMK)", order: 10 },
    { regex: /(?:^|[^\w])(9|ix|sembilan)(?:[^\w]|$|[a-z])/i, key: "9", label: "Kelas 9 (SMP/MTs)", order: 9 },
    { regex: /(?:^|[^\w])(8|viii|delapan)(?:[^\w]|$|[a-z])/i, key: "8", label: "Kelas 8 (SMP/MTs)", order: 8 },
    { regex: /(?:^|[^\w])(7|vii|tujuh)(?:[^\w]|$|[a-z])/i, key: "7", label: "Kelas 7 (SMP/MTs)", order: 7 },
    { regex: /(?:^|[^\w])(6|vi|enam)(?:[^\w]|$|[a-z])/i, key: "6", label: "Kelas 6 (SD/MI)", order: 6 },
    { regex: /(?:^|[^\w])(5|v|lima)(?:[^\w]|$|[a-z])/i, key: "5", label: "Kelas 5 (SD/MI)", order: 5 },
    { regex: /(?:^|[^\w])(4|iv|empat)(?:[^\w]|$|[a-z])/i, key: "4", label: "Kelas 4 (SD/MI)", order: 4 },
    { regex: /(?:^|[^\w])(3|iii|tiga)(?:[^\w]|$|[a-z])/i, key: "3", label: "Kelas 3 (SD/MI)", order: 3 },
    { regex: /(?:^|[^\w])(2|ii|dua)(?:[^\w]|$|[a-z])/i, key: "2", label: "Kelas 2 (SD/MI)", order: 2 },
    { regex: /(?:^|[^\w])(1|i|satu)(?:[^\w]|$|[a-z])/i, key: "1", label: "Kelas 1 (SD/MI)", order: 1 },
  ];

  for (const p of patterns) {
    if (p.regex.test(combined)) {
      return { key: p.key, label: p.label, order: p.order };
    }
  }

  const cleanGrade = (rawGradeLevel || "").trim();
  if (cleanGrade) {
    return { key: cleanGrade.toLowerCase(), label: `Tingkat ${cleanGrade}`, order: 99 };
  }

  return { key: "other", label: "Kelas Khusus / Non-Jenjang", order: 100 };
}

/**
 * Mengambil ringkasan data statistik eksekutif platform untuk Superadmin.
 */
export async function getSuperadminOverviewStats(schoolIdFilter?: string): Promise<SuperadminOverviewStats> {
  const schoolWhere = schoolIdFilter ? { id: schoolIdFilter } : {};
  const studentWhere = schoolIdFilter ? { schoolId: schoolIdFilter } : {};
  const classWhere = schoolIdFilter ? { schoolId: schoolIdFilter } : {};

  // 1. Eksekusi query paralel
  const [
    totalSchools,
    activeSchools,
    totalTeachers,
    bannedTeachers,
    superadminUsers,
    totalStudents,
    activeStudents,
    pendingStudents,
    rejectedStudents,
    totalClasses,
    totalEnrollments,
    classesData,
    recentAuditLogs,
  ] = await Promise.all([
    // Sekolah
    prisma.school.count({ where: schoolWhere }),
    prisma.school.count({ where: { ...schoolWhere, deactivatedAt: null } }),
    // Guru / User
    prisma.user.count({
      where: schoolIdFilter
        ? { teacherProfile: { memberships: { some: { schoolId: schoolIdFilter, status: "ACTIVE" } } } }
        : {},
    }),
    prisma.user.count({
      where: schoolIdFilter
        ? { banned: true, teacherProfile: { memberships: { some: { schoolId: schoolIdFilter } } } }
        : { banned: true },
    }),
    prisma.user.count({ where: { platformRole: "ADMIN" } }),
    // Siswa
    prisma.student.count({ where: studentWhere }),
    prisma.student.count({ where: { ...studentWhere, accountStatus: "ACTIVE" } }),
    prisma.student.count({ where: { ...studentWhere, accountStatus: "PENDING" } }),
    prisma.student.count({ where: { ...studentWhere, accountStatus: "REJECTED" } }),
    // Kelas
    prisma.class.count({ where: classWhere }),
    prisma.classStudent.count({
      where: schoolIdFilter ? { class: { schoolId: schoolIdFilter } } : {},
    }),
    // Rincian Kelas untuk Pemetaan Jenjang
    prisma.class.findMany({
      where: classWhere,
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        school: { select: { id: true, name: true } },
        _count: { select: { classStudents: true } },
      },
      orderBy: [{ name: "asc" }],
      take: 200,
    }),
    // Audit Log terbaru
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        actorType: true,
        actorId: true,
        targetType: true,
        targetId: true,
        createdAt: true,
        metadata: true,
      },
    }),
  ]);

  // 2. Pemetaan distribusi tingkat/jenjang kelas
  const gradeMap = new Map<string, GradeDistributionItem & { order: number }>();

  for (const cls of classesData) {
    const { key, label, order } = normalizeGradeKey(cls.gradeLevel, cls.name);
    const existing = gradeMap.get(key);

    if (!existing) {
      gradeMap.set(key, {
        gradeKey: key,
        gradeLabel: label,
        order,
        classCount: 1,
        studentCount: cls._count.classStudents,
        classes: [
          {
            id: cls.id,
            name: cls.name,
            schoolName: cls.school.name,
            studentCount: cls._count.classStudents,
          },
        ],
      });
    } else {
      existing.classCount += 1;
      existing.studentCount += cls._count.classStudents;
      existing.classes.push({
        id: cls.id,
        name: cls.name,
        schoolName: cls.school.name,
        studentCount: cls._count.classStudents,
      });
    }
  }

  const gradeDistribution = Array.from(gradeMap.values())
    .sort((a, b) => a.order - b.order)
    .map(({ gradeKey, gradeLabel, classCount, studentCount, classes }) => ({
      gradeKey,
      gradeLabel,
      classCount,
      studentCount,
      classes,
    }));

  return {
    schools: {
      total: totalSchools,
      active: activeSchools,
      inactive: totalSchools - activeSchools,
    },
    teachers: {
      total: totalTeachers,
      active: totalTeachers - bannedTeachers,
      banned: bannedTeachers,
      superadmins: superadminUsers,
    },
    students: {
      total: totalStudents,
      active: activeStudents,
      pending: pendingStudents,
      rejected: rejectedStudents,
    },
    classes: {
      total: totalClasses,
      totalEnrollments,
    },
    gradeDistribution,
    recentAuditLogs,
  };
}
