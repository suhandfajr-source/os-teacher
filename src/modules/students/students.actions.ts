"use server";

import { prisma } from "@/lib/auth";
import { verifyActiveSchoolMembership } from "@/lib/authorization";

export async function addStudent(data: { fullName: string, nis: string }) {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();

  if (data.nis) {
    const existing = await prisma.student.findUnique({
      where: {
        schoolId_nis: {
          schoolId: activeSchoolId,
          nis: data.nis
        }
      }
    });

    if (existing) {
      throw new Error(`Student with NIS ${data.nis} already exists in this school.`);
    }
  }

  const student = await prisma.student.create({
    data: {
      schoolId: activeSchoolId,
      fullName: data.fullName,
      nis: data.nis || null,
      createdByTeacherProfileId: profile.id,
      updatedByTeacherProfileId: profile.id
    }
  });

  return { success: true, student };
}

export async function findOrCreateStudent(data: { fullName: string, nis: string }) {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();

  if (data.nis) {
    const existing = await prisma.student.findUnique({
      where: {
        schoolId_nis: {
          schoolId: activeSchoolId,
          nis: data.nis
        }
      }
    });

    if (existing) {
      if (existing.fullName.toLowerCase() !== data.fullName.toLowerCase()) {
        return { 
          success: true, 
          student: existing, 
          warning: `Student found with NIS ${data.nis} but name differs (Database: ${existing.fullName}, Input: ${data.fullName}). Reusing existing record.`
        };
      }
      return { success: true, student: existing };
    }
  } else {
    // Attempt name match
    const existingByName = await prisma.student.findFirst({
      where: {
        schoolId: activeSchoolId,
        fullName: { equals: data.fullName, mode: 'insensitive' }
      }
    });

    if (existingByName) {
      return { 
        success: true, 
        student: existingByName, 
        warning: `Student matched by name (${data.fullName}) without NIS. Reusing existing record.`
      };
    }
  }

  const student = await prisma.student.create({
    data: {
      schoolId: activeSchoolId,
      fullName: data.fullName,
      nis: data.nis || null,
      createdByTeacherProfileId: profile.id,
      updatedByTeacherProfileId: profile.id
    }
  });

  return { success: true, student };
}

export async function getStudents() {
  const { activeSchoolId } = await verifyActiveSchoolMembership();

  return await prisma.student.findMany({
    where: {
      schoolId: activeSchoolId,
      status: "ACTIVE"
    },
    orderBy: { fullName: "asc" }
  });
}

export async function updateStudent(id: string, data: { fullName?: string, nis?: string }) {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student || student.schoolId !== activeSchoolId) {
    throw new Error("Student not found");
  }

  if (data.nis && data.nis !== student.nis) {
    const existing = await prisma.student.findUnique({
      where: { schoolId_nis: { schoolId: activeSchoolId, nis: data.nis } }
    });
    if (existing) throw new Error(`NIS ${data.nis} is already used.`);
  }

  return await prisma.student.update({
    where: { id },
    data: {
      ...data,
      updatedByTeacherProfileId: profile.id
    }
  });
}

export async function archiveStudent(id: string) {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student || student.schoolId !== activeSchoolId) {
    throw new Error("Student not found");
  }

  return await prisma.student.update({
    where: { id },
    data: { 
      status: "ARCHIVED",
      updatedByTeacherProfileId: profile.id
    }
  });
}
