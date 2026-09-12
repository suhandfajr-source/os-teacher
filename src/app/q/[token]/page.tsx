import { QuizStudentClient } from "./QuizStudentClient";

export const dynamic = "force-dynamic";

export default async function PublicQuizPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <QuizStudentClient token={token} />;
}
