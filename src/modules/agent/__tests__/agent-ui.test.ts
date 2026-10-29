import { describe, it, expect, vi, beforeEach } from "vitest";
import * as auth from "@/lib/authorization";
import { prisma } from "@/lib/auth";
import {
  executeAgentAction,
  cancelAgentAction,
  getAllActionProposals,
} from "../agent-action.actions";
import { POST } from "@/app/api/agent/chat/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/authorization", () => ({
  verifyActiveSchoolMembership: vi.fn(),
  verifyClassRosterAccess: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  prisma: {
    agentConversation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    agentMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    agentActionProposal: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    teacherAgentMemory: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    // Story #5b — kuota AI harian & credit
    teacherProfile: {
      findUnique: vi.fn(),
    },
    aiUsageCounter: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    teacherCredit: {
      findUnique: vi.fn(async () => ({
        id: "credit-1",
        teacherProfileId: "teacher-1",
        balance: 50000,
        dailyAllowance: 50000,
        lastResetDate: "2026-10-26",
      })),
      create: vi.fn(async ({ data }) => data),
      update: vi.fn(async ({ data }) => data),
    },
    teacherCreditLedger: {
      create: vi.fn(async ({ data }) => ({ id: "ledger-1", ...data })),
    },
    $transaction: vi.fn((callback: any) => callback(prisma)),
  },
}));

// Mock streamText from ai
vi.mock("ai", async () => {
  const actual = await vi.importActual("ai");
  return {
    ...actual,
    streamText: vi.fn().mockReturnValue({
      toTextStreamResponse: vi.fn().mockReturnValue(
        new Response("Mock stream response", {
          headers: { "x-conversation-id": "conv-123" },
        })
      ),
    }),
  };
});

describe("Story 5: Klassa Agent UI, ActionConfirmCard & Streaming Route", () => {
  const mockProfile = { id: "teacher-ui-123" };
  const mockSchoolId = "school-ui-abc";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.verifyActiveSchoolMembership).mockResolvedValue({
      profile: mockProfile,
      activeSchoolId: mockSchoolId,
    } as any);
  });

  describe("API Route: /api/agent/chat", () => {
    it("rejects empty message with status 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({ message: "   " }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("Pesan tidak boleh kosong");
    });

    it("creates a new conversation if conversationId is omitted and returns stream", async () => {
      vi.mocked(prisma.agentConversation.create).mockResolvedValueOnce({
        id: "new-conv-777",
        teacherProfileId: mockProfile.id,
        title: "Halo asisten...",
        modelUsed: "gemini-1.5-flash",
      } as any);

      vi.mocked(prisma.agentMessage.create).mockResolvedValueOnce({
        id: "msg-user-1",
      } as any);

      vi.mocked(prisma.teacherAgentMemory.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.agentMessage.findMany).mockResolvedValueOnce([]);

      const req = new NextRequest("http://localhost:3000/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({ message: "Halo asisten, tolong bantu jadwal." }),
      });

      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(prisma.agentConversation.create).toHaveBeenCalled();
    });

    it("rejects message exceeding 4000 characters limit", async () => {
      const longMessage = "a".repeat(4001);
      const req = new NextRequest("http://localhost:3000/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({ message: longMessage }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("Pesan terlalu panjang");
    });

    it("rejects unauthorized classContextId when initiating conversation", async () => {
      vi.mocked(auth.verifyClassRosterAccess).mockRejectedValueOnce(
        new Error("Forbidden class access")
      );

      const req = new NextRequest("http://localhost:3000/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "Halo",
          classContextId: "forbidden-class-123",
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toContain("Akses ke kelas yang dipilih tidak valid");
    });

    it("verifies multi-tenant ownership: rejects conversation if belongs to different teacher", async () => {
      vi.mocked(prisma.agentConversation.findUnique).mockResolvedValueOnce({
        id: "conv-other",
        teacherProfileId: "different-teacher-999",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({
          conversationId: "conv-other",
          message: "Akses data orang lain",
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toContain("Akses percakapan ditolak");
    });
  });

  describe("Proposal Data Aggregation for UI (getAllActionProposals)", () => {
    it("queries proposals scoped strictly to current active school and teacher profile", async () => {
      vi.mocked(prisma.agentActionProposal.findMany).mockResolvedValueOnce([
        {
          id: "prop-1",
          conversationId: "conv-123",
          schoolId: mockSchoolId,
          teacherProfileId: mockProfile.id,
          actionType: "RECORD_ATTENDANCE",
          status: "PENDING",
          summary: "Presensi 7A",
        },
      ] as any);

      const res = await getAllActionProposals("conv-123");

      expect(res.success).toBe(true);
      expect(prisma.agentActionProposal.findMany).toHaveBeenCalledWith({
        where: {
          conversationId: "conv-123",
          schoolId: mockSchoolId,
          teacherProfileId: mockProfile.id,
        },
        orderBy: { createdAt: "asc" },
      });
      expect(res.data?.length).toBe(1);
    });
  });

  describe("Interactive Actions Confirmation (executeAgentAction / cancelAgentAction)", () => {
    it("executes proposal and updates status via atomic lock", async () => {
      const mockProposal = {
        id: "prop-abc",
        schoolId: mockSchoolId,
        teacherProfileId: mockProfile.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 100000),
        actionType: "CREATE_ANNOUNCEMENT",
        classId: "class-1",
        payload: { classId: "class-1", title: "Pengumuman Ujian", content: "Isi pengumuman lengkap" },
      };

      vi.mocked(prisma.agentActionProposal.findUnique).mockResolvedValueOnce(mockProposal as any);
      vi.mocked(prisma.agentActionProposal.updateMany).mockResolvedValueOnce({ count: 1 } as any);
      vi.mocked(prisma.agentActionProposal.update).mockResolvedValueOnce({
        ...mockProposal,
        status: "EXECUTED",
      } as any);
      vi.mocked(auth.verifyClassRosterAccess).mockResolvedValueOnce(true as any);

      const res = await executeAgentAction("prop-abc");

      expect(res.success).toBe(true);
      expect(res.message).toContain("berhasil dieksekusi");
    });

    it("cancels proposal with given reason", async () => {
      const mockProposal = {
        id: "prop-cancel",
        schoolId: mockSchoolId,
        teacherProfileId: mockProfile.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 100000),
      };

      vi.mocked(prisma.agentActionProposal.findUnique).mockResolvedValueOnce(mockProposal as any);
      vi.mocked(prisma.agentActionProposal.updateMany).mockResolvedValueOnce({ count: 1 } as any);
      vi.mocked(prisma.agentActionProposal.update).mockResolvedValueOnce({
        ...mockProposal,
        status: "CANCELLED",
      } as any);

      const res = await cancelAgentAction("prop-cancel", "Dibatalkan oleh guru.");

      expect(res.success).toBe(true);
      expect(res.message).toContain("berhasil dibatalkan");
    });
  });
});
