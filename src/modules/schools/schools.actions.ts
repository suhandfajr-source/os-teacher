"use server";

import { prisma } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

async function validateSession() {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function searchSchools(query: string) {
  if (!query || query.length < 3) return [];
  
  return await prisma.school.findMany({
    where: {
      name: { contains: query, mode: 'insensitive' }
    },
    take: 10,
    select: {
      id: true,
      name: true,
      city: true,
      npsn: true
    }
  });
}

export async function joinSchool(schoolId: string) {
  const session = await validateSession();
  
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id }
  });
  
  if (!profile) {
    throw new Error("Teacher profile not found");
  }

  // Check if membership already exists
  const existingMembership = await prisma.teacherSchoolMembership.findUnique({
    where: {
      teacherProfileId_schoolId: {
        teacherProfileId: profile.id,
        schoolId: schoolId
      }
    }
  });

  if (!existingMembership) {
    await prisma.teacherSchoolMembership.create({
      data: {
        teacherProfileId: profile.id,
        schoolId: schoolId,
        status: "ACTIVE",
        workspaceRole: "MEMBER"
      }
    });
  } else if (existingMembership.status === "REVOKED") {
     await prisma.teacherSchoolMembership.update({
      where: { id: existingMembership.id },
      data: { status: "ACTIVE" }
    });
  }

  // Set as active school
  await prisma.teacherProfile.update({
    where: { id: profile.id },
    data: { activeSchoolId: schoolId }
  });
  
  return { success: true };
}

export async function createSchool(data: { name: string, city?: string, npsn?: string }) {
  const session = await validateSession();
  
  let profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id }
  });
  
  // If profile doesn't exist (e.g. during onboarding), we should probably create it.
  // But wait, submitOnboarding usually handles profile creation.
  // Let's assume profile is created by the caller if needed.
  if (!profile) {
     profile = await prisma.teacherProfile.create({
         data: {
             userId: session.user.id,
             onboardingCompleted: false
         }
     });
  }

  const normalized = normalizeName(data.name);

  // Prisma transactions to create School and Membership
  const school = await prisma.$transaction(async (tx) => {
    const newSchool = await tx.school.create({
      data: {
        name: data.name,
        normalizedName: normalized,
        city: data.city || null,
        npsn: data.npsn || null
      }
    });

    await tx.teacherSchoolMembership.create({
      data: {
        teacherProfileId: profile.id,
        schoolId: newSchool.id,
        status: "ACTIVE",
        workspaceRole: "OWNER"
      }
    });

    await tx.teacherProfile.update({
      where: { id: profile.id },
      data: { activeSchoolId: newSchool.id }
    });

    return newSchool;
  });

  return { success: true, school };
}
