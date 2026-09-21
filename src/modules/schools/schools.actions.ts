"use server";

import { prisma, auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  normalizeSchoolName,
  evaluateSchoolDedup,
  type ExistingSchoolCandidate,
} from "@/lib/school-dedup";
import { verifyActiveSchoolMembership } from "@/lib/authorization";
import { Prisma } from "@prisma/client";

async function validateSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function searchSchools(query: string) {
  if (!query || query.trim().length < 3) return [];

  const q = query.trim();

  const schools = await prisma.school.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { npsn: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 10,
    select: {
      id: true,
      name: true,
      city: true,
      npsn: true,
      _count: {
        select: {
          memberships: {
            where: { status: "ACTIVE" },
          },
          classes: true,
        },
      },
    },
  });

  return schools.map((s) => ({
    id: s.id,
    name: s.name,
    city: s.city,
    npsn: s.npsn,
    activeTeacherCount: s._count.memberships,
    classCount: s._count.classes,
  }));
}

export async function joinSchool(schoolId: string) {
  const session = await validateSession();

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    throw new Error("Teacher profile not found");
  }

  // Check if membership already exists
  const existingMembership = await prisma.teacherSchoolMembership.findUnique({
    where: {
      teacherProfileId_schoolId: {
        teacherProfileId: profile.id,
        schoolId: schoolId,
      },
    },
  });

  // F1 CRITICAL: Keanggotaan yang telah di-REVOKE mutlak dilarang re-join sepihak
  if (existingMembership?.status === "REVOKED") {
    throw new Error(
      "Keanggotaan Anda di sekolah ini telah dinonaktifkan. Hubungi pengelola sekolah."
    );
  }

  if (!existingMembership) {
    await prisma.teacherSchoolMembership.create({
      data: {
        teacherProfileId: profile.id,
        schoolId: schoolId,
        status: "ACTIVE",
        workspaceRole: "MEMBER",
      },
    });
  }

  // Set as active school
  await prisma.teacherProfile.update({
    where: { id: profile.id },
    data: { activeSchoolId: schoolId },
  });

  return { success: true };
}

export type CreateSchoolResult =
  | { success: true; school: { id: string; name: string; npsn: string | null; city: string | null } }
  | {
      success: false;
      code: "NPSN_EXISTS" | "EXACT_NAME_EXISTS" | "SIMILAR_NAME_FOUND" | "CREATE_FAILED";
      message: string;
      existingSchool?: ExistingSchoolCandidate;
      matchedSchool?: ExistingSchoolCandidate;
      similarity?: number;
    };

export async function createSchool(data: {
  name: string;
  city?: string;
  npsn?: string;
  forceCreate?: boolean;
}): Promise<CreateSchoolResult> {
  const session = await validateSession();

  if (!data.name || !data.name.trim()) {
    return {
      success: false,
      code: "CREATE_FAILED",
      message: "Nama sekolah wajib diisi.",
    };
  }

  const rawName = data.name.trim();
  const rawCity = data.city?.trim() || null;
  const rawNpsn = data.npsn?.trim() || null;
  const normalized = normalizeSchoolName(rawName);

  // 1. Candidate Pre-filtering (F4 Medium):
  // Ambil kandidat spesifik (npsn sama, normalizedName sama) ATAU pre-filter max 50 berbasis kota/token
  const firstToken = normalized.split(/\s+/)[0] || "";
  const candidateConditions: Prisma.SchoolWhereInput[] = [
    { normalizedName: normalized },
  ];

  if (rawNpsn) {
    candidateConditions.push({ npsn: rawNpsn });
  }

  if (rawCity) {
    candidateConditions.push({ city: { contains: rawCity, mode: "insensitive" } });
  } else if (firstToken.length >= 3) {
    candidateConditions.push({ name: { contains: firstToken, mode: "insensitive" } });
  }

  const candidateRows = await prisma.school.findMany({
    where: { OR: candidateConditions },
    take: 50,
    select: {
      id: true,
      name: true,
      normalizedName: true,
      npsn: true,
      city: true,
    },
  });

  // 2. Evaluasi gerbang dedup 4 skenario via school-dedup pure evaluator
  const dedupResult = evaluateSchoolDedup(
    { name: rawName, npsn: rawNpsn, forceCreate: data.forceCreate },
    candidateRows
  );

  if (dedupResult.match === "NPSN_EXISTS") {
    return {
      success: false,
      code: "NPSN_EXISTS",
      message: `Sekolah dengan NPSN ${rawNpsn} sudah terdaftar (${dedupResult.school.name}). Silakan bergabung ke sekolah tersebut.`,
      existingSchool: dedupResult.school,
    };
  }

  if (dedupResult.match === "EXACT_NAME_EXISTS") {
    return {
      success: false,
      code: "EXACT_NAME_EXISTS",
      message: `Sekolah "${dedupResult.school.name}" sudah terdaftar di sistem. Silakan bergabung ke sekolah tersebut.`,
      existingSchool: dedupResult.school,
    };
  }

  if (dedupResult.match === "SIMILAR_NAME_FOUND") {
    return {
      success: false,
      code: "SIMILAR_NAME_FOUND",
      message: `Ditemukan sekolah dengan nama serupa (${dedupResult.school.name}). Apakah maksud Anda sekolah ini?`,
      matchedSchool: dedupResult.school,
      similarity: dedupResult.similarity,
    };
  }

  // 3. Eksekusi pembuatan sekolah + membership OWNER
  let profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    profile = await prisma.teacherProfile.create({
      data: {
        userId: session.user.id,
        onboardingCompleted: false,
      },
    });
  }

  try {
    const school = await prisma.$transaction(async (tx) => {
      const newSchool = await tx.school.create({
        data: {
          name: rawName,
          normalizedName: normalized,
          city: rawCity,
          npsn: rawNpsn,
        },
      });

      await tx.teacherSchoolMembership.create({
        data: {
          teacherProfileId: profile.id,
          schoolId: newSchool.id,
          status: "ACTIVE",
          workspaceRole: "OWNER",
        },
      });

      await tx.teacherProfile.update({
        where: { id: profile.id },
        data: { activeSchoolId: newSchool.id },
      });

      return newSchool;
    });

    return {
      success: true,
      school: {
        id: school.id,
        name: school.name,
        npsn: school.npsn,
        city: school.city,
      },
    };
  } catch (err: unknown) {
    // F5: Gracefully tangkap Prisma P2002 bila race condition pada NPSN
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return {
        success: false,
        code: "NPSN_EXISTS",
        message: "Sekolah dengan NPSN tersebut baru saja terdaftar oleh pengguna lain.",
      };
    }
    throw err;
  }
}

export async function getSchoolTeachers() {
  const { activeSchoolId } = await verifyActiveSchoolMembership();

  const memberships = await prisma.teacherSchoolMembership.findMany({
    where: { schoolId: activeSchoolId },
    include: {
      teacherProfile: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
    },
    orderBy: [{ workspaceRole: "asc" }, { createdAt: "asc" }],
  });

  return memberships.map((m) => ({
    id: m.id,
    teacherProfileId: m.teacherProfileId,
    name: m.teacherProfile.user.name,
    email: m.teacherProfile.user.email,
    image: m.teacherProfile.user.image,
    workspaceRole: m.workspaceRole,
    status: m.status,
    createdAt: m.createdAt,
  }));
}

export async function revokeTeacherMembership(teacherSchoolMembershipId: string) {
  const { profile, activeSchoolId, session } = await verifyActiveSchoolMembership();

  // Ambil data keanggotaan pemanggil untuk verifikasi role
  const callerMembership = await prisma.teacherSchoolMembership.findUnique({
    where: {
      teacherProfileId_schoolId: {
        teacherProfileId: profile.id,
        schoolId: activeSchoolId,
      },
    },
  });

  if (!callerMembership || callerMembership.status !== "ACTIVE") {
    throw new Error("Anda bukan anggota aktif dari sekolah ini.");
  }

  // Ambil keanggotaan target
  const targetMembership = await prisma.teacherSchoolMembership.findUnique({
    where: { id: teacherSchoolMembershipId },
    include: {
      teacherProfile: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!targetMembership || targetMembership.schoolId !== activeSchoolId) {
    throw new Error("Keanggotaan guru tidak ditemukan di sekolah aktif Anda.");
  }

  // Guard 1: Larangan me-revoke diri sendiri
  if (targetMembership.teacherProfileId === profile.id) {
    throw new Error("Tidak dapat mencabut akses diri sendiri.");
  }

  // Guard 2 (F2 CRITICAL): MEMBER dilarang me-revoke OWNER
  if (
    callerMembership.workspaceRole === "MEMBER" &&
    targetMembership.workspaceRole === "OWNER"
  ) {
    throw new Error(
      "Hanya SuperAdmin atau pengelola sekolah yang dapat mengubah status Owner."
    );
  }

  // Eksekusi revoke + AuditLog dalam transaksi atomik
  await prisma.$transaction(async (tx) => {
    await tx.teacherSchoolMembership.update({
      where: { id: targetMembership.id },
      data: { status: "REVOKED" },
    });

    // Jika sekolah aktif target adalah sekolah ini, reset activeSchoolId
    if (targetMembership.teacherProfile.activeSchoolId === activeSchoolId) {
      await tx.teacherProfile.update({
        where: { id: targetMembership.teacherProfileId },
        data: { activeSchoolId: null },
      });
    }

    // F7: Standardized AuditLog
    await tx.auditLog.create({
      data: {
        actorType: "USER",
        actorId: session.user.id,
        action: "TEACHER_MEMBERSHIP_REVOKED",
        targetType: "TEACHER_SCHOOL_MEMBERSHIP",
        targetId: targetMembership.id,
        metadata: {
          schoolId: activeSchoolId,
          targetTeacherProfileId: targetMembership.teacherProfileId,
          targetTeacherName: targetMembership.teacherProfile.user.name,
          targetWorkspaceRole: targetMembership.workspaceRole,
        },
      },
    });
  });

  return { success: true };
}
