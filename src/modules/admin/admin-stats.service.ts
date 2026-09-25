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

export interface AiUsageCategoryItem {
  category: string;
  label: string;
  count: number;
  tokens: number;
  percentage: number;
}

export interface AiUsageTeacherItem {
  teacherProfileId: string;
  name: string;
  email: string;
  schoolName: string;
  draftCount: number;
  totalTokens: number;
}

export interface AiUsageRecentItem {
  id: string;
  title: string;
  topic: string;
  contentType: string;
  modelUsed: string;
  estimatedTokens: number;
  createdAt: Date;
  teacherName: string;
  schoolName: string;
}

export interface AiUsageStats {
  summary: {
    totalDrafts: number;
    totalPromptChars: number;
    totalOutputChars: number;
    totalEstimatedTokens: number;
    estimatedCostUsd: number;
    estimatedCostIdr: number;
    activeAiTeachers: number;
  };
  byCategory: AiUsageCategoryItem[];
  byModel: Array<{ model: string; count: number; tokens: number }>;
  topTeachers: AiUsageTeacherItem[];
  recentDrafts: AiUsageRecentItem[];
}

export async function getAiUsageStatsAdmin(schoolIdFilter?: string): Promise<AiUsageStats> {
  const where = schoolIdFilter ? { schoolId: schoolIdFilter } : {};

  const drafts = await prisma.aiContentDraft.findMany({
    where,
    select: {
      id: true,
      title: true,
      topic: true,
      instruction: true,
      content: true,
      contentType: true,
      modelUsed: true,
      createdAt: true,
      teacherProfile: {
        select: {
          id: true,
          user: { select: { name: true, email: true } },
        },
      },
      school: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  let totalPromptChars = 0;
  let totalOutputChars = 0;
  let totalEstimatedTokens = 0;
  let totalCostUsd = 0;

  const categoryMap = new Map<string, { count: number; tokens: number }>();
  const modelMap = new Map<string, { count: number; tokens: number }>();
  const teacherMap = new Map<
    string,
    { name: string; email: string; schoolName: string; count: number; tokens: number }
  >();

  const categoryLabels: Record<string, string> = {
    LESSON_PLAN: "Modul Ajar & RPP",
    LEARNING_MATERIAL: "Bahan Bacaan & Materi",
    TASK_INSTRUCTION: "Instruksi Tugas Siswa",
    RUBRIC: "Rubrik & Kriteria Penilaian",
  };

  const processedRecentDrafts: AiUsageRecentItem[] = [];

  for (const d of drafts) {
    const promptChars = (d.title?.length || 0) + (d.topic?.length || 0) + (d.instruction?.length || 0);
    const outputChars = d.content?.length || 0;
    const promptTokens = Math.max(10, Math.ceil(promptChars / 3.8));
    const outputTokens = Math.max(20, Math.ceil(outputChars / 3.8));
    const itemTokens = promptTokens + outputTokens;

    totalPromptChars += promptChars;
    totalOutputChars += outputChars;
    totalEstimatedTokens += itemTokens;

    // Gemini 1.5 Flash rate: $0.075 / 1M prompt, $0.300 / 1M output
    const cost = (promptTokens / 1_000_000) * 0.075 + (outputTokens / 1_000_000) * 0.3;
    totalCostUsd += cost;

    // Category aggregation
    const cat = d.contentType;
    const existingCat = categoryMap.get(cat) || { count: 0, tokens: 0 };
    existingCat.count += 1;
    existingCat.tokens += itemTokens;
    categoryMap.set(cat, existingCat);

    // Model aggregation
    const model = d.modelUsed || "gemini-1.5-flash";
    const existingModel = modelMap.get(model) || { count: 0, tokens: 0 };
    existingModel.count += 1;
    existingModel.tokens += itemTokens;
    modelMap.set(model, existingModel);

    // Teacher aggregation
    const tId = d.teacherProfile?.id || "unknown";
    const tName = d.teacherProfile?.user?.name || "Guru";
    const tEmail = d.teacherProfile?.user?.email || "—";
    const sName = d.school?.name || "Sekolah";

    const existingTeacher = teacherMap.get(tId) || {
      name: tName,
      email: tEmail,
      schoolName: sName,
      count: 0,
      tokens: 0,
    };
    existingTeacher.count += 1;
    existingTeacher.tokens += itemTokens;
    teacherMap.set(tId, existingTeacher);

    if (processedRecentDrafts.length < 15) {
      processedRecentDrafts.push({
        id: d.id,
        title: d.title,
        topic: d.topic,
        contentType: d.contentType,
        modelUsed: model,
        estimatedTokens: itemTokens,
        createdAt: d.createdAt,
        teacherName: tName,
        schoolName: sName,
      });
    }
  }

  const byCategory: AiUsageCategoryItem[] = Array.from(categoryMap.entries()).map(([cat, data]) => ({
    category: cat,
    label: categoryLabels[cat] || cat,
    count: data.count,
    tokens: data.tokens,
    percentage: drafts.length > 0 ? Math.round((data.count / drafts.length) * 100) : 0,
  }));

  const byModel = Array.from(modelMap.entries()).map(([model, data]) => ({
    model,
    count: data.count,
    tokens: data.tokens,
  }));

  const topTeachers: AiUsageTeacherItem[] = Array.from(teacherMap.entries())
    .map(([teacherProfileId, data]) => ({
      teacherProfileId,
      name: data.name,
      email: data.email,
      schoolName: data.schoolName,
      draftCount: data.count,
      totalTokens: data.tokens,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 5);

  return {
    summary: {
      totalDrafts: drafts.length,
      totalPromptChars,
      totalOutputChars,
      totalEstimatedTokens,
      estimatedCostUsd: Number(totalCostUsd.toFixed(4)),
      estimatedCostIdr: Math.round(totalCostUsd * 16000),
      activeAiTeachers: teacherMap.size,
    },
    byCategory,
    byModel,
    topTeachers,
    recentDrafts: processedRecentDrafts,
  };
}
