"use server";

import { prisma } from "@/lib/auth";
import {
  verifyActiveSchoolMembership,
  verifyClassRosterAccess,
} from "@/lib/authorization";
import {
  RecordAttendancePayloadSchema,
  CreateAnnouncementPayloadSchema,
  CreateAssignmentPayloadSchema,
} from "./tools/agent-action.types";
import { AttendanceStatus } from "@prisma/client";

export interface ExecutionActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Eksekusi proposal aksi mutasi yang telah dikonfirmasi eksplisit oleh guru (HITL)
 * Dilengkapi Atomic Conditional Lock untuk mencegah Race Condition (Double Execution / TOCTOU).
 */
export async function executeAgentAction(
  proposalId: string
): Promise<ExecutionActionResult> {
  try {
    const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

    const proposal = await prisma.agentActionProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      return { success: false, message: "Proposal aksi tidak ditemukan." };
    }

    if (proposal.schoolId !== activeSchoolId) {
      return {
        success: false,
        message: "Akses ditolak: Proposal aksi bukan milik sekolah aktif ini.",
      };
    }

    if (proposal.teacherProfileId !== profile.id) {
      return {
        success: false,
        message: "Akses ditolak: Anda tidak memiliki izin mengonfirmasi aksi guru lain.",
      };
    }

    // Whitelist status check (Hanya status PENDING yang diizinkan)
    if (proposal.status !== "PENDING") {
      return {
        success: false,
        message: `Proposal aksi tidak dapat dieksekusi karena berstatus ${proposal.status}.`,
      };
    }

    // Periksa kedaluwarsa (TTL 15 menit)
    const now = new Date();
    if (now > proposal.expiresAt) {
      await prisma.agentActionProposal.update({
        where: { id: proposalId },
        data: { status: "EXPIRED" },
      });
      return {
        success: false,
        message: "Masa berlaku konfirmasi aksi ini telah kedaluwarsa. Silakan ajukan ulang kepada Klassa Agent.",
      };
    }

    // Validasi otorisasi rombel target jika ada
    if (proposal.classId) {
      await verifyClassRosterAccess(proposal.classId);
    }

    // Validasi payload pra-transaksi
    if (proposal.actionType === "RECORD_ATTENDANCE") {
      const parsed = RecordAttendancePayloadSchema.safeParse(proposal.payload);
      if (!parsed.success) {
        return {
          success: false,
          message: `Payload presensi tidak valid: ${parsed.error.message}`,
        };
      }
    } else if (proposal.actionType === "CREATE_ASSIGNMENT") {
      const parsed = CreateAssignmentPayloadSchema.safeParse(proposal.payload);
      if (!parsed.success) {
        return {
          success: false,
          message: `Payload penugasan tidak valid: ${parsed.error.message}`,
        };
      }
    } else if (proposal.actionType === "CREATE_ANNOUNCEMENT") {
      const parsed = CreateAnnouncementPayloadSchema.safeParse(proposal.payload);
      if (!parsed.success) {
        return {
          success: false,
          message: `Payload pengumuman tidak valid: ${parsed.error.message}`,
        };
      }
    } else {
      return {
        success: false,
        message: `Tipe aksi "${proposal.actionType}" belum didukung untuk eksekusi otomatis.`,
      };
    }

    // Eksekusi mutasi dalam transaksi atomik dengan Atomic Conditional Update
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atomic Gate Lock: updateMany memastikan hanya 1 request yang berhasil jika terjadi double-click paralel
      const lockResult = await tx.agentActionProposal.updateMany({
        where: {
          id: proposalId,
          status: "PENDING",
        },
        data: {
          status: "EXECUTED",
          executedAt: new Date(),
        },
      });

      if (lockResult.count === 0) {
        throw new Error("PROPOSAL_ALREADY_PROCESSED");
      }

      let executionResultData: any = null;

      if (proposal.actionType === "RECORD_ATTENDANCE") {
        const parsed = RecordAttendancePayloadSchema.parse(proposal.payload);
        const { classId, sessionDate, topic, records } = parsed;

        // Cari teaching context guru di rombel ini
        const teachingContext = await tx.teachingContext.findFirst({
          where: {
            teacherProfileId: profile.id,
            classId,
            schoolId: activeSchoolId,
          },
        });

        if (!teachingContext) {
          throw new Error("Konteks mengajar untuk rombel ini tidak ditemukan.");
        }

        // Verifikasi keanggotaan siswa dalam rombel (Roster Integrity Guard)
        const studentIds = records.map((r) => r.studentId);
        const enrolledStudents = await tx.classStudent.findMany({
          where: {
            classId,
            studentId: { in: studentIds },
          },
          select: { studentId: true },
        });

        const enrolledSet = new Set(enrolledStudents.map((s) => s.studentId));
        const invalidStudents = studentIds.filter((id) => !enrolledSet.has(id));
        if (invalidStudents.length > 0) {
          throw new Error(
            `Sebagian siswa tidak terdaftar di rombel ini: ${invalidStudents.join(", ")}`
          );
        }

        const sessionDateObj = new Date(sessionDate);

        let session = await tx.teachingSession.findFirst({
          where: {
            teachingContextId: teachingContext.id,
            date: sessionDateObj,
          },
        });

        if (!session) {
          session = await tx.teachingSession.create({
            data: {
              teachingContextId: teachingContext.id,
              date: sessionDateObj,
              plannedTopic: topic,
              actualTopic: topic,
              attendanceRecordedAt: new Date(),
            },
          });
        } else {
          session = await tx.teachingSession.update({
            where: { id: session.id },
            data: {
              attendanceRecordedAt: new Date(),
            },
          });
        }

        // Simpan / upsert records kehadiran
        for (const item of records) {
          await tx.attendanceRecord.upsert({
            where: {
              teachingSessionId_studentId: {
                teachingSessionId: session.id,
                studentId: item.studentId,
              },
            },
            create: {
              teachingSessionId: session.id,
              studentId: item.studentId,
              status: item.status as AttendanceStatus,
              note: item.notes,
            },
            update: {
              status: item.status as AttendanceStatus,
              note: item.notes,
            },
          });
        }

        executionResultData = {
          sessionId: session.id,
          recordsRecorded: records.length,
          sessionDate,
        };
      } else if (proposal.actionType === "CREATE_ASSIGNMENT") {
        const parsed = CreateAssignmentPayloadSchema.parse(proposal.payload);
        const { classId, subjectId, title, description, dueDate } = parsed;

        const teachingContext = await tx.teachingContext.findFirst({
          where: {
            teacherProfileId: profile.id,
            classId,
            subjectId,
            schoolId: activeSchoolId,
          },
        });

        if (!teachingContext) {
          throw new Error(
            "Konteks mengajar guru untuk mata pelajaran dan rombel ini tidak ditemukan."
          );
        }

        const assignment = await tx.assignment.create({
          data: {
            teachingContextId: teachingContext.id,
            title,
            description,
            dueDate: new Date(dueDate),
            status: "ACTIVE",
          },
        });

        executionResultData = {
          assignmentId: assignment.id,
          title: assignment.title,
          dueDate: assignment.dueDate,
        };
      } else if (proposal.actionType === "CREATE_ANNOUNCEMENT") {
        const parsed = CreateAnnouncementPayloadSchema.parse(proposal.payload);
        const { classId, title, content } = parsed;

        executionResultData = {
          classId,
          title,
          content,
          broadcastedAt: new Date().toISOString(),
        };
      }

      // Perbarui executionResult pada proposal
      await tx.agentActionProposal.update({
        where: { id: proposalId },
        data: {
          executionResult: executionResultData,
        },
      });

      return executionResultData;
    });

    return {
      success: true,
      message: `Aksi "${proposal.summary}" berhasil dieksekusi.`,
      data: result,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "PROPOSAL_ALREADY_PROCESSED") {
      return {
        success: false,
        message: "Aksi ini sedang atau sudah pernah diproses sebelumnya.",
      };
    }
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan internal saat mengeksekusi aksi proposal.",
    };
  }
}

/**
 * Batalkan proposal aksi mutasi oleh guru
 */
export async function cancelAgentAction(
  proposalId: string,
  reason?: string
): Promise<ExecutionActionResult> {
  try {
    const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

    const proposal = await prisma.agentActionProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      return { success: false, message: "Proposal aksi tidak ditemukan." };
    }

    if (proposal.schoolId !== activeSchoolId || proposal.teacherProfileId !== profile.id) {
      return {
        success: false,
        message: "Akses ditolak: Anda tidak memiliki wewenang membatalkan aksi ini.",
      };
    }

    if (proposal.status !== "PENDING") {
      return {
        success: false,
        message: `Proposal tidak dapat dibatalkan karena berstatus ${proposal.status}.`,
      };
    }

    const updated = await prisma.agentActionProposal.update({
      where: { id: proposalId },
      data: {
        status: "CANCELLED",
        executionResult: { cancellationReason: reason || "Dibatalkan oleh guru" },
      },
    });

    return {
      success: true,
      message: "Aksi berhasil dibatalkan.",
      data: updated,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Gagal membatalkan proposal aksi.",
    };
  }
}

/**
 * Ambil daftar proposal aksi yang sedang pending pada percakapan tertentu
 */
export async function getPendingActionProposals(conversationId: string) {
  try {
    const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

    const proposals = await prisma.agentActionProposal.findMany({
      where: {
        conversationId,
        schoolId: activeSchoolId,
        teacherProfileId: profile.id,
        status: "PENDING",
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: proposals,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal memuat proposal aksi.",
    };
  }
}

/**
 * Ambil semua proposal aksi (PENDING, EXECUTED, CANCELLED, EXPIRED) pada percakapan tertentu
 */
export async function getAllActionProposals(conversationId: string) {
  try {
    const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

    const proposals = await prisma.agentActionProposal.findMany({
      where: {
        conversationId,
        schoolId: activeSchoolId,
        teacherProfileId: profile.id,
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      success: true,
      data: proposals,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal memuat riwayat proposal aksi.",
    };
  }
}
