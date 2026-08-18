import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import TugasClient from "./TugasClient";

export default async function TugasPage({ params }: { params: { teachingContextId: string } }) {
  const { teachingContextId } = await params;
  await verifyTeachingContextAccess(teachingContextId);

  const assignments = await prisma.assignment.findMany({
    where: { teachingContextId },
    orderBy: { createdAt: "desc" },
    include: {
      teachingSession: true,
    }
  });

  const sessions = await prisma.teachingSession.findMany({
    where: { teachingContextId },
    orderBy: { date: "desc" }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Tugas</h2>
      </div>

      <TugasClient 
        teachingContextId={teachingContextId} 
        initialAssignments={assignments} 
        sessions={sessions}
      />
    </div>
  );
}
