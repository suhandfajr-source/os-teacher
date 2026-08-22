import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyActiveSchoolMembership } from "@/lib/authorization";
import NewAssessmentClient from "./NewAssessmentClient";

export default async function NewAssessmentPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  let authResult;
  try {
    authResult = await verifyActiveSchoolMembership();
  } catch {
    redirect("/kelas");
  }

  const { profile, activeSchoolId } = authResult;

  // Fetch teaching contexts owned by this teacher in active school
  const teachingContexts = await prisma.teachingContext.findMany({
    where: {
      teacherProfileId: profile.id,
      schoolId: activeSchoolId,
    },
    include: {
      class: true,
      subject: true,
      academicPeriod: true,
      assessmentTypes: {
        where: { isActive: true },
        orderBy: { name: "asc" },
      },
      teachingSessions: {
        orderBy: { date: "desc" },
        take: 20,
      },
    },
    orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
  });

  const contexts = teachingContexts.map((tc) => ({
    id: tc.id,
    className: tc.class.name,
    subjectName: tc.subject.name,
    period: `${tc.academicPeriod.year} ${tc.academicPeriod.semester}`,
    assessmentTypes: tc.assessmentTypes.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
    })),
    sessions: tc.teachingSessions.map((s) => ({
      id: s.id,
      date: s.date,
      actualTopic: s.actualTopic,
      plannedTopic: s.plannedTopic,
    })),
  }));

  return (
    <div className="py-4">
      <NewAssessmentClient contexts={contexts} />
    </div>
  );
}
