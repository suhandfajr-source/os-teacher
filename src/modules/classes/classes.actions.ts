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

export interface CreateClassActionInput {
  className: string;
  gradeLevel?: string;
  subjectId?: string;
  newSubjectName?: string;
  academicPeriodId?: string;
  newAcademicYear?: string;
  newAcademicSemester?: string;
}

export async function createClassAction(input: CreateClassActionInput) {
  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

  const className = input.className?.trim();
  if (!className) {
    throw new Error("Nama kelas wajib diisi.");
  }

  const normalizedClassName = className.toUpperCase().replace(/\s+/g, " ");

  return await prisma.$transaction(async (tx) => {
    // 1. Find or create Class in the active school
    let classEntity = await tx.class.findFirst({
      where: {
        schoolId: activeSchoolId,
        name: { equals: className, mode: "insensitive" },
      },
    });

    if (!classEntity) {
      classEntity = await tx.class.create({
        data: {
          schoolId: activeSchoolId,
          name: className,
          normalizedName: normalizedClassName,
          gradeLevel: input.gradeLevel?.trim() || null,
        },
      });
    }

    // 2. Resolve Academic Period
    let periodId = input.academicPeriodId;
    if (!periodId) {
      if (input.newAcademicYear && input.newAcademicSemester) {
        const year = input.newAcademicYear.trim();
        const semester = input.newAcademicSemester.trim();
        let period = await tx.academicPeriod.findUnique({
          where: {
            schoolId_year_semester: {
              schoolId: activeSchoolId,
              year,
              semester,
            },
          },
        });
        if (!period) {
          period = await tx.academicPeriod.create({
            data: {
              schoolId: activeSchoolId,
              year,
              semester,
              status: "ACTIVE",
            },
          });
        }
        periodId = period.id;
      } else {
        // Fallback to latest active period in school
        const activePeriod = await tx.academicPeriod.findFirst({
          where: { schoolId: activeSchoolId, status: "ACTIVE" },
          orderBy: { year: "desc" },
        });
        if (activePeriod) {
          periodId = activePeriod.id;
        } else {
          // Default period if none exists
          const defaultPeriod = await tx.academicPeriod.create({
            data: {
              schoolId: activeSchoolId,
              year: "2024/2025",
              semester: "Ganjil",
              status: "ACTIVE",
            },
          });
          periodId = defaultPeriod.id;
        }
      }
    }

    // 3. Resolve Subject
    let subjectId = input.subjectId;
    if (!subjectId && input.newSubjectName?.trim()) {
      const subjectName = input.newSubjectName.trim();
      const normalizedSub = subjectName.toUpperCase().replace(/\s+/g, " ");
      let subject = await tx.subject.findFirst({
        where: {
          schoolId: activeSchoolId,
          name: { equals: subjectName, mode: "insensitive" },
        },
      });
      if (!subject) {
        subject = await tx.subject.create({
          data: {
            schoolId: activeSchoolId,
            name: subjectName,
            normalizedName: normalizedSub,
          },
        });
      }
      subjectId = subject.id;
    }

    // If still no subjectId, check if teacher has an existing subject or fallback to first subject in school
    if (!subjectId) {
      const existingContext = await tx.teachingContext.findFirst({
        where: { teacherProfileId: profile.id, schoolId: activeSchoolId },
      });
      if (existingContext) {
        subjectId = existingContext.subjectId;
      } else {
        const firstSubject = await tx.subject.findFirst({
          where: { schoolId: activeSchoolId },
        });
        if (firstSubject) {
          subjectId = firstSubject.id;
        } else {
          const defaultSubject = await tx.subject.create({
            data: {
              schoolId: activeSchoolId,
              name: "Mata Pelajaran Umum",
              normalizedName: "MATA PELAJARAN UMUM",
            },
          });
          subjectId = defaultSubject.id;
        }
      }
    }

    // 4. Create or return TeachingContext
    let context = await tx.teachingContext.findUnique({
      where: {
        teacherProfileId_schoolId_academicPeriodId_subjectId_classId: {
          teacherProfileId: profile.id,
          schoolId: activeSchoolId,
          academicPeriodId: periodId,
          subjectId: subjectId,
          classId: classEntity.id,
        },
      },
    });

    if (!context) {
      context = await tx.teachingContext.create({
        data: {
          teacherProfileId: profile.id,
          schoolId: activeSchoolId,
          academicPeriodId: periodId,
          subjectId: subjectId,
          classId: classEntity.id,
        },
      });
    }

    return {
      success: true,
      classEntity,
      contextId: context.id,
    };
  });
}

