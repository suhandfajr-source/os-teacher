import { NextRequest, NextResponse, after } from "next/server";
import { streamText, isStepCount } from "ai";
import { prisma } from "@/lib/auth";
import { verifyActiveSchoolMembership, verifyClassRosterAccess } from "@/lib/authorization";
import { getDynamicAgentLanguageModel } from "@/modules/agent/agent.router";
import {
  preCheckAiCredit,
  recordAiTokenUsage,
} from "@/modules/ai/credit/credit.service";
import { buildAgentSystemPrompt, DEFAULT_AGENT_MODEL } from "@/modules/agent/agent.config";
import type { TeacherMemoryDTO } from "@/modules/agent/memory/agent-memory.types";
import {
  getTeacherClassesTool,
  getClassDigestTool,
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
import { routeAgentTools } from "@/modules/agent/agent-tool-router";

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

    // 0. Token-Credit Pre-Check (Saldo Kredit Sekolah vs BYOK Guru)
    let isByokSession = false;
    let byokConfig: any = undefined;

    const creditPreCheck = await preCheckAiCredit(profile.id);
    if (!creditPreCheck.allowed) {
      return NextResponse.json(
        {
          error: creditPreCheck.reason || "Kredit AI harian sekolah Anda telah habis.",
          code: "CREDIT_EXHAUSTED",
        },
        { status: 429 }
      );
    }

    if (creditPreCheck.useByok && creditPreCheck.byokConfig) {
      isByokSession = true;
      byokConfig = creditPreCheck.byokConfig;
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
            communicationTone: memory.communicationTone as TeacherMemoryDTO["communicationTone"],
            preferredModel: memory.preferredModel,
            pedagogyDefaults: (memory.pedagogyDefaults ?? {}) as TeacherMemoryDTO["pedagogyDefaults"],
            customContext: memory.customContext,
            updatedAt: memory.updatedAt,
          }
        : undefined,
    });

    // 4. Fetch recent conversation history (sliding window: 8 pesan terakhir hemat token)
    const history = await prisma.agentMessage.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    history.reverse();

    const modelMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // 5. Select Model
    const selectedModel = modelId || memory?.preferredModel || DEFAULT_AGENT_MODEL;
    const languageModel = await getDynamicAgentLanguageModel(selectedModel, byokConfig);

    // 6. Dynamic Intent-Based Tool Routing & Gating
    const routing = routeAgentTools(message, classContextId);

    const allTools = {
      getTeacherClasses: getTeacherClassesTool,
      getClassDigest: getClassDigestTool,
      getClassStudents: getClassStudentsTool,
      getStudentAttendanceSummary: getStudentAttendanceSummaryTool,
      getStudentAcademicSummary: getStudentAcademicSummaryTool,
      analyzeClassPerformance: analyzeClassPerformanceTool,
      proposeAttendanceLog: proposeAttendanceLogTool,
      proposeClassAnnouncement: proposeClassAnnouncementTool,
      proposeAssignmentDraft: proposeAssignmentDraftTool,
      updateTeacherMemoryPreference: updateTeacherMemoryPreferenceTool,
    };

    const activeTools: Record<string, any> = {};
    for (const toolName of routing.toolNames) {
      if ((allTools as any)[toolName]) {
        activeTools[toolName] = (allTools as any)[toolName];
      }
    }

    const effectiveSystemPrompt = routing.systemHint
      ? `${systemPrompt}\n${routing.systemHint}`
      : systemPrompt;

    const hasTools = Object.keys(activeTools).length > 0;

    // 7. Call streamText
    let isPersisted = false;
    const persistAssistantMessage = async (
      text: string,
      toolCalls?: unknown[],
      toolResults?: unknown[]
    ) => {
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
            toolCalls: toolCalls && toolCalls.length > 0 ? (toolCalls as object) : undefined,
            toolResults: toolResults && toolResults.length > 0 ? (toolResults as object) : undefined,
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

    console.log(
      `[Agent Chat] Message: "${message.slice(0, 30)}" | Cluster: ${routing.cluster} | Tools Count: ${
        Object.keys(activeTools).length
      } | HasTools: ${hasTools}`
    );

    const result = streamText({
      model: languageModel,
      system: effectiveSystemPrompt,
      messages: modelMessages,
      // Intent-based tools gating: hanya lampirkan klaster tools yang relevan
      ...(hasTools ? { tools: activeTools } : {}),
      stopWhen: isStepCount(10),
      // Failover antar-model sudah ditangani agent.router (tanpa backoff);
      // retry SDK dimatikan agar tidak menumpuk 50s+ exponential backoff saat provider 503.
      maxRetries: 0,
      onFinish: async (event: {
        text?: string;
        toolCalls?: unknown[];
        toolResults?: unknown[];
        usage?: {
          promptTokens?: number;
          completionTokens?: number;
          totalTokens?: number;
        };
      }) => {
        await persistAssistantMessage(event.text ?? "", event.toolCalls, event.toolResults);

        // Post-Deduct Token & Ledger Audit
        if (event.usage) {
          try {
            await recordAiTokenUsage({
              teacherProfileId: profile.id,
              feature: "AGENT",
              promptTokens: event.usage.promptTokens ?? 0,
              completionTokens: event.usage.completionTokens ?? 0,
              totalTokens: event.usage.totalTokens ?? 0,
              modelUsed: selectedModel,
              isByok: isByokSession,
            });
          } catch (ledgerErr) {
            console.error("[CreditLedger] Gagal mencatat token usage:", ledgerErr);
          }
        }
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

    // Re-emit manual: streamText menelan error stream & mengakhirinya diam-diam,
    // sehingga klien menerima 200 KOSONG saat provider gagal total (bug "halo lama lalu gagal").
    // Di sini error stream diterjemahkan jadi teks fallback yang pasti tampil di UI.
    const textStream = result.textStream;
    const encoder = new TextEncoder();
    const responseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let sentAny = false;
        try {
          for await (const chunk of textStream) {
            if (chunk) {
              sentAny = true;
              controller.enqueue(encoder.encode(chunk));
            }
          }
        } catch (streamErr) {
          console.error("[agent-chat] Stream error setelah mulai:", streamErr);
        } finally {
          if (!sentAny) {
            console.error("[agent-chat] Stream gagal total — kirim teks fallback ke klien.");
            controller.enqueue(
              encoder.encode(
                "⚠️ Maaf, seluruh jalur model AI sedang sibuk (permintaan ditolak sementara oleh penyedia). Silakan kirim ulang pesan Anda sebentar lagi — percakapan ini tetap tersimpan."
              )
            );
          }
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-conversation-id": convId,
        "cache-control": "no-store",
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
