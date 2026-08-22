"use server";

import { prisma } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import {
  verifyTeachingContextAccess,
  verifyAssessmentAccess,
  verifyAssessmentTypeAccess,
  verifyGradePolicyAccess,
  verifyAssessmentResultAccess,
  verifyStudentScoreHistoryAccess,
} from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import {
  createAssessmentTypeSchema,
  renameAssessmentTypeSchema,
  createAssessmentSchema,
  updateAssessmentMetadataSchema,
  saveAssessmentScoresSchema,
  recordRemedialAttemptSchema,
  updateGradePolicyItemsSchema,
  copyGradePolicySchema,
  CreateAssessmentTypeInput,
  RenameAssessmentTypeInput,
  CreateAssessmentInput,
  UpdateAssessmentMetadataInput,
  SaveAssessmentScoresInput,
  RecordRemedialAttemptInput,
  UpdateGradePolicyItemsInput,
  CopyGradePolicyInput,
} from "./assessment.types";
import {
  normalizeName,
  calculateNormalizedScore,
  calculateAssessmentStatistics,
  calculateStudentRunningPerformance,
} from "./assessment.service";

// ============================================================================
// 1. ASSESSMENT TYPE ACTIONS
// ============================================================================

export async function createAssessmentType(input: CreateAssessmentTypeInput) {
  const validated = createAssessmentTypeSchema.parse(input);
  const { context } = await verifyTeachingContextAccess(validated.teachingContextId);

  const normalized = normalizeName(validated.name);

  // Check collision
  const existing = await prisma.assessmentType.findUnique({
    where: {
      teachingContextId_normalizedName: {
        teachingContextId: context.id,
        normalizedName: normalized,
      },
    },
  });

  if (existing) {
    if (!existing.isActive) {
      // Reactivate archived type
      const reactivated = await prisma.assessmentType.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          name: validated.name,
          category: validated.category,
        },
      });
      revalidatePath(`/kelas/${context.id}/pengaturan-nilai`);
      revalidatePath(`/kelas/${context.id}/penilaian`);
      return reactivated;
    }
    throw new Error(`Jenis penilaian "${validated.name}" sudah ada.`);
  }

  const assessmentType = await prisma.assessmentType.create({
    data: {
      teachingContextId: context.id,
      name: validated.name,
      normalizedName: normalized,
      category: validated.category,
      isActive: true,
    },
  });

  revalidatePath(`/kelas/${context.id}/pengaturan-nilai`);
  revalidatePath(`/kelas/${context.id}/penilaian`);
  return assessmentType;
}

export async function renameAssessmentType(input: RenameAssessmentTypeInput) {
  const validated = renameAssessmentTypeSchema.parse(input);
  const { assessmentType } = await verifyAssessmentTypeAccess(validated.id);

  const normalized = normalizeName(validated.name);

  // Check collision with other types
  const existing = await prisma.assessmentType.findUnique({
    where: {
      teachingContextId_normalizedName: {
        teachingContextId: assessmentType.teachingContextId,
        normalizedName: normalized,
      },
    },
  });

  if (existing && existing.id !== assessmentType.id) {
    throw new Error(`Jenis penilaian dengan nama "${validated.name}" sudah ada.`);
  }

  const updated = await prisma.assessmentType.update({
    where: { id: assessmentType.id },
    data: {
      name: validated.name,
      normalizedName: normalized,
    },
  });

  revalidatePath(`/kelas/${assessmentType.teachingContextId}/pengaturan-nilai`);
  revalidatePath(`/kelas/${assessmentType.teachingContextId}/penilaian`);
  return updated;
}

export async function archiveAssessmentType(assessmentTypeId: string) {
  const { assessmentType } = await verifyAssessmentTypeAccess(assessmentTypeId);

  const updated = await prisma.assessmentType.update({
    where: { id: assessmentType.id },
    data: { isActive: false },
  });

  revalidatePath(`/kelas/${assessmentType.teachingContextId}/pengaturan-nilai`);
  revalidatePath(`/kelas/${assessmentType.teachingContextId}/penilaian`);
  return updated;
}

/**
 * Idempotent starter template setup:
 * Creates starter types: Tugas (ASSIGNMENT), UH (FORMATIVE), UTS (MIDTERM), UAS (FINAL_TERM).
 * Creates GradePolicy in DRAFT status with 20/30/20/30 weights.
 */
export async function applyStarterTemplate(teachingContextId: string) {
  const { context } = await verifyTeachingContextAccess(teachingContextId);

  const templates = [
    { name: "Tugas", category: "ASSIGNMENT" as const, weight: new Prisma.Decimal(20), sortOrder: 1 },
    { name: "Ulangan Harian", category: "FORMATIVE" as const, weight: new Prisma.Decimal(30), sortOrder: 2 },
    { name: "UTS", category: "MIDTERM" as const, weight: new Prisma.Decimal(20), sortOrder: 3 },
    { name: "UAS", category: "FINAL_TERM" as const, weight: new Prisma.Decimal(30), sortOrder: 4 },
  ];

  return await prisma.$transaction(async (tx) => {
    // 1. Get or create starter AssessmentTypes
    const typeMap = new Map<string, string>(); // category -> typeId

    for (const t of templates) {
      const normalized = normalizeName(t.name);
      let type = await tx.assessmentType.findUnique({
        where: {
          teachingContextId_normalizedName: {
            teachingContextId: context.id,
            normalizedName: normalized,
          },
        },
      });

      if (!type) {
        type = await tx.assessmentType.create({
          data: {
            teachingContextId: context.id,
            name: t.name,
            normalizedName: normalized,
            category: t.category,
            isActive: true,
          },
        });
      } else if (!type.isActive) {
        type = await tx.assessmentType.update({
          where: { id: type.id },
          data: { isActive: true },
        });
      }

      typeMap.set(t.name, type.id);
    }

    // 2. Get or create GradePolicy
    let policy = await tx.gradePolicy.findUnique({
      where: { teachingContextId: context.id },
    });

    if (!policy) {
      policy = await tx.gradePolicy.create({
        data: {
          teachingContextId: context.id,
          status: "DRAFT",
        },
      });
    }

    // 3. Upsert starter GradePolicyItems
    for (const t of templates) {
      const typeId = typeMap.get(t.name)!;
      await tx.gradePolicyItem.upsert({
        where: {
          gradePolicyId_assessmentTypeId: {
            gradePolicyId: policy.id,
            assessmentTypeId: typeId,
          },
        },
        create: {
          gradePolicyId: policy.id,
          assessmentTypeId: typeId,
          weight: t.weight,
          sortOrder: t.sortOrder,
        },
        update: {
          weight: t.weight,
          sortOrder: t.sortOrder,
        },
      });
    }

    return policy;
  });
}

// ============================================================================
// 2. GRADE POLICY ACTIONS
// ============================================================================

export async function saveGradePolicyItems(input: UpdateGradePolicyItemsInput) {
  const validated = updateGradePolicyItemsSchema.parse(input);
  const { gradePolicy } = await verifyGradePolicyAccess(validated.gradePolicyId);

  return await prisma.$transaction(async (tx) => {
    // Lock parent policy row
    await tx.$queryRaw`SELECT id FROM grade_policy WHERE id = ${gradePolicy.id} FOR UPDATE`;

    // Validate that all referenced assessment types belong to this teaching context
    const typeIds = validated.items.map((i) => i.assessmentTypeId);
    const validTypes = await tx.assessmentType.findMany({
      where: {
        id: { in: typeIds },
        teachingContextId: gradePolicy.teachingContextId,
      },
    });

    if (validTypes.length !== typeIds.length) {
      throw new Error("Terdapat jenis penilaian yang tidak valid atau bukan milik kelas ini.");
    }

    // Calculate sum of proposed items
    let sum = new Prisma.Decimal(0);
    for (const item of validated.items) {
      sum = sum.plus(new Prisma.Decimal(item.weight));
    }

    // If currently ACTIVE, editing requires the proposed items to remain EXACTLY 100.00%
    if (gradePolicy.status === "ACTIVE" && !sum.equals(new Prisma.Decimal("100.00"))) {
      throw new Error(`Pengaturan Nilai berstatus AKTIF. Total bobot harus tepat 100.00%. Total baru: ${sum.toFixed(2)}%`);
    }

    // Replace items
    await tx.gradePolicyItem.deleteMany({
      where: { gradePolicyId: gradePolicy.id },
    });

    await tx.gradePolicyItem.createMany({
      data: validated.items.map((item, idx) => ({
        gradePolicyId: gradePolicy.id,
        assessmentTypeId: item.assessmentTypeId,
        weight: new Prisma.Decimal(item.weight),
        sortOrder: item.sortOrder ?? idx,
      })),
    });

    revalidatePath(`/kelas/${gradePolicy.teachingContextId}/pengaturan-nilai`);
    revalidatePath(`/kelas/${gradePolicy.teachingContextId}/penilaian`);

    return { success: true, totalWeight: sum };
  });
}

export async function activateGradePolicy(gradePolicyId: string) {
  const { gradePolicy } = await verifyGradePolicyAccess(gradePolicyId);

  return await prisma.$transaction(async (tx) => {
    // Lock parent policy row
    await tx.$queryRaw`SELECT id FROM grade_policy WHERE id = ${gradePolicy.id} FOR UPDATE`;

    const items = await tx.gradePolicyItem.findMany({
      where: { gradePolicyId: gradePolicy.id },
    });

    if (items.length === 0) {
      throw new Error("Tidak dapat mengaktifkan pengaturan nilai tanpa komponen bobot.");
    }

    let sum = new Prisma.Decimal(0);
    for (const item of items) {
      sum = sum.plus(new Prisma.Decimal(item.weight));
    }

    if (!sum.equals(new Prisma.Decimal("100.00"))) {
      throw new Error(`Total bobot harus tepat 100.00% untuk diaktifkan. Total saat ini: ${sum.toFixed(2)}%`);
    }

    const updated = await tx.gradePolicy.update({
      where: { id: gradePolicy.id },
      data: { status: "ACTIVE" },
    });

    revalidatePath(`/kelas/${gradePolicy.teachingContextId}/pengaturan-nilai`);
    revalidatePath(`/kelas/${gradePolicy.teachingContextId}/penilaian`);

    return updated;
  });
}

export async function copyGradePolicy(input: CopyGradePolicyInput) {
  const validated = copyGradePolicySchema.parse(input);

  // Authorize source context
  const sourceAuth = await verifyTeachingContextAccess(validated.sourceTeachingContextId);
  // Authorize target context
  const targetAuth = await verifyTeachingContextAccess(validated.targetTeachingContextId);

  return await prisma.$transaction(async (tx) => {
    // Load source policy and items
    const sourcePolicy = await tx.gradePolicy.findUnique({
      where: { teachingContextId: sourceAuth.context.id },
      include: {
        items: {
          include: { assessmentType: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!sourcePolicy || sourcePolicy.items.length === 0) {
      throw new Error("Kelas sumber belum memiliki pengaturan bobot nilai.");
    }

    // Load existing target types
    const targetTypes = await tx.assessmentType.findMany({
      where: { teachingContextId: targetAuth.context.id },
    });

    const targetTypeByNormalizedName = new Map<string, typeof targetTypes[0]>();
    for (const t of targetTypes) {
      targetTypeByNormalizedName.set(t.normalizedName, t);
    }

    // Check conflicts for all source types
    const itemsToCopy: Array<{ targetTypeId: string; weight: Prisma.Decimal; sortOrder: number }> = [];

    for (const item of sourcePolicy.items) {
      const srcType = item.assessmentType;
      const existingTargetType = targetTypeByNormalizedName.get(srcType.normalizedName);

      if (existingTargetType) {
        if (existingTargetType.category !== srcType.category) {
          throw new Error(
            `Konflik jenis penilaian: "${srcType.name}" di kelas tujuan memiliki kategori berbeda (${existingTargetType.category} vs ${srcType.category}). Harap sesuaikan jenis penilaian terlebih dahulu.`
          );
        }
        // Safe reuse
        itemsToCopy.push({
          targetTypeId: existingTargetType.id,
          weight: item.weight,
          sortOrder: item.sortOrder,
        });
      } else {
        // Create new type in target
        const newTargetType = await tx.assessmentType.create({
          data: {
            teachingContextId: targetAuth.context.id,
            name: srcType.name,
            normalizedName: srcType.normalizedName,
            category: srcType.category,
            isActive: true,
          },
        });
        targetTypeByNormalizedName.set(newTargetType.normalizedName, newTargetType);
        itemsToCopy.push({
          targetTypeId: newTargetType.id,
          weight: item.weight,
          sortOrder: item.sortOrder,
        });
      }
    }

    // Check if target already has a policy
    let targetPolicy = await tx.gradePolicy.findUnique({
      where: { teachingContextId: targetAuth.context.id },
    });

    if (!targetPolicy) {
      targetPolicy = await tx.gradePolicy.create({
        data: {
          teachingContextId: targetAuth.context.id,
          status: "DRAFT",
        },
      });
    } else {
      // Overwriting existing target policy: status becomes DRAFT for teacher review
      await tx.gradePolicy.update({
        where: { id: targetPolicy.id },
        data: { status: "DRAFT" },
      });
      await tx.gradePolicyItem.deleteMany({
        where: { gradePolicyId: targetPolicy.id },
      });
    }

    // Create copied items
    await tx.gradePolicyItem.createMany({
      data: itemsToCopy.map((item) => ({
        gradePolicyId: targetPolicy.id,
        assessmentTypeId: item.targetTypeId,
        weight: item.weight,
        sortOrder: item.sortOrder,
      })),
    });

    revalidatePath(`/kelas/${targetAuth.context.id}/pengaturan-nilai`);
    revalidatePath(`/kelas/${targetAuth.context.id}/penilaian`);

    return targetPolicy;
  });
}

// ============================================================================
// 3. ASSESSMENT LIFECYCLE & CREATION ACTIONS
// ============================================================================

export async function createAssessment(input: CreateAssessmentInput) {
  const validated = createAssessmentSchema.parse(input);
  const { context } = await verifyTeachingContextAccess(validated.teachingContextId);

  // Validate AssessmentType ownership
  const type = await prisma.assessmentType.findUnique({
    where: { id: validated.assessmentTypeId },
  });

  if (!type || type.teachingContextId !== context.id) {
    throw new Error("Jenis penilaian tidak valid untuk kelas ini.");
  }

  // Validate optional TeachingSession consistency
  if (validated.teachingSessionId) {
    const session = await prisma.teachingSession.findUnique({
      where: { id: validated.teachingSessionId },
    });
    if (!session || session.teachingContextId !== context.id) {
      throw new Error("Pertemuan belajar tidak valid untuk kelas ini.");
    }
  }

  const assessment = await prisma.assessment.create({
    data: {
      teachingContextId: context.id,
      assessmentTypeId: validated.assessmentTypeId,
      teachingSessionId: validated.teachingSessionId || null,
      title: validated.title,
      description: validated.description || null,
      assessmentDate: validated.assessmentDate,
      maxScore: new Prisma.Decimal(validated.maxScore),
      minimumPassingScore:
        validated.minimumPassingScore !== null && validated.minimumPassingScore !== undefined
          ? new Prisma.Decimal(validated.minimumPassingScore)
          : null,
      status: "DRAFT",
    },
  });

  revalidatePath(`/assessment`);
  revalidatePath(`/kelas/${context.id}/penilaian`);
  return assessment;
}

export async function updateAssessmentMetadata(input: UpdateAssessmentMetadataInput) {
  const validated = updateAssessmentMetadataSchema.parse(input);
  const { assessment, context } = await verifyAssessmentAccess(validated.assessmentId);

  // If participants are already initialized, maxScore is strictly LOCKED
  if (assessment.participantsInitializedAt !== null && validated.maxScore !== undefined) {
    const currentMax = new Prisma.Decimal(assessment.maxScore);
    const newMax = new Prisma.Decimal(validated.maxScore);
    if (!currentMax.equals(newMax)) {
      throw new Error("Skor maksimum tidak dapat diubah setelah penilaian dimulai (peserta telah diinisialisasi).");
    }
  }

  // If assessmentTypeId is changed, verify ownership
  if (validated.assessmentTypeId) {
    const type = await prisma.assessmentType.findUnique({
      where: { id: validated.assessmentTypeId },
    });
    if (!type || type.teachingContextId !== context.id) {
      throw new Error("Jenis penilaian tidak valid untuk kelas ini.");
    }
  }

  // If teachingSessionId is changed, verify ownership
  if (validated.teachingSessionId) {
    const session = await prisma.teachingSession.findUnique({
      where: { id: validated.teachingSessionId },
    });
    if (!session || session.teachingContextId !== context.id) {
      throw new Error("Pertemuan belajar tidak valid untuk kelas ini.");
    }
  }

  const updated = await prisma.assessment.update({
    where: { id: assessment.id },
    data: {
      title: validated.title !== undefined ? validated.title : assessment.title,
      description: validated.description !== undefined ? validated.description : assessment.description,
      assessmentDate: validated.assessmentDate !== undefined ? validated.assessmentDate : assessment.assessmentDate,
      assessmentTypeId: validated.assessmentTypeId !== undefined ? validated.assessmentTypeId : assessment.assessmentTypeId,
      teachingSessionId:
        validated.teachingSessionId !== undefined ? validated.teachingSessionId : assessment.teachingSessionId,
      maxScore: validated.maxScore !== undefined ? new Prisma.Decimal(validated.maxScore) : assessment.maxScore,
      minimumPassingScore:
        validated.minimumPassingScore !== undefined
          ? validated.minimumPassingScore !== null
            ? new Prisma.Decimal(validated.minimumPassingScore)
            : null
          : assessment.minimumPassingScore,
    },
  });

  revalidatePath(`/assessment/${assessment.id}`);
  revalidatePath(`/kelas/${context.id}/penilaian`);
  return updated;
}

export async function initializeAssessmentParticipants(assessmentId: string) {
  const { assessment, context } = await verifyAssessmentAccess(assessmentId);

  return await prisma.$transaction(async (tx) => {
    // Atomic conditional state claim
    const claim = await tx.assessment.updateMany({
      where: {
        id: assessment.id,
        participantsInitializedAt: null,
        status: "DRAFT",
      },
      data: {
        participantsInitializedAt: new Date(),
        status: "IN_PROGRESS",
      },
    });

    if (claim.count === 0) {
      // Already initialized concurrently: return existing results idempotently
      return await tx.assessmentResult.findMany({
        where: { assessmentId: assessment.id },
        include: { student: true },
        orderBy: [{ student: { fullName: "asc" } }, { student: { nis: "asc" } }],
      });
    }

    // Winner queries current authorized ClassStudent roster
    const roster = await tx.classStudent.findMany({
      where: {
        classId: context.classId,
        academicPeriodId: context.academicPeriodId,
        student: { status: "ACTIVE" },
      },
      select: { studentId: true },
    });

    if (roster.length === 0) {
      throw new Error("Daftar siswa kosong. Tidak dapat memulai penilaian.");
    }

    await tx.assessmentResult.createMany({
      data: roster.map((r) => ({
        assessmentId: assessment.id,
        studentId: r.studentId,
        status: "PENDING",
        rawScore: null,
        normalizedScore: null,
        finalScore: null,
      })),
    });

    revalidatePath(`/assessment/${assessment.id}`);
    revalidatePath(`/kelas/${context.id}/penilaian`);

    return await tx.assessmentResult.findMany({
      where: { assessmentId: assessment.id },
      include: { student: true },
      orderBy: [{ student: { fullName: "asc" } }, { student: { nis: "asc" } }],
    });
  });
}

// ============================================================================
// 4. SCORING, PARTIAL SAVE & REMEDIAL ACTIONS
// ============================================================================

export async function saveAssessmentScores(input: SaveAssessmentScoresInput) {
  const validated = saveAssessmentScoresSchema.parse(input);
  const { assessment, context } = await verifyAssessmentAccess(validated.assessmentId);

  if (assessment.status === "COMPLETED") {
    throw new Error("Penilaian sudah selesai (COMPLETED). Nilai awal terkunci; gunakan menu Remedial untuk pembaruan nilai.");
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch current snapshot of participants
    const existingResults = await tx.assessmentResult.findMany({
      where: { assessmentId: assessment.id },
      include: { remedialAttempts: true },
    });

    const resultMap = new Map<string, typeof existingResults[0]>();
    for (const res of existingResults) {
      resultMap.set(res.studentId, res);
    }

    const maxScore = new Prisma.Decimal(assessment.maxScore);

    // 2. Validate all submitted rows first
    for (const entry of validated.scores) {
      const existing = resultMap.get(entry.studentId);
      if (!existing) {
        throw new Error(`Siswa dengan ID "${entry.studentId}" bukan peserta terdaftar dalam penilaian ini.`);
      }

      // Remedial history protection: if result already has remedial attempts, cannot reset to PENDING, ABSENT, or EXCUSED
      if (existing.remedialAttempts.length > 0 && entry.status !== "GRADED") {
        throw new Error(`Siswa ${existing.studentId} telah memiliki riwayat remedial; status tidak dapat diubah menjadi ${entry.status}.`);
      }

      if (entry.status === "GRADED") {
        if (entry.rawScore === null || entry.rawScore === undefined) {
          throw new Error("Skor mentah (rawScore) wajib diisi untuk status Dinilai (GRADED).");
        }
        const raw = new Prisma.Decimal(entry.rawScore);
        if (raw.lessThan(0) || raw.greaterThan(maxScore)) {
          throw new Error(`Skor mentah (${entry.rawScore}) harus berada di antara 0 dan skor maksimum (${assessment.maxScore}).`);
        }
      }
    }

    // 3. Batch update submitted entries in one transaction
    for (const entry of validated.scores) {
      const existing = resultMap.get(entry.studentId)!;

      if (entry.status === "GRADED") {
        const normalized = calculateNormalizedScore(entry.rawScore!, maxScore);
        // Initial finalScore = normalizedScore (unless existing finalScore was already updated via remedial)
        const finalScore = existing.remedialAttempts.length > 0 && existing.finalScore ? existing.finalScore : normalized;

        await tx.assessmentResult.update({
          where: { id: existing.id },
          data: {
            status: "GRADED",
            rawScore: new Prisma.Decimal(entry.rawScore!),
            normalizedScore: normalized,
            finalScore: finalScore,
            note: entry.note !== undefined ? entry.note : existing.note,
          },
        });
      } else {
        // PENDING, ABSENT, EXCUSED
        await tx.assessmentResult.update({
          where: { id: existing.id },
          data: {
            status: entry.status,
            rawScore: null,
            normalizedScore: null,
            finalScore: null,
            note: entry.note !== undefined ? entry.note : existing.note,
          },
        });
      }
    }

    revalidatePath(`/assessment/${assessment.id}`);
    revalidatePath(`/kelas/${context.id}/penilaian`);

    return { success: true, updatedCount: validated.scores.length };
  });
}

export async function recordRemedialAttempt(input: RecordRemedialAttemptInput) {
  const validated = recordRemedialAttemptSchema.parse(input);
  const { result, assessment, context } = await verifyAssessmentResultAccess(validated.assessmentResultId);

  if (result.status !== "GRADED") {
    throw new Error("Remedial hanya dapat dicatat untuk peserta yang telah dinilai (status GRADED).");
  }

  return await prisma.$transaction(async (tx) => {
    const remedialAttempt = await tx.remedialAttempt.create({
      data: {
        assessmentResultId: result.id,
        score: new Prisma.Decimal(validated.score),
        note: validated.note || null,
        attemptDate: validated.attemptDate || new Date(),
      },
    });

    // Update teacher-decided finalScore on AssessmentResult
    await tx.assessmentResult.update({
      where: { id: result.id },
      data: {
        finalScore: new Prisma.Decimal(validated.newFinalScore),
      },
    });

    revalidatePath(`/assessment/${assessment.id}`);
    revalidatePath(`/kelas/${context.id}/penilaian`);

    return remedialAttempt;
  });
}

export async function updateAssessmentKKTP(assessmentId: string, minimumPassingScore: number | null) {
  const { assessment, context } = await verifyAssessmentAccess(assessmentId);

  const updated = await prisma.assessment.update({
    where: { id: assessment.id },
    data: {
      minimumPassingScore:
        minimumPassingScore !== null && minimumPassingScore !== undefined
          ? new Prisma.Decimal(minimumPassingScore)
          : null,
    },
  });

  revalidatePath(`/assessment/${assessment.id}`);
  revalidatePath(`/kelas/${context.id}/penilaian`);
  return updated;
}

export async function completeAssessment(assessmentId: string) {
  const { assessment, context } = await verifyAssessmentAccess(assessmentId);

  const pendingCount = await prisma.assessmentResult.count({
    where: {
      assessmentId: assessment.id,
      status: "PENDING",
    },
  });

  if (pendingCount > 0) {
    throw new Error(`Semua siswa harus memiliki status (Dinilai, Tidak Hadir, atau Dikecualikan) sebelum penilaian dapat diselesaikan. Terdapat ${pendingCount} siswa yang masih berstatus Belum Dinilai (Pending).`);
  }

  const updated = await prisma.assessment.update({
    where: { id: assessment.id },
    data: { status: "COMPLETED" },
  });

  revalidatePath(`/assessment/${assessment.id}`);
  revalidatePath(`/assessment`);
  revalidatePath(`/kelas/${context.id}/penilaian`);

  return updated;
}

// ============================================================================
// 5. QUERY / DATA FETCHERS
// ============================================================================

export async function getAssessmentDashboardData() {
  const { profile, activeSchoolId } = await verifyTeachingContextAccess.caller
    ? await (await import("@/lib/authorization")).verifyActiveSchoolMembership()
    : await (await import("@/lib/authorization")).verifyActiveSchoolMembership();

  const assessments = await prisma.assessment.findMany({
    where: {
      teachingContext: {
        teacherProfileId: profile.id,
        schoolId: activeSchoolId,
      },
    },
    include: {
      assessmentType: true,
      teachingContext: {
        include: {
          class: true,
          subject: true,
        },
      },
      results: {
        select: {
          status: true,
          finalScore: true,
        },
      },
    },
    orderBy: [{ assessmentDate: "desc" }, { createdAt: "desc" }],
  });

  return assessments.map((a) => {
    const stats = calculateAssessmentStatistics(a.results, a.minimumPassingScore);
    return {
      id: a.id,
      title: a.title,
      date: a.assessmentDate,
      status: a.status,
      maxScore: a.maxScore,
      minimumPassingScore: a.minimumPassingScore,
      typeName: a.assessmentType.name,
      typeCategory: a.assessmentType.category,
      className: a.teachingContext.class.name,
      subjectName: a.teachingContext.subject.name,
      teachingContextId: a.teachingContextId,
      stats,
    };
  });
}

export async function getClassAssessmentData(teachingContextId: string) {
  const { context } = await verifyTeachingContextAccess(teachingContextId);

  // 1. Fetch assessments for this context
  const assessments = await prisma.assessment.findMany({
    where: { teachingContextId: context.id },
    include: {
      assessmentType: true,
      results: {
        select: {
          status: true,
          finalScore: true,
        },
      },
    },
    orderBy: [{ assessmentDate: "desc" }, { createdAt: "desc" }],
  });

  // 2. Fetch GradePolicy and active policy items
  const gradePolicy = await prisma.gradePolicy.findUnique({
    where: { teachingContextId: context.id },
    include: {
      items: {
        include: { assessmentType: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  // 3. If policy is ACTIVE, calculate weighted running grades for all enrolled active students
  let runningGrades: ReturnType<typeof calculateStudentRunningPerformance>[] = [];

  if (gradePolicy && gradePolicy.status === "ACTIVE" && gradePolicy.items.length > 0) {
    const classStudents = await prisma.classStudent.findMany({
      where: {
        classId: context.classId,
        academicPeriodId: context.academicPeriodId,
        student: { status: "ACTIVE" },
      },
      include: { student: true },
      orderBy: [{ student: { fullName: "asc" } }, { student: { nis: "asc" } }],
    });

    const allResults = await prisma.assessmentResult.findMany({
      where: {
        assessment: { teachingContextId: context.id },
      },
      include: {
        assessment: {
          include: { assessmentType: true },
        },
      },
    });

    const resultsByStudent = new Map<string, Array<{
      assessmentId: string;
      assessmentTypeId: string;
      assessmentTypeName: string;
      assessmentStatus: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
      resultStatus: "PENDING" | "GRADED" | "ABSENT" | "EXCUSED";
      finalScore: Prisma.Decimal | null;
    }>>();

    for (const r of allResults) {
      if (!resultsByStudent.has(r.studentId)) {
        resultsByStudent.set(r.studentId, []);
      }
      resultsByStudent.get(r.studentId)!.push({
        assessmentId: r.assessmentId,
        assessmentTypeId: r.assessment.assessmentTypeId,
        assessmentTypeName: r.assessment.assessmentType.name,
        assessmentStatus: r.assessment.status,
        resultStatus: r.status,
        finalScore: r.finalScore,
      });
    }

    const policyItemsSnapshot = gradePolicy.items.map((i) => ({
      assessmentTypeId: i.assessmentTypeId,
      assessmentTypeName: i.assessmentType.name,
      category: i.assessmentType.category,
      weight: i.weight,
    }));

    runningGrades = classStudents.map((cs) => {
      const studentScores = resultsByStudent.get(cs.studentId) || [];
      return calculateStudentRunningPerformance(
        { id: cs.student.id, fullName: cs.student.fullName, nis: cs.student.nis },
        policyItemsSnapshot,
        studentScores
      );
    });
  }

  return {
    context,
    assessments: assessments.map((a) => ({
      id: a.id,
      title: a.title,
      date: a.assessmentDate,
      status: a.status,
      maxScore: a.maxScore,
      minimumPassingScore: a.minimumPassingScore,
      typeName: a.assessmentType.name,
      typeCategory: a.assessmentType.category,
      stats: calculateAssessmentStatistics(a.results, a.minimumPassingScore),
    })),
    gradePolicy,
    runningGrades,
  };
}

export async function getAssessmentDetailData(assessmentId: string) {
  const { assessment, context } = await verifyAssessmentAccess(assessmentId);

  const results = await prisma.assessmentResult.findMany({
    where: { assessmentId: assessment.id },
    include: {
      student: true,
      remedialAttempts: {
        orderBy: { attemptDate: "desc" },
      },
    },
    orderBy: [{ student: { fullName: "asc" } }, { student: { nis: "asc" } }],
  });

  const stats = calculateAssessmentStatistics(results, assessment.minimumPassingScore);

  return {
    assessment,
    context,
    results,
    stats,
  };
}

export async function getGradePolicyData(teachingContextId: string) {
  const { context, profile, activeSchoolId } = await verifyTeachingContextAccess(teachingContextId);

  const policy = await prisma.gradePolicy.findUnique({
    where: { teachingContextId: context.id },
    include: {
      items: {
        include: { assessmentType: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const assessmentTypes = await prisma.assessmentType.findMany({
    where: {
      teachingContextId: context.id,
      isActive: true,
    },
    orderBy: { name: "asc" },
  });

  // Other contexts owned by this teacher in this active school for copy policy
  const otherContexts = await prisma.teachingContext.findMany({
    where: {
      teacherProfileId: profile.id,
      schoolId: activeSchoolId,
      id: { not: context.id },
    },
    include: {
      class: true,
      subject: true,
      academicPeriod: true,
      gradePolicy: {
        include: { items: true },
      },
    },
  });

  // Count scored assessments in this context
  const scoredAssessmentCount = await prisma.assessment.count({
    where: {
      teachingContextId: context.id,
      results: {
        some: { status: "GRADED" },
      },
    },
  });

  return {
    context,
    policy,
    assessmentTypes,
    otherContexts,
    scoredAssessmentCount,
  };
}

export async function getStudentAssessmentHistory(studentId: string) {
  const { student, profile, activeSchoolId } = await verifyStudentScoreHistoryAccess(studentId);

  const results = await prisma.assessmentResult.findMany({
    where: {
      studentId: student.id,
      assessment: {
        teachingContext: {
          teacherProfileId: profile.id,
          schoolId: activeSchoolId,
        },
      },
    },
    include: {
      assessment: {
        include: {
          assessmentType: true,
          teachingContext: {
            include: {
              class: true,
              subject: true,
            },
          },
        },
      },
      remedialAttempts: {
        orderBy: { attemptDate: "desc" },
      },
    },
    orderBy: [{ assessment: { assessmentDate: "desc" } }, { createdAt: "desc" }],
  });

  return {
    student,
    results,
  };
}
