import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import TugasClient from "./TugasClient";

export default async function TugasPage({ params }: { params: Promise<{ teachingContextId: string }> }) {
  const { teachingContextId } = await params;
  await verifyTeachingContextAccess(teachingContextId);

  const assignments = await prisma.assignment.findMany({
    where: { teachingContextId },
    orderBy: { createdAt: "desc" },
    include: {
      teachingSession: true,
      _count: {
        select: { submissions: { where: { status: "SUBMITTED" } } },
      },
    }
  });

  const sessions = await prisma.teachingSession.findMany({
    where: { teachingContextId },
    orderBy: { date: "desc" }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 pb-1 border-b">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Tugas & PR Siswa</h2>
        <p className="text-xs text-muted-foreground">
          Kelola instruksi tugas, tenggat waktu pengumpulan, dan keterkaitan tugas dengan sesi mengajar.
        </p>
      </div>

      <TugasClient 
        teachingContextId={teachingContextId} 
        initialAssignments={assignments.map((a) => ({
          ...a,
          pendingSubmissions: a._count.submissions,
        }))} 
        sessions={sessions}
      />
    </div>
  );
}
