import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getClassAssessmentData } from "@/modules/assessment/assessment.actions";
import PenilaianClient from "./PenilaianClient";

export default async function PenilaianPage({
  params,
}: {
  params: Promise<{ teachingContextId: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const { teachingContextId } = await params;

  let data;
  try {
    data = await getClassAssessmentData(teachingContextId);
  } catch {
    redirect(`/kelas/${teachingContextId}`);
  }

  return (
    <div className="py-6">
      <PenilaianClient
        teachingContextId={teachingContextId}
        assessments={data.assessments}
        gradePolicy={data.gradePolicy}
        runningGrades={data.runningGrades}
      />
    </div>
  );
}
