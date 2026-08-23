import { Metadata } from "next";
import { getTeacherTeachingContextsAction, getAiDraftsAction } from "@/modules/ai/ai.actions";
import { AiStudioClient } from "./AiStudioClient";

export const metadata: Metadata = {
  title: "AI Content Studio | Teacher OS",
  description: "Bantu siapkan draf materi, rencana aktivitas, instruksi tugas, dan rubrik pembelajaran.",
};

export default async function AiStudioPage() {
  const [contexts, initialDrafts] = await Promise.all([
    getTeacherTeachingContextsAction().catch(() => []),
    getAiDraftsAction({ status: "ACTIVE" }).catch(() => []),
  ]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <AiStudioClient
        contexts={contexts}
        initialDrafts={initialDrafts}
      />
    </div>
  );
}
