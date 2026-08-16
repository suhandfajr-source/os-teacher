"use server";

import { prisma } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

async function validateSession() {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function submitOnboarding(data: {
  fullName: string;
  schoolName: string;
  preferredName?: string;
  academicYear: string;
  semester: string;
  subjectName: string;
  subjectShortName?: string;
  className: string;
  gradeLevel?: string;
}) {
  const session = await validateSession();

  // If fullName is edited, update User.name (Single Source of Truth)
  if (data.fullName && data.fullName !== session.user.name) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { name: data.fullName }
    });
  }

  // Create or Update Teacher Profile
  const profile = await prisma.teacherProfile.upsert({
    where: { userId: session.user.id },
    update: {
      schoolName: data.schoolName,
      preferredName: data.preferredName || null,
      onboardingCompleted: true,
    },
    create: {
      userId: session.user.id,
      schoolName: data.schoolName,
      preferredName: data.preferredName || null,
      onboardingCompleted: true,
    }
  });

  // Create Academic Period
  const period = await prisma.academicPeriod.create({
    data: {
      teacherProfileId: profile.id,
      year: data.academicYear,
      semester: data.semester,
      status: "ACTIVE"
    }
  });

  // Create Subject
  const subject = await prisma.subject.create({
    data: {
      teacherProfileId: profile.id,
      name: data.subjectName,
      shortName: data.subjectShortName || null,
    }
  });

  // Create Class
  const classEntity = await prisma.class.create({
    data: {
      teacherProfileId: profile.id,
      name: data.className,
      gradeLevel: data.gradeLevel || null,
    }
  });

  // Create Teaching Context Relationship
  await prisma.teachingContext.create({
    data: {
      teacherProfileId: profile.id,
      academicPeriodId: period.id,
      subjectId: subject.id,
      classId: classEntity.id,
    }
  });

  return { success: true };
}
