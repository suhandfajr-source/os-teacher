import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AcademicClient from "./AcademicClient";
import { getAcademicContext } from "@/modules/academic/academic.actions";

export default async function AcademicPage({
  searchParams,
}: {
  searchParams: Promise<{ contextId?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile || !profile.activeSchoolId) redirect("/onboarding");

  // Fetch teaching contexts owned by this teacher in the active school
  const contexts = await prisma.teachingContext.findMany({
    where: {
      teacherProfileId: profile.id,
      schoolId: profile.activeSchoolId,
    },
    include: {
      class: true,
      subject: true,
      academicPeriod: true,
    },
    orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
  });

  const formattedContexts = contexts.map((c) => ({
    id: c.id,
    className: c.class.name,
    subjectName: c.subject.name,
    academicPeriodYear: c.academicPeriod.year,
    academicPeriodSemester: c.academicPeriod.semester,
  }));

  const params = await searchParams;
  let activeContextId = params?.contextId;
  if (!activeContextId && formattedContexts.length > 0) {
    activeContextId = formattedContexts[0].id;
  }

  let academicData = null;
  if (activeContextId) {
    try {
      academicData = await getAcademicContext(activeContextId);
    } catch {
      academicData = null;
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      <AcademicClient
        contexts={formattedContexts}
        initialContextId={activeContextId}
        initialData={academicData}
      />
    </div>
  );
}
