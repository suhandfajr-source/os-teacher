import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAcademicContext } from "@/modules/academic/academic.actions";
import AcademicClient from "@/app/(dashboard)/akademik/AcademicClient";
import KelasTabs from "../KelasTabs";

export default async function ContextualAcademicPage({
  params,
}: {
  params: Promise<{ teachingContextId: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const { teachingContextId } = await params;

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile || !profile.activeSchoolId) redirect("/onboarding");

  // Fetch teaching contexts for dropdown
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

  let academicData = null;
  try {
    academicData = await getAcademicContext(teachingContextId);
  } catch (err) {
    console.error("Error loading academic context:", err);
    redirect("/akademik");
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      <KelasTabs teachingContextId={teachingContextId} />
      <AcademicClient
        contexts={formattedContexts}
        initialContextId={teachingContextId}
        initialData={academicData}
      />
    </div>
  );
}
