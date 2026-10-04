import { tool } from "ai";
import { prisma } from "@/lib/auth";
import {
  verifyActiveSchoolMembership,
  verifyClassRosterAccess,
} from "@/lib/authorization";
import {
  ProposeAttendanceLogSchema,
  ProposeClassAnnouncementSchema,
  ProposeAssignmentDraftSchema,
  ProposeAttendanceLogInput,
  ProposeClassAnnouncementInput,
  ProposeAssignmentDraftInput,
} from "./agent-action.types";

const PROPOSAL_TTL_MINUTES = 15;

function getProposalExpiration(): Date {
  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + PROPOSAL_TTL_MINUTES);
  return expires;
}

/**
 * 1. Tool: Propose Attendance Log (HITL Confirmation Gated)
 */
export const proposeAttendanceLogTool = tool({
  description:
    "Mengajukan draf pencatatan presensi siswa ke rombel tertentu. Aksi ini TIDAK langsung dieksekusi melainkan menghasilkan draf persetujuan untuk dikonfirmasi oleh guru.",
  inputSchema: ProposeAttendanceLogSchema,
  execute: async ({
    conversationId,
    classId,
    sessionDate,
    topic = "Sesi Pembelajaran",
    records,
  }: ProposeAttendanceLogInput) => {
    try {
      const { profile, activeSchoolId } = await verifyActiveSchoolMembership();
      await verifyClassRosterAccess(classId);

      const hadirCount = records.filter((r) => r.status === "PRESENT").length;
      const tidakHadirCount = records.length - hadirCount;
      const summary = `Pencatatan presensi tanggal ${sessionDate} topik "${topic}" (${records.length} siswa: ${hadirCount} Hadir, ${tidakHadirCount} Berhalangan/Absen).`;

      const proposal = await prisma.agentActionProposal.create({
        data: {
          conversationId,
          schoolId: activeSchoolId,
          teacherProfileId: profile.id,
          actionType: "RECORD_ATTENDANCE",
          classId,
          summary,
          payload: {
            classId,
            sessionDate,
            topic,
            records,
          },
          status: "PENDING",
          expiresAt: getProposalExpiration(),
        },
      });

      return {
        success: true,
        requiresConfirmation: true,
        proposalId: proposal.id,
        actionType: "RECORD_ATTENDANCE",
        summary,
        expiresAt: proposal.expiresAt.toISOString(),
        message:
          "Draf pencatatan presensi telah disiapkan. Mohon klik tombol 'Konfirmasi & Simpan' pada kartu persetujuan di bawah untuk mengeksekusinya.",
      };
    } catch (error: unknown) {
      return {
        success: false,
        requiresConfirmation: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal menyusun draf pencatatan presensi.",
      };
    }
  },
});

/**
 * 2. Tool: Propose Class Announcement (HITL Confirmation Gated)
 */
export const proposeClassAnnouncementTool = tool({
  description:
    "Mengajukan draf pengumuman kelas untuk rombel tertentu. Aksi ini membutuhkan konfirmasi eksplisit dari guru sebelum diterbitkan.",
  inputSchema: ProposeClassAnnouncementSchema,
  execute: async ({
    conversationId,
    classId,
    title,
    content,
  }: ProposeClassAnnouncementInput) => {
    try {
      const { profile, activeSchoolId } = await verifyActiveSchoolMembership();
      await verifyClassRosterAccess(classId);

      const summary = `Penerbitan Pengumuman Kelas: "${title}".`;

      const proposal = await prisma.agentActionProposal.create({
        data: {
          conversationId,
          schoolId: activeSchoolId,
          teacherProfileId: profile.id,
          actionType: "CREATE_ANNOUNCEMENT",
          classId,
          summary,
          payload: {
            classId,
            title,
            content,
          },
          status: "PENDING",
          expiresAt: getProposalExpiration(),
        },
      });

      return {
        success: true,
        requiresConfirmation: true,
        proposalId: proposal.id,
        actionType: "CREATE_ANNOUNCEMENT",
        summary,
        expiresAt: proposal.expiresAt.toISOString(),
        message:
          "Draf pengumuman kelas telah disiapkan. Mohon tinjau isi pengumuman dan konfirmasi publikasinya.",
      };
    } catch (error: unknown) {
      return {
        success: false,
        requiresConfirmation: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal menyusun draf pengumuman kelas.",
      };
    }
  },
});

/**
 * 3. Tool: Propose Assignment Draft (HITL Confirmation Gated)
 */
export const proposeAssignmentDraftTool = tool({
  description:
    "Mengajukan draf pembuatan tugas/asesmen baru untuk siswa. Membutuhkan persetujuan guru sebelum disimpan ke database sekolah.",
  inputSchema: ProposeAssignmentDraftSchema,
  execute: async ({
    conversationId,
    classId,
    subjectId,
    title,
    description,
    dueDate,
  }: ProposeAssignmentDraftInput) => {
    try {
      const { profile, activeSchoolId } = await verifyActiveSchoolMembership();
      await verifyClassRosterAccess(classId);

      const summary = `Pembuatan Penugasan Baru: "${title}" (Batas Waktu: ${dueDate}).`;

      const proposal = await prisma.agentActionProposal.create({
        data: {
          conversationId,
          schoolId: activeSchoolId,
          teacherProfileId: profile.id,
          actionType: "CREATE_ASSIGNMENT",
          classId,
          summary,
          payload: {
            classId,
            subjectId,
            title,
            description,
            dueDate,
          },
          status: "PENDING",
          expiresAt: getProposalExpiration(),
        },
      });

      return {
        success: true,
        requiresConfirmation: true,
        proposalId: proposal.id,
        actionType: "CREATE_ASSIGNMENT",
        summary,
        expiresAt: proposal.expiresAt.toISOString(),
        message:
          "Draf tugas baru telah disiapkan. Silakan periksa rincian tugas dan tekan konfirmasi untuk menyimpannya.",
      };
    } catch (error: unknown) {
      return {
        success: false,
        requiresConfirmation: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal menyusun draf penugasan.",
      };
    }
  },
});
