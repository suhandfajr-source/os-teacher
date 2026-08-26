"use server";

import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess, verifyTeachingSessionAccess } from "@/lib/authorization";
import { revalidatePath } from "next/cache";

export async function startTeachingSession(teachingContextId: string, plannedTopic?: string) {
  await verifyTeachingContextAccess(teachingContextId);

  const session = await prisma.teachingSession.create({
    data: {
      teachingContextId,
      date: new Date(),
      startedAt: new Date(),
      status: "IN_PROGRESS",
      plannedTopic,
    },
  });

  revalidatePath(`/hari-ini`);
  revalidatePath(`/kelas/${teachingContextId}/pertemuan`);

  return session;
}

export async function completeTeachingSession(sessionId: string) {
  const { session, context } = await verifyTeachingSessionAccess(sessionId);

  if (session.status === "COMPLETED") {
    throw new Error("Session is already completed");
  }

  if (!session.actualTopic || session.actualTopic.trim() === "") {
    throw new Error("Actual topic is required to complete the session");
  }

  if (!session.attendanceRecordedAt) {
    throw new Error("Attendance must be recorded before completing the session");
  }

  const updatedSession = await prisma.teachingSession.update({
    where: { id: sessionId },
    data: {
      status: "COMPLETED",
      endedAt: new Date(),
    },
  });

  revalidatePath(`/kelas/${context.id}/pertemuan`);
  revalidatePath(`/kelas/${context.id}/pertemuan/${sessionId}`);
  revalidatePath(`/hari-ini`);

  return updatedSession;
}

export async function editTeachingSession(
  sessionId: string,
  data: { actualTopic?: string; activitySummary?: string; reflection?: string; plannedTopic?: string }
) {
  const { session, context } = await verifyTeachingSessionAccess(sessionId);

  const updatedSession = await prisma.teachingSession.update({
    where: { id: sessionId },
    data: {
      actualTopic: data.actualTopic !== undefined ? data.actualTopic : session.actualTopic,
      activitySummary: data.activitySummary !== undefined ? data.activitySummary : session.activitySummary,
      reflection: data.reflection !== undefined ? data.reflection : session.reflection,
      plannedTopic: data.plannedTopic !== undefined ? data.plannedTopic : session.plannedTopic,
    },
  });

  revalidatePath(`/kelas/${context.id}/pertemuan`);
  revalidatePath(`/kelas/${context.id}/pertemuan/${sessionId}`);

  return updatedSession;
}
