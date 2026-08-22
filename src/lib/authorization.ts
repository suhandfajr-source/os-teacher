import { prisma, auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function requireAuthSession() {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function verifyActiveSchoolMembership() {
  const session = await requireAuthSession();

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id }
  });

  if (!profile || !profile.activeSchoolId) {
    throw new Error("Teacher profile or active school not found");
  }

  const activeSchool = await prisma.school.findUnique({
    where: { id: profile.activeSchoolId }
  });
  
  if (!activeSchool) throw new Error("Active school not found");

  const membership = await prisma.teacherSchoolMembership.findUnique({
    where: {
      teacherProfileId_schoolId: {
        teacherProfileId: profile.id,
        schoolId: profile.activeSchoolId
      }
    }
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("Not an active member of the school workspace");
  }

  return { session, profile, activeSchoolId: profile.activeSchoolId, activeSchool };
}

export async function verifyTeachingContextAccess(teachingContextId: string) {
  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

  const context = await prisma.teachingContext.findUnique({
    where: { id: teachingContextId }
  });

  if (!context) {
    throw new Error("Teaching context not found");
  }

  if (context.teacherProfileId !== profile.id) {
    throw new Error("Forbidden: You do not own this teaching context");
  }

  if (context.schoolId !== activeSchoolId) {
    throw new Error("Forbidden: This context belongs to a different school workspace");
  }

  return { profile, activeSchoolId, context };
}

export async function verifyClassRosterAccess(classId: string) {
  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

  // Determine if the teacher has any TeachingContext for this class in this school
  const context = await prisma.teachingContext.findFirst({
    where: {
      teacherProfileId: profile.id,
      schoolId: activeSchoolId,
      classId: classId
    }
  });

  if (!context) {
    throw new Error("Forbidden: You do not teach this class");
  }

  return { profile, activeSchoolId, context };
}

export async function verifyTeachingSessionAccess(sessionId: string) {
  const session = await prisma.teachingSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error("Teaching session not found");
  }

  const contextAuth = await verifyTeachingContextAccess(session.teachingContextId);

  return { ...contextAuth, session };
}

export async function verifyAssessmentAccess(assessmentId: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      assessmentType: true,
      teachingContext: {
        include: {
          class: true,
          subject: true,
          academicPeriod: true
        }
      }
    }
  });

  if (!assessment) {
    throw new Error("Assessment not found");
  }

  const contextAuth = await verifyTeachingContextAccess(assessment.teachingContextId);

  return { ...contextAuth, assessment };
}

export async function verifyAssessmentTypeAccess(assessmentTypeId: string) {
  const assessmentType = await prisma.assessmentType.findUnique({
    where: { id: assessmentTypeId }
  });

  if (!assessmentType) {
    throw new Error("Assessment type not found");
  }

  const contextAuth = await verifyTeachingContextAccess(assessmentType.teachingContextId);

  return { ...contextAuth, assessmentType };
}

export async function verifyGradePolicyAccess(gradePolicyId: string) {
  const gradePolicy = await prisma.gradePolicy.findUnique({
    where: { id: gradePolicyId },
    include: {
      items: {
        include: {
          assessmentType: true
        },
        orderBy: { sortOrder: "asc" }
      }
    }
  });

  if (!gradePolicy) {
    throw new Error("Grade policy not found");
  }

  const contextAuth = await verifyTeachingContextAccess(gradePolicy.teachingContextId);

  return { ...contextAuth, gradePolicy };
}

export async function verifyAssessmentResultAccess(resultId: string) {
  const result = await prisma.assessmentResult.findUnique({
    where: { id: resultId },
    include: {
      assessment: true,
      student: true
    }
  });

  if (!result) {
    throw new Error("Assessment result not found");
  }

  const assessmentAuth = await verifyAssessmentAccess(result.assessmentId);

  return { ...assessmentAuth, result };
}

export async function verifyStudentScoreHistoryAccess(studentId: string) {
  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

  // Validate student belongs to this active school and is enrolled in at least one class taught by current teacher
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      schoolId: activeSchoolId,
      classMemberships: {
        some: {
          class: {
            teachingContexts: {
              some: {
                teacherProfileId: profile.id,
                schoolId: activeSchoolId
              }
            }
          }
        }
      }
    }
  });

  if (!student) {
    throw new Error("Forbidden: You do not teach this student or student not found");
  }

  return { profile, activeSchoolId, student };
}

