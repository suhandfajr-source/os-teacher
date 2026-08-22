import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAssessmentDetailData } from "@/modules/assessment/assessment.actions";
import AssessmentDetailClient from "./AssessmentDetailClient";

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const { assessmentId } = await params;

  let data;
  try {
    data = await getAssessmentDetailData(assessmentId);
  } catch {
    redirect("/assessment");
  }

  return (
    <div className="py-4">
      <AssessmentDetailClient
        assessment={data.assessment}
        results={data.results}
        stats={data.stats}
      />
    </div>
  );
}
