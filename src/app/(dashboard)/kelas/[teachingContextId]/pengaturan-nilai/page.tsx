import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getGradePolicyData } from "@/modules/assessment/assessment.actions";
import PengaturanNilaiClient from "./PengaturanNilaiClient";

export default async function PengaturanNilaiPage({
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
    data = await getGradePolicyData(teachingContextId);
  } catch {
    redirect(`/kelas/${teachingContextId}`);
  }

  return (
    <div className="py-6">
      <PengaturanNilaiClient
        teachingContextId={teachingContextId}
        policy={data.policy}
        assessmentTypes={data.assessmentTypes}
        otherContexts={data.otherContexts}
        scoredAssessmentCount={data.scoredAssessmentCount}
      />
    </div>
  );
}
