import { redirect } from "next/navigation";
import { prisma } from "@/lib/auth";
import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { SiswaListClient } from "./SiswaListClient";
import { getPendingStudentsForMyClassesAction } from "@/modules/approvals/approvals.actions";

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

  // Story 5 — Panel L1 via action terpusat (BH-10: tanpa duplikasi query).
  const pendingRes = await getPendingStudentsForMyClassesAction();
  const pendingStudents = (pendingRes.pending ?? []).map((p: {
    studentId: string;
    fullName: string;
    nis: string | null;
    className: string;
    escalated: boolean;
    accountRequestedAt: string | null;
  }) => ({
    studentId: p.studentId,
    fullName: p.fullName,
    nis: p.nis,
    className: p.className,
    escalated: p.escalated,
    accountRequestedAt: p.accountRequestedAt,
  }));

  return (
    <SiswaListClient
      classGroups={classGroups}
      totalStudents={uniqueStudentIds.size}
      pendingStudents={pendingStudents}
    />
  );
}

