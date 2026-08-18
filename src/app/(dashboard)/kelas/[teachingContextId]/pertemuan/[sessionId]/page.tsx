import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyTeachingSessionAccess } from "@/lib/authorization";
import SessionClient from "./SessionClient";

export default async function SessionPage(props: { params: Promise<{ teachingContextId: string; sessionId: string }> }) {
  const params = await props.params;
  const sessionAuth = await auth.api.getSession({
    headers: await headers(),
  });

  if (!sessionAuth) redirect("/login");

  // Verify access and get session
  const { session, context: baseContext } = await verifyTeachingSessionAccess(params.sessionId);

  // If the URL contextId doesn't match the actual contextId, redirect or error
  if (session.teachingContextId !== params.teachingContextId) {
    redirect(`/kelas/${session.teachingContextId}/pertemuan/${params.sessionId}`);
  }

  const context = await prisma.teachingContext.findUnique({
    where: { id: baseContext.id },
    include: { subject: true, class: true }
  });

  if (!context) redirect("/hari-ini");

  // Load the current roster
  const roster = await prisma.classStudent.findMany({
    where: {
      classId: context.classId,
      academicPeriodId: context.academicPeriodId,
    },
    include: {
      student: true,
    },
    orderBy: {
      student: { fullName: "asc" },
    },
  });

  // Load historical attendance if it exists
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: { teachingSessionId: params.sessionId },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <SessionClient 
        session={session} 
        context={context} 
        roster={roster} 
        attendanceRecords={attendanceRecords} 
      />
    </div>
  );
}
