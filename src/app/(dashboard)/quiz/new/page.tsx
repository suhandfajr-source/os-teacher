import { Suspense } from "react";
import { NewQuizClient } from "./NewQuizClient";

export const dynamic = "force-dynamic";

export default function NewQuizPage() {
  return (
    <Suspense fallback={null}>
      <NewQuizClient />
    </Suspense>
  );
}
