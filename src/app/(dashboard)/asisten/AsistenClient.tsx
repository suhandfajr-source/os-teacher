"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Plus,
  Trash2,
  Settings,
  MessageSquare,
  Cpu,
  Loader2,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { toast } from "sonner";
import {
  AgentConversationDTO,
} from "@/modules/agent/agent.types";
import {
  TeacherMemoryDTO,
  AllowedAgentModelId,
} from "@/modules/agent/memory/agent-memory.types";
import {
  listConversationsAction,
  getConversationMessagesAction,
  deleteConversationAction,
} from "@/modules/agent/agent.actions";
import {
  getAllActionProposals,
} from "@/modules/agent/agent-action.actions";
import { ChatMessageBubble, ChatMessageItem } from "@/components/agent/ChatMessageBubble";
import { QuickPromptPills } from "@/components/agent/QuickPromptPills";
import { AgentSettingsModal } from "@/components/agent/AgentSettingsModal";
import { AVAILABLE_AGENT_MODELS } from "@/modules/agent/agent.config";
import { ActionProposalData } from "@/components/agent/ActionConfirmCard";
import { AgentMark } from "@/components/brand";

interface AsistenClientProps {
  initialConversations: AgentConversationDTO[];
  initialMemory: TeacherMemoryDTO;
  activeSchoolName: string;
  teacherName: string;
}

export default function AsistenClient({
  initialConversations,
  initialMemory,
  activeSchoolName,
  teacherName,
}: AsistenClientProps) {
  const [conversations, setConversations] =
    useState<AgentConversationDTO[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversations[0]?.id || null
  );
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AllowedAgentModelId>(
    (initialMemory.preferredModel as AllowedAgentModelId) || "glm-4-plus"
  );
  const [memory, setMemory] = useState<TeacherMemoryDTO>(initialMemory);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Load messages and proposals when active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset tampilan saat percakapan tidak aktif (sinkronisasi UI, aman)
      setMessages([]);
      return;
    }

    let isMounted = true;

    async function loadData() {
      try {
        const [msgRes, propRes] = await Promise.all([
          getConversationMessagesAction(activeConversationId!),
          getAllActionProposals(activeConversationId!),
        ]);

        if (!isMounted) return;

        const loadedProposals: ActionProposalData[] = propRes.success && propRes.data
          ? (propRes.data as ActionProposalData[])
          : [];

        if (msgRes.success && msgRes.data) {
          const formatted: ChatMessageItem[] = msgRes.data.map((m) => {
            // Pasangkan proposal jika ada berdasarkan id pada toolCalls / toolResults atau kedekatan waktu
            let attachedProposal: ActionProposalData | null = null;
            if (m.role === "assistant" && loadedProposals.length > 0) {
              const toolStr = JSON.stringify({ calls: m.toolCalls, results: m.toolResults });
              // 1. Cocokkan ID proposal langsung dari hasil tool
              attachedProposal = loadedProposals.find((p) => toolStr.includes(p.id)) || null;

              // 2. Fallback pencocokan waktu terdekat (< 60s) jika belum terpasang
              if (!attachedProposal) {
                const msgTime = new Date(m.createdAt).getTime();
                attachedProposal = loadedProposals.find((p) => {
                  if (!p.createdAt) return false;
                  const propTime = new Date(p.createdAt).getTime();
                  return Math.abs(msgTime - propTime) < 60000;
                }) || null;
              }
            }

            return {
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              createdAt: m.createdAt,
              pendingProposal: attachedProposal,
            };
          });
          setMessages(formatted);
        }
      } catch (err) {
        console.error("Error loading conversation data:", err);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [activeConversationId]);

  // Handle New Conversation
  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Handle Delete Conversation
  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (!window.confirm("Hapus percakapan ini?")) return;

    try {
      const res = await deleteConversationAction(convId);
      if (res.success) {
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (activeConversationId === convId) {
          handleNewChat();
        }
        toast.success("Percakapan berhasil dihapus.");
      } else {
        toast.error(res.error || "Gagal menghapus percakapan.");
      }
    } catch {
      toast.error("Terjadi kesalahan.");
    }
  };

  // Refresh proposals after action execution/cancellation
  const refreshProposals = async () => {
    if (!activeConversationId) return;
    const propRes = await getAllActionProposals(activeConversationId);
    if (propRes.success && propRes.data) {
      const updated = propRes.data as ActionProposalData[];
      setMessages((prev) =>
        prev.map((m, idx) => ({
          ...m,
          pendingProposal: updated[idx] || m.pendingProposal,
        }))
      );
    }
  };

  // Handle Send Message (Streaming)
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isStreaming) return;

    setInputMessage("");
    setIsStreaming(true);

    const tempUserMsgId = `user-${Date.now()}`;
    const tempAssistantMsgId = `asst-${Date.now()}`;

    // Optimistic UI updates
    setMessages((prev) => [
      ...prev,
      { id: tempUserMsgId, role: "user", content: text },
      { id: tempAssistantMsgId, role: "assistant", content: "", isStreaming: true },
    ]);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId || undefined,
          message: text,
          modelId: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      // Check header for conversation id
      const serverConvId = response.headers.get("x-conversation-id");
      if (serverConvId && serverConvId !== activeConversationId) {
        setActiveConversationId(serverConvId);
        // Refresh conversations list
        listConversationsAction().then((res) => {
          if (res.success && res.data) setConversations(res.data);
        });
      }

      // Read text stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempAssistantMsgId
                ? { ...msg, content: accumulatedText, isStreaming: true }
                : msg
            )
          );
        }
      }

      // Finalize assistant message
      if (!accumulatedText.trim()) {
        accumulatedText = "Maaf, terjadi kendala saat memproses jawaban dari model AI. Silakan coba kembali sesaat lagi.";
      }
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAssistantMsgId
            ? { ...msg, content: accumulatedText, isStreaming: false }
            : msg
        )
      );

      // Check if any proposals were created during this turn
      if (serverConvId) {
        setTimeout(async () => {
          const propRes = await getAllActionProposals(serverConvId);
          if (propRes.success && propRes.data && propRes.data.length > 0) {
            const latestProp = propRes.data[propRes.data.length - 1] as ActionProposalData;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempAssistantMsgId
                  ? { ...msg, pendingProposal: latestProp }
                  : msg
              )
            );
          }
        }, 600);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim pesan.");
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAssistantMsgId
            ? {
                ...msg,
                content: "Maaf, terjadi kendala saat memproses jawaban. Silakan coba lagi.",
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-full w-full rounded-2xl md:rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
      {/* 1. Sidebar Riwayat Percakapan */}
      <div
        className={`${
          isSidebarOpen ? "w-72 sm:w-80" : "w-0 -ml-72 sm:-ml-80"
        } transition-all duration-300 ease-in-out border-r border-slate-200/80 bg-slate-50/70 flex flex-col shrink-0 overflow-hidden`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-slate-200/60 flex items-center justify-between">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 active:scale-98 transition-all"
          >
            <Plus className="h-4 w-4" />
            Obrolan Baru
          </button>
        </div>

        {/* List Percakapan */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              Belum ada riwayat percakapan.
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveConversationId(c.id)}
                className={`group flex items-center justify-between p-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                  activeConversationId === c.id
                    ? "bg-white text-teal-800 shadow-xs border border-teal-100 font-semibold"
                    : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <MessageSquare
                    className={`h-3.5 w-3.5 shrink-0 ${
                      activeConversationId === c.id ? "text-teal-600" : "text-slate-400"
                    }`}
                  />
                  <span className="truncate">{c.title}</span>
                </div>
                <button
                  type="button"
                  title="Hapus percakapan"
                  onClick={(e) => handleDeleteConversation(e, c.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Info Footer */}
        <div className="p-3 border-t border-slate-200/60 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="truncate">{activeSchoolName}</span>
          <span className="shrink-0 font-semibold text-teal-700">Klassa v1</span>
        </div>
      </div>

      {/* 2. Main Chat Workspace */}
      <div className="flex-1 flex flex-col h-full bg-[#FAFCFB] overflow-hidden">
        {/* Main Header */}
        <div className="h-14 shrink-0 border-b border-slate-200/80 bg-white px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
              title={isSidebarOpen ? "Tutup riwayat" : "Buka riwayat"}
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </button>
            <div className="flex items-center gap-2">
              <AgentMark size={28} orbit={false} />
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  Klassa Agent
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                </h2>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Model Selector Dropdown */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
              <Cpu className="h-3.5 w-3.5 text-teal-600" />
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as AllowedAgentModelId)}
                className="bg-transparent font-medium focus:outline-hidden text-xs cursor-pointer text-slate-800"
              >
                {AVAILABLE_AGENT_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Settings Trigger */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              title="Pengaturan Memori & Gaya Asisten"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Message Stream Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {messages.length === 0 ? (
            /* Empty State Hero */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-8">
              <AgentMark size={56} className="mb-4" streaming={isStreaming} />
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                Halo, {teacherName || "Bapak/Ibu Guru"}!
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-md">
                Saya adalah Klassa Agent, asisten operasional dan rekan diskusi mengajar Anda di {activeSchoolName}.
                Ada yang bisa saya bantu hari ini?
              </p>

              <div className="mt-6 w-full">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Pertanyaan Populer Guru:
                </span>
                <div className="mt-2 flex justify-center">
                  <QuickPromptPills
                    disabled={isStreaming}
                    onSelectPrompt={(p) => handleSendMessage(p)}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Render Message History */
            messages.map((m) => (
              <ChatMessageBubble
                key={m.id}
                message={m}
                onProposalExecuted={() => refreshProposals()}
                onProposalCancelled={() => refreshProposals()}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input & Footer Controls */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200/80 shrink-0">
          {/* Quick pills when there are messages */}
          {messages.length > 0 && messages.length <= 4 && (
            <div className="mb-2">
              <QuickPromptPills
                disabled={isStreaming}
                onSelectPrompt={(p) => handleSendMessage(p)}
              />
            </div>
          )}

          <div className="relative flex items-end rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 focus-within:border-teal-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
            <textarea
              ref={inputRef}
              rows={2}
              value={inputMessage}
              disabled={isStreaming}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik instruksi atau pertanyaan mengajar... (Enter untuk kirim)"
              className="flex-1 resize-none bg-transparent px-3 py-1.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden max-h-32"
            />
            <button
              type="button"
              data-testid="send-message-button"
              disabled={!inputMessage.trim() || isStreaming}
              onClick={() => handleSendMessage()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Klassa Agent beroperasi dengan sistem konfirmasi guru untuk seluruh mutasi data kelas.
            </span>
            <span className="hidden sm:inline font-mono">Shift + Enter untuk baris baru</span>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <AgentSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialMemory={memory}
        onMemoryUpdated={(updated) => {
          setMemory(updated);
          setSelectedModel(updated.preferredModel as AllowedAgentModelId);
        }}
      />
    </div>
  );
}
