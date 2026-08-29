import { prisma } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { KelasOverviewClient } from "./KelasOverviewClient";

export default async function KelasPage() {
  let authContext = null;
  try {
    authContext = await getRscAuthContext();
  } catch {
    redirect("/login");
  }

  const { profile, activeSchoolId, activeSchool } = authContext;

  if (!activeSchoolId) redirect("/onboarding");

  // Fetch teaching contexts and school master data in parallel
  const [contexts, schoolClasses, schoolSubjects, schoolAcademicPeriods] = await Promise.all([
    prisma.teachingContext.findMany({
      where: {
        teacherProfileId: profile.id,
        schoolId: activeSchoolId,
      },
      include: {
        subject: true,
        class: {
          include: {
            _count: {
              select: { classStudents: true },
            },
          },
        },
        academicPeriod: true,
      },
      orderBy: [
        { academicPeriod: { year: "desc" } },
        { class: { name: "asc" } },
      ],
    }),
    prisma.class.findMany({
      where: { schoolId: activeSchoolId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, gradeLevel: true },
    }),
    prisma.subject.findMany({
      where: { schoolId: activeSchoolId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.academicPeriod.findMany({
      where: { schoolId: activeSchoolId, entityStatus: "ACTIVE" },
      orderBy: { year: "desc" },
      select: { id: true, year: true, semester: true, status: true },
    }),
  ]);

  return (
    <KelasOverviewClient
      contexts={contexts}
      schoolMaster={{
        classes: schoolClasses,
        subjects: schoolSubjects,
        academicPeriods: schoolAcademicPeriods,
      }}
      schoolName={activeSchool?.name || "Sekolah"}
    />
  );
}

