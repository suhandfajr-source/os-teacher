import { redirect } from "next/navigation";
import { prisma } from "@/lib/auth";
import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { SiswaListClient } from "./SiswaListClient";

export default async function SiswaPage() {
  let authContext = null;
  try {
    authContext = await getRscAuthContext();
  } catch {
    redirect("/login");
  }

  const { profile, activeSchoolId } = authContext;
  if (!activeSchoolId) redirect("/onboarding");

  // Query classes taught by the teacher with their enrolled students
  const classes = await prisma.class.findMany({
    where: {
      schoolId: activeSchoolId,
      teachingContexts: {
        some: {
          teacherProfileId: profile.id,
        },
      },
    },
    include: {
      classStudents: {
        include: {
          student: true,
        },
        orderBy: {
          student: {
            fullName: "asc",
          },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const uniqueStudentIds = new Set<string>();
  const classGroups = classes.map((c) => {
    const students = c.classStudents
      .filter((cs) => cs.student.status === "ACTIVE")
      .map((cs) => {
        uniqueStudentIds.add(cs.student.id);
        return {
          id: cs.student.id,
          fullName: cs.student.fullName,
          nis: cs.student.nis,
        };
      });

    return {
      id: c.id,
      name: c.name,
      gradeLevel: c.gradeLevel,
      students,
    };
  });

  return (
    <SiswaListClient
      classGroups={classGroups}
      totalStudents={uniqueStudentIds.size}
    />
  );
}

