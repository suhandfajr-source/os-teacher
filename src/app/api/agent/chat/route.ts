import { NextRequest, NextResponse, after } from "next/server";
import { streamText, isStepCount } from "ai";
import { prisma } from "@/lib/auth";
import { verifyActiveSchoolMembership, verifyClassRosterAccess } from "@/lib/authorization";
import { getAgentLanguageModel } from "@/modules/agent/agent.router";
import { buildAgentSystemPrompt, DEFAULT_AGENT_MODEL } from "@/modules/agent/agent.config";
import {
  getTeacherClassesTool,
  getClassStudentsTool,
  getStudentAttendanceSummaryTool,
  getStudentAcademicSummaryTool,
  analyzeClassPerformanceTool,
} from "@/modules/agent/tools/agent-query.tools";
import {
  proposeAttendanceLogTool,
  proposeClassAnnouncementTool,
  proposeAssignmentDraftTool,
} from "@/modules/agent/tools/agent-action.tools";
import { updateTeacherMemoryPreferenceTool } from "@/modules/agent/memory/agent-memory.tools";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyActiveSchoolMembership();
    const { profile } = auth;

    const body = await req.json();
    const { conversationId, message, modelId, classContextId } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Pesan tidak boleh kosong." },
        { status: 400 }
      );
    }

    if (message.length > 4000) {
      return NextResponse.json(
        { error: "Pesan terlalu panjang (maksimum 4000 karakter)." },
        { status: 400 }
      );
    }

    // Validasi wewenang kelas jika classContextId disertakan
    if (classContextId) {
      try {
        await verifyClassRosterAccess(classContextId);
      } catch {
        return NextResponse.json(
          { error: "Akses ke kelas yang dipilih tidak valid atau berada di luar wewenang Anda." },
          { status: 403 }
        );
      }
    }

    // 1. Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const newConv = await prisma.agentConversation.create({
        data: {
          teacherProfileId: profile.id,
          classContextId: classContextId || null,
          title: message.trim().slice(0, 40) + (message.length > 40 ? "..." : ""),
          modelUsed: modelId || DEFAULT_AGENT_MODEL,
        },
      });
      convId = newConv.id;
    } else {
      const existingConv = await prisma.agentConversation.findUnique({
        where: { id: convId },
      });
      if (!existingConv || existingConv.teacherProfileId !== profile.id) {
        return NextResponse.json(
          { error: "Akses percakapan ditolak atau tidak ditemukan." },
          { status: 403 }
        );
      }
    }

    // 2. Save user message to database
    await prisma.agentMessage.create({
      data: {
        conversationId: convId,
        role: "user",
        content: message.trim(),
      },
    });

    // 3. Load Teacher Memory for personalized prompt
    const memory = await prisma.teacherAgentMemory.findUnique({
      where: { teacherProfileId: profile.id },
    });

    const systemPrompt = buildAgentSystemPrompt({
      memory: memory
        ? {
            id: memory.id,
            teacherProfileId: memory.teacherProfileId,
            communicationTone: memory.communicationTone as any,
            preferredModel: memory.preferredModel,
            pedagogyDefaults: (memory.pedagogyDefaults as any) || {},
            customContext: memory.customContext,
            updatedAt: memory.updatedAt,
          }
        : undefined,
    });

    // 4. Fetch recent conversation history
    const history = await prisma.agentMessage.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const modelMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // 5. Select Model
    const selectedModel = modelId || memory?.preferredModel || DEFAULT_AGENT_MODEL;
    const languageModel = getAgentLanguageModel(selectedModel);

    // 6. Tools registry
    const tools = {
      getTeacherClasses: getTeacherClassesTool,
      getClassStudents: getClassStudentsTool,
      getStudentAttendanceSummary: getStudentAttendanceSummaryTool,
      getStudentAcademicSummary: getStudentAcademicSummaryTool,
      analyzeClassPerformance: analyzeClassPerformanceTool,
      proposeAttendanceLog: proposeAttendanceLogTool,
      proposeClassAnnouncement: proposeClassAnnouncementTool,
      proposeAssignmentDraft: proposeAssignmentDraftTool,
      updateTeacherMemoryPreference: updateTeacherMemoryPreferenceTool,
    };

    // 7. Call streamText
    let isPersisted = false;
    const persistAssistantMessage = async (text: string, toolCalls?: any, toolResults?: any) => {
      if (isPersisted) return;
      isPersisted = true;
      try {
        const finalContent =
          text?.trim() ||
          (toolCalls && toolCalls.length > 0
            ? "Data telah berhasil diambil dari sistem kelas. Namun proses sintaks terhenti sebelum teks sintesis selesai. Silakan ajukan pertanyaan lanjutan untuk mendalami data ini."
            : "Maaf, respon tidak dapat dihasilkan saat ini. Silakan coba kembali sesaat lagi.");

        await prisma.agentMessage.create({
          data: {
            conversationId: convId,
            role: "assistant",
            content: finalContent,
            toolCalls: toolCalls ? (toolCalls as object) : undefined,
            toolResults: toolResults ? (toolResults as object) : undefined,
          },
        });
        await prisma.agentConversation.update({
          where: { id: convId },
          data: { updatedAt: new Date() },
        });
      } catch (dbErr) {
        console.error("Failed to persist assistant message:", dbErr);
      }
    };

    const result = streamText({
      model: languageModel,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: isStepCount(10),
      onFinish: async (event: any) => {
        await persistAssistantMessage(event.text, event.toolCalls, event.toolResults);
      },
    });

    try {
      if (typeof after === "function") {
        after(async () => {
          try {
            const text = await result.text;
            const toolCalls = await result.toolCalls;
            const toolResults = await result.toolResults;
            await persistAssistantMessage(text, toolCalls, toolResults);
          } catch (err) {
            console.error("Background task stream resolution error:", err);
          }
        });
      }
    } catch {
      // Di luar Next.js request scope (misal dalam unit test)
    }

    return result.toTextStreamResponse({
      headers: {
        "x-conversation-id": convId,
      },
    });
  } catch (err: unknown) {
    console.error("Agent chat route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kesalahan server internal." },
      { status: 500 }
    );
  }
}
