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
