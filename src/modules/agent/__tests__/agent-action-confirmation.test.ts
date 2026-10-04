import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  proposeAttendanceLogTool,
  proposeClassAnnouncementTool,
  proposeAssignmentDraftTool,
} from "../tools/agent-action.tools";
import {
  executeAgentAction,
  cancelAgentAction,
  getPendingActionProposals,
} from "../agent-action.actions";
import * as auth from "@/lib/authorization";
import { prisma } from "@/lib/auth";

vi.mock("@/lib/authorization", () => ({
  verifyActiveSchoolMembership: vi.fn(),
  verifyClassRosterAccess: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  prisma: {
    agentActionProposal: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    teachingContext: {
      findFirst: vi.fn(),
    },
    teachingSession: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    classStudent: {
      findMany: vi.fn(),
    },
    attendanceRecord: {
      upsert: vi.fn(),
    },
    assignment: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

const mockOptions = {
  messages: [],
  toolCallId: "call_hitl_1",
  context: {},
} as any;

describe("Klassa Agent Human-in-the-Loop Action Confirmation Engine (Stage 12 Story 3)", () => {
  const mockTeacherProfile = { id: "teacher-123" };
  const mockSchoolId = "school-abc";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.verifyActiveSchoolMembership).mockResolvedValue({
      profile: mockTeacherProfile,
      activeSchoolId: mockSchoolId,
    } as any);
    vi.mocked(auth.verifyClassRosterAccess).mockResolvedValue({} as any);
  });

  describe("Proposal Generation Tools (HITL Draft Gating)", () => {
    it("creates a pending attendance proposal instead of direct execution", async () => {
      const mockCreatedProposal = {
        id: "prop-att-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      vi.mocked(prisma.agentActionProposal.create).mockResolvedValueOnce(
        mockCreatedProposal as any
      );

      const result = (await proposeAttendanceLogTool.execute?.(
        {
          conversationId: "conv-1",
          classId: "class-7a",
          sessionDate: "2026-10-03",
          topic: "Sistem Pencernaan",
          records: [
            { studentId: "stud-1", status: "PRESENT" },
            { studentId: "stud-2", status: "ABSENT", notes: "Sakit demam" },
          ],
        },
        mockOptions
      )) as any;

      expect(auth.verifyClassRosterAccess).toHaveBeenCalledWith("class-7a");
      expect(prisma.agentActionProposal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: "RECORD_ATTENDANCE",
            status: "PENDING",
            classId: "class-7a",
          }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.proposalId).toBe("prop-att-1");
    });

    it("creates a pending announcement proposal", async () => {
      const mockCreatedProposal = {
        id: "prop-ann-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      vi.mocked(prisma.agentActionProposal.create).mockResolvedValueOnce(
        mockCreatedProposal as any
      );

      const result = (await proposeClassAnnouncementTool.execute?.(
        {
          conversationId: "conv-1",
          classId: "class-7a",
          title: "Ulangan Harian Bab 2",
          content: "Harap membawa pensil 2B dan kartu ujian.",
        },
        mockOptions
      )) as any;

      expect(result.success).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.actionType).toBe("CREATE_ANNOUNCEMENT");
    });

    it("creates a pending assignment proposal", async () => {
      const mockCreatedProposal = {
        id: "prop-assign-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      vi.mocked(prisma.agentActionProposal.create).mockResolvedValueOnce(
        mockCreatedProposal as any
      );

      const result = (await proposeAssignmentDraftTool.execute?.(
        {
          conversationId: "conv-1",
          classId: "class-7a",
          subjectId: "subj-ipa",
          title: "Tugas Ringkasan Enzim",
          description: "Buat mindmap tentang jenis-jenis enzim pencernaan.",
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        },
        mockOptions
      )) as any;

      expect(result.success).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.actionType).toBe("CREATE_ASSIGNMENT");
    });
  });

  describe("executeAgentAction (Server Action Confirmation & Concurrency Guard)", () => {
    it("successfully executes attendance proposal with roster verification and atomic lock", async () => {
      const mockProposal = {
        id: "prop-att-1",
        schoolId: mockSchoolId,
        teacherProfileId: mockTeacherProfile.id,
        status: "PENDING",
        actionType: "RECORD_ATTENDANCE",
        classId: "class-7a",
        summary: "Pencatatan presensi",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        payload: {
          classId: "class-7a",
          sessionDate: "2026-10-03",
          topic: "Sistem Pencernaan",
          records: [{ studentId: "stud-1", status: "PRESENT" }],
        },
      };

      vi.mocked(prisma.agentActionProposal.findUnique).mockResolvedValueOnce(
        mockProposal as any
      );
      vi.mocked(prisma.agentActionProposal.updateMany).mockResolvedValueOnce({
        count: 1,
      } as any);
      vi.mocked(prisma.teachingContext.findFirst).mockResolvedValueOnce({
        id: "tc-1",
      } as any);
      vi.mocked(prisma.classStudent.findMany).mockResolvedValueOnce([
        { studentId: "stud-1" },
      ] as any);
      vi.mocked(prisma.teachingSession.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.teachingSession.create).mockResolvedValueOnce({
        id: "sess-1",
      } as any);
      vi.mocked(prisma.agentActionProposal.update).mockResolvedValueOnce({
        ...mockProposal,
        status: "EXECUTED",
      } as any);

      const response = await executeAgentAction("prop-att-1");

      expect(response.success).toBe(true);
      expect(prisma.agentActionProposal.updateMany).toHaveBeenCalledWith({
        where: { id: "prop-att-1", status: "PENDING" },
        data: expect.objectContaining({ status: "EXECUTED" }),
      });
    });

    it("prevents race condition / double-click when atomic lock returns 0 affected rows", async () => {
      const mockProposal = {
        id: "prop-race-1",
        schoolId: mockSchoolId,
        teacherProfileId: mockTeacherProfile.id,
        status: "PENDING",
        actionType: "CREATE_ANNOUNCEMENT",
        classId: "class-7a",
        summary: "Pengumuman",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        payload: {
          classId: "class-7a",
          title: "Pengumuman Penting",
          content: "Isi pengumuman",
        },
      };

      vi.mocked(prisma.agentActionProposal.findUnique).mockResolvedValueOnce(
        mockProposal as any
      );
      // Simulasi request kedua kalah balapan (count: 0)
      vi.mocked(prisma.agentActionProposal.updateMany).mockResolvedValueOnce({
        count: 0,
      } as any);

      const response = await executeAgentAction("prop-race-1");

      expect(response.success).toBe(false);
      expect(response.message).toContain("sedang atau sudah pernah diproses");
    });

    it("rejects execution if teacher does not own the proposal (Security Isolation B1)", async () => {
      const mockProposal = {
        id: "prop-other-1",
        schoolId: mockSchoolId,
        teacherProfileId: "other-teacher-id",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      vi.mocked(prisma.agentActionProposal.findUnique).mockResolvedValueOnce(
        mockProposal as any
      );

      const response = await executeAgentAction("prop-other-1");

      expect(response.success).toBe(false);
      expect(response.message).toContain("Anda tidak memiliki izin mengonfirmasi aksi guru lain");
    });

    it("rejects execution if proposal status is not PENDING (Strict Whitelist Check)", async () => {
      const mockProposal = {
        id: "prop-executed-1",
        schoolId: mockSchoolId,
        teacherProfileId: mockTeacherProfile.id,
        status: "EXECUTED",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      vi.mocked(prisma.agentActionProposal.findUnique).mockResolvedValueOnce(
        mockProposal as any
      );

      const response = await executeAgentAction("prop-executed-1");

      expect(response.success).toBe(false);
      expect(response.message).toContain("berstatus EXECUTED");
    });

    it("rejects and expires proposal if TTL has passed (Expired check)", async () => {
      const mockProposal = {
        id: "prop-expired-1",
        schoolId: mockSchoolId,
        teacherProfileId: mockTeacherProfile.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5 menit yang lalu
      };

      vi.mocked(prisma.agentActionProposal.findUnique).mockResolvedValueOnce(
        mockProposal as any
      );

      const response = await executeAgentAction("prop-expired-1");

      expect(response.success).toBe(false);
      expect(response.message).toContain("kedaluwarsa");
      expect(prisma.agentActionProposal.update).toHaveBeenCalledWith({
        where: { id: "prop-expired-1" },
        data: { status: "EXPIRED" },
      });
    });
  });

  describe("cancelAgentAction & getPendingActionProposals", () => {
    it("cancels a pending proposal successfully", async () => {
      const mockProposal = {
        id: "prop-to-cancel",
        schoolId: mockSchoolId,
        teacherProfileId: mockTeacherProfile.id,
        status: "PENDING",
      };

      vi.mocked(prisma.agentActionProposal.findUnique).mockResolvedValueOnce(
        mockProposal as any
      );
      vi.mocked(prisma.agentActionProposal.update).mockResolvedValueOnce({
        ...mockProposal,
        status: "CANCELLED",
      } as any);

      const response = await cancelAgentAction("prop-to-cancel", "Salah input data");

      expect(response.success).toBe(true);
      expect(prisma.agentActionProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "prop-to-cancel" },
          data: expect.objectContaining({ status: "CANCELLED" }),
        })
      );
    });

    it("retrieves pending action proposals for conversation", async () => {
      vi.mocked(prisma.agentActionProposal.findMany).mockResolvedValueOnce([
        { id: "prop-1", status: "PENDING" },
      ] as any);

      const response = await getPendingActionProposals("conv-1");

      expect(response.success).toBe(true);
      expect((response.data as any[]).length).toBe(1);
    });
  });
});
