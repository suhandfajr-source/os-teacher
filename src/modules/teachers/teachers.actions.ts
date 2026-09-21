"use server";

import { prisma } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  normalizeSchoolName,
  evaluateSchoolDedup,
  type ExistingSchoolCandidate,
} from "@/lib/school-dedup";

async function validateSession() {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

export type SubmitOnboardingResult = {
  success: boolean;
  context?: { id: string } | null;
  code?: "NPSN_EXISTS" | "EXACT_NAME_EXISTS" | "SIMILAR_NAME_FOUND" | "CREATE_FAILED";
  message?: string;
  existingSchool?: ExistingSchoolCandidate;
  matchedSchool?: ExistingSchoolCandidate;
  similarity?: number;
};

export async function submitOnboarding(data: {
  fullName: string;
  schoolId?: string;
  schoolName?: string;
  city?: string;
  npsn?: string;
  forceCreate?: boolean;
  preferredName?: string;
  academicYear: string;
  semester: string;
  subjectName: string;
  subjectShortName?: string;
  className: string;
  gradeLevel?: string;
}): Promise<SubmitOnboardingResult> {
  const session = await validateSession();

  // 1. Update User Name
  if (data.fullName && data.fullName !== session.user.name) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { name: data.fullName }
    });
  }

  return await prisma.$transaction(async (tx) => {
    // 2. Create or Get TeacherProfile
    let profile = await tx.teacherProfile.findUnique({
      where: { userId: session.user.id }
    });

    if (!profile) {
      profile = await tx.teacherProfile.create({
        data: {
          userId: session.user.id,
          preferredName: data.preferredName || null,
          onboardingCompleted: false
        }
      });
    } else {
      profile = await tx.teacherProfile.update({
        where: { id: profile.id },
        data: {
          preferredName: data.preferredName !== undefined ? data.preferredName : profile.preferredName
        }
      });
    }

    // 3. Resolve School Workspace
    let targetSchoolId = data.schoolId;
    if (!targetSchoolId && data.schoolName) {
      const rawSchoolName = data.schoolName.trim();
      const rawNpsn = data.npsn?.trim() || null;
      const rawCity = data.city?.trim() || null;
      const normalizedSchool = normalizeSchoolName(rawSchoolName);

      // Candidate pre-filtering
      const candidateConditions: any[] = [{ normalizedName: normalizedSchool }];
      if (rawNpsn) candidateConditions.push({ npsn: rawNpsn });
      if (rawCity) candidateConditions.push({ city: { contains: rawCity, mode: "insensitive" } });

      const candidateRows = await tx.school.findMany({
        where: { OR: candidateConditions },
        take: 50,
        select: { id: true, name: true, normalizedName: true, npsn: true, city: true },
      });

      const dedupResult = evaluateSchoolDedup(
        { name: rawSchoolName, npsn: rawNpsn, forceCreate: data.forceCreate },
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

      // Create new school
      const newSchool = await tx.school.create({
        data: {
          name: rawSchoolName,
          normalizedName: normalizedSchool,
          city: rawCity,
          npsn: rawNpsn,
        }
      });
      targetSchoolId = newSchool.id;
      
      // Auto-join as OWNER
      await tx.teacherSchoolMembership.create({
        data: {
          teacherProfileId: profile.id,
          schoolId: targetSchoolId,
          status: "ACTIVE",
          workspaceRole: "OWNER"
        }
      });
    } else if (targetSchoolId) {
      // Join existing school if not already member
      const existingMembership = await tx.teacherSchoolMembership.findUnique({
        where: {
          teacherProfileId_schoolId: {
            teacherProfileId: profile.id,
            schoolId: targetSchoolId
          }
        }
      });

      if (existingMembership?.status === "REVOKED") {
        throw new Error("Keanggotaan Anda di sekolah ini telah dinonaktifkan. Hubungi pengelola sekolah.");
      }

      if (!existingMembership) {
        await tx.teacherSchoolMembership.create({
          data: {
            teacherProfileId: profile.id,
            schoolId: targetSchoolId,
            status: "ACTIVE",
            workspaceRole: "MEMBER"
          }
        });
      }
    } else {
      throw new Error("Either schoolId or schoolName must be provided");
    }

    // Set active school and complete onboarding
    await tx.teacherProfile.update({
      where: { id: profile.id },
      data: {
        activeSchoolId: targetSchoolId,
        onboardingCompleted: true
      }
    });

    // 4. Reuse or Create AcademicPeriod (Shared within School)
    let period = await tx.academicPeriod.findUnique({
      where: {
        schoolId_year_semester: {
          schoolId: targetSchoolId,
          year: data.academicYear,
          semester: data.semester
        }
      }
    });

    if (!period) {
      period = await tx.academicPeriod.create({
        data: {
          schoolId: targetSchoolId,
          year: data.academicYear,
          semester: data.semester,
          status: "ACTIVE" // Legacy
        }
      });
    }

    // 5. Reuse or Create Subject (Shared within School)
    const normalizedSubject = normalizeName(data.subjectName);
    let subject = await tx.subject.findUnique({
      where: {
        schoolId_normalizedName: {
          schoolId: targetSchoolId,
          normalizedName: normalizedSubject
        }
      }
    });

    if (!subject) {
      subject = await tx.subject.create({
        data: {
          schoolId: targetSchoolId,
          name: data.subjectName,
          normalizedName: normalizedSubject,
          shortName: data.subjectShortName || null
        }
      });
    }

    // 6. Reuse or Create Class (Shared within School)
    const normalizedClass = normalizeName(data.className);
    let classEntity = await tx.class.findUnique({
      where: {
        schoolId_normalizedName: {
          schoolId: targetSchoolId,
          normalizedName: normalizedClass
        }
      }
    });

    if (!classEntity) {
      classEntity = await tx.class.create({
        data: {
          schoolId: targetSchoolId,
          name: data.className,
          normalizedName: normalizedClass,
          gradeLevel: data.gradeLevel || null
        }
      });
    }

    // 7. Create Teaching Context
    const existingContext = await tx.teachingContext.findUnique({
      where: {
        teacherProfileId_schoolId_academicPeriodId_subjectId_classId: {
          teacherProfileId: profile.id,
          schoolId: targetSchoolId,
          academicPeriodId: period.id,
          subjectId: subject.id,
          classId: classEntity.id
        }
      }
    });

    let context = existingContext;
    if (!context) {
      context = await tx.teachingContext.create({
        data: {
          teacherProfileId: profile.id,
          schoolId: targetSchoolId,
          academicPeriodId: period.id,
          subjectId: subject.id,
          classId: classEntity.id
        }
      });
    }

    return { success: true, context };
  });
}

export async function switchActiveSchool(schoolId: string) {
  const session = await validateSession();
  
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id }
  });
  
  if (!profile) throw new Error("Teacher profile not found");

  const membership = await prisma.teacherSchoolMembership.findUnique({
    where: {
      teacherProfileId_schoolId: {
        teacherProfileId: profile.id,
        schoolId
      }
    }
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("Not an active member of this school");
  }

  await prisma.teacherProfile.update({
    where: { id: profile.id },
    data: { activeSchoolId: schoolId }
  });

  return { success: true };
}
