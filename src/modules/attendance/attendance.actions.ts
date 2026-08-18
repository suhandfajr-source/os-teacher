"use server";

import { prisma } from "@/lib/auth";
import { verifyTeachingSessionAccess } from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import { AttendanceStatus } from "@prisma/client";

export async function saveAttendance(
  sessionId: string,
  records: { studentId: string; status: AttendanceStatus; note?: string }[]
) {
  const { session, context } = await verifyTeachingSessionAccess(sessionId);


  // Use a transaction for atomicity
  return await prisma.$transaction(async (tx) => {
    if (!session.attendanceRecordedAt) {
      // FIRST SAVE: Load current roster, validate all students
      const roster = await tx.classStudent.findMany({
        where: {
          classId: context.classId,
          academicPeriodId: context.academicPeriodId,
        },
      });

      const rosterStudentIds = roster.map((cs) => cs.studentId);
      const submittedStudentIds = records.map((r) => r.studentId);

      // Validate all submitted IDs belong to the roster
      const invalidIds = submittedStudentIds.filter((id) => !rosterStudentIds.includes(id));
      if (invalidIds.length > 0) {
        throw new Error(`Unauthorized student IDs submitted: ${invalidIds.join(", ")}`);
      }

      // Ensure all roster students are accounted for (optional but good for 'Mark All Present' to ensure full snapshot)
      const missingIds = rosterStudentIds.filter((id) => !submittedStudentIds.includes(id));
      if (missingIds.length > 0) {
        throw new Error(`Incomplete attendance. Missing students: ${missingIds.join(", ")}`);
      }

      // Create snapshot
      for (const record of records) {
        await tx.attendanceRecord.create({
          data: {
            teachingSessionId: sessionId,
            studentId: record.studentId,
            status: record.status,
            note: record.note,
          },
        });
      }

      const updatedSession = await tx.teachingSession.update({
        where: { id: sessionId },
        data: { attendanceRecordedAt: new Date() },
      });

      revalidatePath(`/kelas/${context.id}/pertemuan`);
      revalidatePath(`/kelas/${context.id}/pertemuan/${sessionId}`);
      return updatedSession;

    } else {
      // SUBSEQUENT EDIT: Only update existing snapshot records
      const existingRecords = await tx.attendanceRecord.findMany({
        where: { teachingSessionId: sessionId },
      });

      const existingStudentIds = existingRecords.map((r) => r.studentId);
      const submittedStudentIds = records.map((r) => r.studentId);

      // Validate all submitted IDs exist in the snapshot
      const invalidIds = submittedStudentIds.filter((id) => !existingStudentIds.includes(id));
      if (invalidIds.length > 0) {
        throw new Error(`Cannot add new students to a locked snapshot. Invalid IDs: ${invalidIds.join(", ")}`);
      }

      // Update snapshot
      for (const record of records) {
        await tx.attendanceRecord.update({
          where: {
            teachingSessionId_studentId: {
              teachingSessionId: sessionId,
              studentId: record.studentId,
            },
          },
          data: {
            status: record.status,
            note: record.note,
          },
        });
      }

      revalidatePath(`/kelas/${context.id}/pertemuan`);
      revalidatePath(`/kelas/${context.id}/pertemuan/${sessionId}`);
      return session;
    }
  });
}
