"use server";

import { prisma } from "@/lib/auth";
import { verifyActiveSchoolMembership } from "@/lib/authorization";

export async function getClassRoster(classId: string, academicPeriodId: string) {
  const { activeSchoolId } = await verifyActiveSchoolMembership();

  return await prisma.classStudent.findMany({
    where: {
      class: {
        id: classId,
        schoolId: activeSchoolId
      },
      academicPeriodId
    },
    include: {
      student: true
    }
  });
}

export async function enrollStudentInClass(classId: string, studentId: string, academicPeriodId: string) {
  const { activeSchoolId } = await verifyActiveSchoolMembership();

  // Validate class belongs to school
  const targetClass = await prisma.class.findUnique({ where: { id: classId } });
  if (!targetClass || targetClass.schoolId !== activeSchoolId) {
    throw new Error("Class not found");
  }

  // Validate student belongs to school
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || student.schoolId !== activeSchoolId) {
    throw new Error("Student not found");
  }

  const existing = await prisma.classStudent.findUnique({
    where: {
      studentId_academicPeriodId: { studentId, academicPeriodId }
    }
  });

  if (existing) {
    // Student already enrolled somewhere in this period.
    if (existing.classId === classId) return { success: true, record: existing };
    
    // Update to new class if they were in a different class
    const record = await prisma.classStudent.update({
      where: { id: existing.id },
      data: { classId }
    });
    return { success: true, record };
  }

  const record = await prisma.classStudent.create({
    data: {
      classId,
      studentId,
      academicPeriodId
    }
  });

  return { success: true, record };
}

export async function removeStudentFromClass(studentId: string, academicPeriodId: string) {
  const { activeSchoolId } = await verifyActiveSchoolMembership();

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || student.schoolId !== activeSchoolId) {
    throw new Error("Student not found");
  }

  await prisma.classStudent.delete({
    where: {
      studentId_academicPeriodId: { studentId, academicPeriodId }
    }
  });

  return { success: true };
}
