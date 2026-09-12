import { QuizDetailClient } from "./QuizDetailClient";

export const dynamic = "force-dynamic";

export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  return <QuizDetailClient quizId={quizId} />;
}
