import { redirect } from "next/navigation";
import { getCbtSessionCockpitAction } from "@/modules/cbt-live/cbt-live.actions";
import { CbtLiveCockpitClient } from "./CbtLiveCockpitClient";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function CbtLivePage({ params }: Props) {
  const { sessionId } = await params;
  const res = await getCbtSessionCockpitAction(sessionId);

  if (!res.success || !res.data) {
    redirect("/quiz");
  }

  return <CbtLiveCockpitClient initialData={res.data} />;
}
