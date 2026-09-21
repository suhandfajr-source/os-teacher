"use server";

import { prisma } from "@/lib/auth";
import { verifyActiveSchoolMembership } from "@/lib/authorization";
import { Prisma } from "@prisma/client";

/**
 * Proyeksi aman untuk model Student (VG-other2 & F6).
 * accessPinHash mutlak dilarang diekspos ke klien.
 */
const SAFE_STUDENT_SELECT = {
  id: true,
  schoolId: true,
  fullName: true,
  nis: true,
  status: true,
  accountStatus: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function addStudent(data: { fullName: string; nis?: string | null }) {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();

  const cleanFullName = data.fullName.trim();
  const cleanNis = data.nis && data.nis.trim() ? data.nis.trim().toUpperCase() : null;

  if (cleanNis) {
    const existing = await prisma.student.findFirst({
      where: {
        schoolId: activeSchoolId,
        nis: { equals: cleanNis, mode: "insensitive" },
      },
      select: SAFE_STUDENT_SELECT,
    });

    if (existing) {
      throw new Error(`Siswa dengan NIS ${cleanNis} sudah terdaftar di sekolah ini.`);
    }
  }

  try {
    const student = await prisma.student.create({
      data: {
        schoolId: activeSchoolId,
        fullName: cleanFullName,
        nis: cleanNis,
        createdByTeacherProfileId: profile.id,
        updatedByTeacherProfileId: profile.id,
      },
      select: SAFE_STUDENT_SELECT,
    });

    return { success: true, student };
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error(`Siswa dengan NIS ${cleanNis} sudah terdaftar di sekolah ini.`);
    }
    throw err;
  }
}

export async function findOrCreateStudent(data: { fullName: string; nis?: string | null }) {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();

  const cleanFullName = data.fullName.trim();
  const cleanNis = data.nis && data.nis.trim() ? data.nis.trim().toUpperCase() : null;

  if (cleanNis) {
    const existing = await prisma.student.findFirst({
      where: {
        schoolId: activeSchoolId,
        nis: { equals: cleanNis, mode: "insensitive" },
      },
      select: SAFE_STUDENT_SELECT,
    });

    if (existing) {
      if (existing.fullName.toLowerCase() !== cleanFullName.toLowerCase()) {
        return {
          success: true,
          student: existing,
          warning: `Siswa ditemukan dengan NIS ${cleanNis} tetapi nama berbeda (Database: ${existing.fullName}, Input: ${cleanFullName}). Menggunakan data yang sudah ada.`,
        };
      }
      return { success: true, student: existing };
    }
  } else {
    // Attempt name match jika tanpa NIS
    const existingByName = await prisma.student.findFirst({
      where: {
        schoolId: activeSchoolId,
        fullName: { equals: cleanFullName, mode: "insensitive" },
      },
      select: SAFE_STUDENT_SELECT,
    });

    if (existingByName) {
      return {
        success: true,
        student: existingByName,
        warning: `Siswa cocok berdasarkan nama (${cleanFullName}) tanpa NIS. Menggunakan data yang sudah ada.`,
      };
    }
  }

  try {
    const student = await prisma.student.create({
      data: {
        schoolId: activeSchoolId,
        fullName: cleanFullName,
        nis: cleanNis,
        createdByTeacherProfileId: profile.id,
        updatedByTeacherProfileId: profile.id,
      },
      select: SAFE_STUDENT_SELECT,
    });

    return { success: true, student };
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error(`Siswa dengan NIS ${cleanNis} sudah terdaftar di sekolah ini.`);
    }
    throw err;
  }
}

export async function getStudents() {
  const { activeSchoolId } = await verifyActiveSchoolMembership();

  return await prisma.student.findMany({
    where: {
      schoolId: activeSchoolId,
      status: "ACTIVE",
    },
    select: SAFE_STUDENT_SELECT,
    orderBy: { fullName: "asc" },
  });
}

export async function updateStudent(id: string, data: { fullName?: string; nis?: string | null }) {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();

  const student = await prisma.student.findUnique({
    where: { id },
    select: { id: true, schoolId: true, nis: true },
  });

  if (!student || student.schoolId !== activeSchoolId) {
    throw new Error("Student not found");
  }

  const updateData: { fullName?: string; nis?: string | null; updatedByTeacherProfileId: string } = {
    updatedByTeacherProfileId: profile.id,
  };

  if (data.fullName !== undefined) {
    updateData.fullName = data.fullName.trim();
  }

  if (data.nis !== undefined) {
    const cleanNis = data.nis && data.nis.trim() ? data.nis.trim().toUpperCase() : null;

    if (cleanNis && cleanNis !== student.nis) {
      const existing = await prisma.student.findFirst({
        where: {
          schoolId: activeSchoolId,
          nis: { equals: cleanNis, mode: "insensitive" },
          id: { not: id },
        },
        select: { id: true },
      });

      if (existing) {
        throw new Error(`NIS ${cleanNis} is already used.`);
      }
    }

    updateData.nis = cleanNis;
  }

  try {
    return await prisma.student.update({
      where: { id },
      data: updateData,
      select: SAFE_STUDENT_SELECT,
    });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error(`NIS ${updateData.nis} is already used.`);
    }
    throw err;
  }
}

export async function archiveStudent(id: string) {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();

  const student = await prisma.student.findUnique({
    where: { id },
    select: { id: true, schoolId: true },
  });

  if (!student || student.schoolId !== activeSchoolId) {
    throw new Error("Student not found");
  }

  return await prisma.student.update({
    where: { id },
    data: {
      status: "ARCHIVED",
      updatedByTeacherProfileId: profile.id,
    },
    select: SAFE_STUDENT_SELECT,
  });
}
