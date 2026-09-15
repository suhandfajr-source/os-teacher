import { Metadata } from "next";
import { getTeacherTeachingContextsAction, getAiDraftsAction } from "@/modules/ai/ai.actions";
import { AiStudioClient } from "./AiStudioClient";
import { AiStudioFlowType } from "@/modules/ai/ai.types";

export const metadata: Metadata = {
  title: "Perangkat Ajar & AI | OS Teacher",
  description: "Bantu siapkan draf materi, rencana aktivitas, instruksi tugas, dan rubrik pembelajaran.",
};

export default async function AiStudioPage(props: {
  searchParams: Promise<{ flow?: string }>;
}) {
  const searchParams = await props.searchParams;
  const [contexts, initialDrafts] = await Promise.all([
    getTeacherTeachingContextsAction().catch(() => []),
    getAiDraftsAction({ status: "ACTIVE" }).catch(() => []),
  ]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <AiStudioClient
        contexts={contexts}
        initialDrafts={initialDrafts}
        initialFlow={searchParams?.flow as AiStudioFlowType | undefined}
      />
    </div>
  );
}
