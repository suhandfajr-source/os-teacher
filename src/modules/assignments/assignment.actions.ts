"use server";

import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { revalidatePath } from "next/cache";

export async function createAssignment(data: {
  teachingContextId: string;
  teachingSessionId?: string;
  title: string;
  description?: string;
  dueDate?: Date;
}) {
  const { context } = await verifyTeachingContextAccess(data.teachingContextId);

  if (data.teachingSessionId) {
    const session = await prisma.teachingSession.findUnique({
      where: { id: data.teachingSessionId },
    });

    if (!session) {
      throw new Error("Teaching session not found");
    }

    if (session.teachingContextId !== data.teachingContextId) {
      throw new Error("Cross-context assignment is not allowed");
    }
  }

  const assignment = await prisma.assignment.create({
    data: {
      teachingContextId: data.teachingContextId,
      teachingSessionId: data.teachingSessionId,
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      status: "ACTIVE",
    },
  });

  revalidatePath(`/kelas/${context.id}/tugas`);
  if (data.teachingSessionId) {
    revalidatePath(`/kelas/${context.id}/pertemuan/${data.teachingSessionId}`);
  }

  return assignment;
}
