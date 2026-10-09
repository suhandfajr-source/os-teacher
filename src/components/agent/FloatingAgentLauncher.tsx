"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  X,
  Send,
  Maximize2,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { ChatMessageBubble, ChatMessageItem } from "./ChatMessageBubble";
import { QuickPromptPills } from "./QuickPromptPills";
import { AgentMark } from "@/components/brand";

export function FloatingAgentLauncher() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isStreaming, isOpen]);

  // JANGAN tampilkan floating launcher jika guru sedang berada di halaman penuh /asisten
  // CATATAN: Early return diletakkan SETELAH seluruh React hooks dideklarasikan (Rules of Hooks)
  if (pathname?.startsWith("/asisten")) {
    return null;
  }

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isStreaming) return;

    setInputMessage("");
    setIsStreaming(true);

    const tempUserMsgId = `float-user-${Date.now()}`;
    const tempAssistantMsgId = `float-asst-${Date.now()}`;

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
          conversationId: conversationId || undefined,
          message: text,
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal menghubungkan ke asisten.");
      }

      const serverConvId = response.headers.get("x-conversation-id");
      if (serverConvId && !conversationId) {
        setConversationId(serverConvId);
      }

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

      if (!accumulatedText.trim()) {
        accumulatedText = "Maaf, terjadi kendala saat memproses jawaban. Silakan coba sesaat lagi.";
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAssistantMsgId
            ? { ...msg, content: accumulatedText, isStreaming: false }
            : msg
        )
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan.");
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAssistantMsgId
            ? {
                ...msg,
                content: "Maaf, terjadi kendala saat memproses jawaban.",
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleOpenFullScreen = () => {
    setIsOpen(false);
    router.push("/asisten");
  };

  return (
    <>
      {/* 1. Floating Trigger Button — bubble K brand + sparkle mengorbit */}
      {!isOpen && (
        <button
          type="button"
          data-testid="floating-agent-button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 md:bottom-7 right-6 z-40 rounded-full transition-all active:scale-95 group"
          title="Tanya Klassa Agent"
        >
          <AgentMark
            size={56}
            className="transition-transform duration-300 group-hover:scale-105"
          />
        </button>
      )}

      {/* 2. Floating Chat Drawer/Popover */}
      {isOpen && (
        <div
          data-testid="floating-agent-drawer"
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 flex h-[540px] w-[92vw] sm:w-[420px] flex-col rounded-3xl border border-slate-200/80 bg-white shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-teal-700 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <AgentMark size={32} orbit={false} streaming={isStreaming} />
              <div>
                <h4 className="text-xs font-bold">Klassa Quick Assist</h4>
                <p className="text-[10px] text-teal-100">Rekan mengajar AI Anda</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleOpenFullScreen}
                className="rounded-lg p-1.5 text-teal-100 hover:bg-white/10 hover:text-white transition-colors"
                title="Buka Layar Penuh"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-teal-100 hover:bg-white/10 hover:text-white transition-colors"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#F8FAF9] space-y-2">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 mb-2">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h5 className="text-xs font-bold text-slate-800">Butuh bantuan mengajar cepat?</h5>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Tanyakan presensi, draf pengumuman, atau tips ajar tanpa meninggalkan halaman ini.
                </p>
                <div className="mt-3 w-full">
                  <QuickPromptPills
                    disabled={isStreaming}
                    onSelectPrompt={(p) => handleSendMessage(p)}
                  />
                </div>
              </div>
            ) : (
              messages.map((m) => <ChatMessageBubble key={m.id} message={m} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="border-t border-slate-200/80 bg-white p-2.5">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 focus-within:border-teal-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
              <input
                type="text"
                value={inputMessage}
                disabled={isStreaming}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tanya asisten..."
                className="flex-1 bg-transparent px-2 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden"
              />
              <button
                type="button"
                disabled={!inputMessage.trim() || isStreaming}
                onClick={() => handleSendMessage()}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white shadow-xs hover:bg-teal-700 disabled:opacity-40 transition-all"
              >
                {isStreaming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
