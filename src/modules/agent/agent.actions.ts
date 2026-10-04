"use server";

import { prisma } from "@/lib/auth";
import { verifyActiveSchoolMembership } from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import { AgentConversationDTO, AgentMessageDTO, TeacherMemoryDTO } from "./agent.types";
import { DEFAULT_AGENT_MODEL } from "./agent.config";

export async function getOrCreateConversationAction(
  classContextId?: string | null
): Promise<{ success: boolean; data?: AgentConversationDTO; error?: string }> {
  try {
    const { profile } = await verifyActiveSchoolMembership();

    let conversation = await prisma.agentConversation.findFirst({
      where: {
        teacherProfileId: profile.id,
        classContextId: classContextId || null,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!conversation) {
      conversation = await prisma.agentConversation.create({
        data: {
          teacherProfileId: profile.id,
          classContextId: classContextId || null,
          title: "Percakapan Baru",
          modelUsed: DEFAULT_AGENT_MODEL,
        },
      });
    }

    return {
      success: true,
      data: {
        id: conversation.id,
        title: conversation.title,
        modelUsed: conversation.modelUsed,
        classContextId: conversation.classContextId,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat percakapan.",
    };
  }
}

export async function listConversationsAction(): Promise<{
  success: boolean;
  data?: AgentConversationDTO[];
  error?: string;
}> {
  try {
    const { profile } = await verifyActiveSchoolMembership();

    const conversations = await prisma.agentConversation.findMany({
      where: { teacherProfileId: profile.id },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return {
      success: true,
      data: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        modelUsed: c.modelUsed,
        classContextId: c.classContextId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messagesCount: c._count.messages,
      })),
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengambil daftar percakapan.",
    };
  }
}

export async function getConversationMessagesAction(
  conversationId: string
): Promise<{ success: boolean; data?: AgentMessageDTO[]; error?: string }> {
  try {
    const { profile } = await verifyActiveSchoolMembership();

    const conversation = await prisma.agentConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.teacherProfileId !== profile.id) {
      return { success: false, error: "Percakapan tidak ditemukan atau akses ditolak." };
    }

    const messages = await prisma.agentMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return {
      success: true,
      data: messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role as AgentMessageDTO["role"],
        content: m.content,
        toolCalls: m.toolCalls,
        toolResults: m.toolResults,
        pendingAction: m.pendingAction as AgentMessageDTO["pendingAction"],
        actionStatus: m.actionStatus as AgentMessageDTO["actionStatus"],
        createdAt: m.createdAt,
      })),
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat pesan percakapan.",
    };
  }
}

export async function saveUserMessageAction(
  conversationId: string,
  content: string
): Promise<{ success: boolean; data?: AgentMessageDTO; error?: string }> {
  try {
    const { profile } = await verifyActiveSchoolMembership();

    const conversation = await prisma.agentConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.teacherProfileId !== profile.id) {
      return { success: false, error: "Akses percakapan ditolak." };
    }

    const message = await prisma.agentMessage.create({
      data: {
        conversationId,
        role: "user",
        content,
      },
    });

    const msgCount = await prisma.agentMessage.count({ where: { conversationId } });
    if (msgCount <= 2) {
      const generatedTitle = content.trim().slice(0, 40) + (content.length > 40 ? "..." : "");
      await prisma.agentConversation.update({
        where: { id: conversationId },
        data: { title: generatedTitle, updatedAt: new Date() },
      });
    } else {
      await prisma.agentConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }

    return {
      success: true,
      data: {
        id: message.id,
        conversationId: message.conversationId,
        role: message.role as AgentMessageDTO["role"],
        content: message.content,
        createdAt: message.createdAt,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan pesan pengguna.",
    };
  }
}

export async function saveAssistantMessageAction(
  conversationId: string,
  content: string,
  toolCalls?: unknown,
  toolResults?: unknown,
  pendingAction?: unknown
): Promise<{ success: boolean; data?: AgentMessageDTO; error?: string }> {
  try {
    const { profile } = await verifyActiveSchoolMembership();

    const conversation = await prisma.agentConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.teacherProfileId !== profile.id) {
      return { success: false, error: "Akses percakapan ditolak." };
    }

    const message = await prisma.agentMessage.create({
      data: {
        conversationId,
        role: "assistant",
        content,
        toolCalls: toolCalls ? (toolCalls as object) : undefined,
        toolResults: toolResults ? (toolResults as object) : undefined,
        pendingAction: pendingAction ? (pendingAction as object) : undefined,
        actionStatus: pendingAction ? "PENDING" : "NONE",
      },
    });

    await prisma.agentConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      success: true,
      data: {
        id: message.id,
        conversationId: message.conversationId,
        role: message.role as AgentMessageDTO["role"],
        content: message.content,
        toolCalls: message.toolCalls,
        toolResults: message.toolResults,
        pendingAction: message.pendingAction as AgentMessageDTO["pendingAction"],
        actionStatus: message.actionStatus as AgentMessageDTO["actionStatus"],
        createdAt: message.createdAt,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan respon agen.",
    };
  }
}

export async function deleteConversationAction(
  conversationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await verifyActiveSchoolMembership();

    const conversation = await prisma.agentConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.teacherProfileId !== profile.id) {
      return { success: false, error: "Percakapan tidak ditemukan atau akses ditolak." };
    }

    await prisma.agentConversation.delete({ where: { id: conversationId } });

    revalidatePath("/asisten");
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menghapus percakapan.",
    };
  }
}

export async function getTeacherMemoryAction(): Promise<{
  success: boolean;
  data?: TeacherMemoryDTO | null;
  error?: string;
}> {
  try {
    const { profile } = await verifyActiveSchoolMembership();

    const memory = await prisma.teacherAgentMemory.findUnique({
      where: { teacherProfileId: profile.id },
    });

    if (!memory) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        id: memory.id,
        teacherProfileId: memory.teacherProfileId,
        communicationTone: memory.communicationTone as TeacherMemoryDTO["communicationTone"],
        preferredModel: memory.preferredModel,
        pedagogyDefaults: memory.pedagogyDefaults as Record<string, unknown> | null,
        customContext: memory.customContext,
        updatedAt: memory.updatedAt,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat memori guru.",
    };
  }
}

export async function updateTeacherMemoryAction(input: {
  communicationTone?: "LUGAS_RINGKAS" | "RAMAH_SOPAN" | "FORMAL";
  preferredModel?: string;
  customContext?: string;
}): Promise<{ success: boolean; data?: TeacherMemoryDTO; error?: string }> {
  try {
    const { profile } = await verifyActiveSchoolMembership();

    const memory = await prisma.teacherAgentMemory.upsert({
      where: { teacherProfileId: profile.id },
      create: {
        teacherProfileId: profile.id,
        communicationTone: input.communicationTone || "RAMAH_SOPAN",
        preferredModel: input.preferredModel || DEFAULT_AGENT_MODEL,
        customContext: input.customContext || null,
      },
      update: {
        ...(input.communicationTone ? { communicationTone: input.communicationTone } : {}),
        ...(input.preferredModel ? { preferredModel: input.preferredModel } : {}),
        ...(input.customContext !== undefined ? { customContext: input.customContext } : {}),
      },
    });

    return {
      success: true,
      data: {
        id: memory.id,
        teacherProfileId: memory.teacherProfileId,
        communicationTone: memory.communicationTone as TeacherMemoryDTO["communicationTone"],
        preferredModel: memory.preferredModel,
        pedagogyDefaults: memory.pedagogyDefaults as Record<string, unknown> | null,
        customContext: memory.customContext,
        updatedAt: memory.updatedAt,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memperbarui memori guru.",
    };
  }
}
