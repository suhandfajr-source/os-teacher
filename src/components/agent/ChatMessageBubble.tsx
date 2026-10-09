"use client";

import React from "react";
import { User, Wrench, Sparkles, AlertCircle } from "lucide-react";
import { AgentMark } from "@/components/brand";
import { ActionConfirmCard, ActionProposalData } from "./ActionConfirmCard";
import { FormattedMarkdown } from "./FormattedMarkdown";

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  toolCalls?: unknown[];
  pendingProposal?: ActionProposalData | null;
  createdAt?: string | Date;
}

interface ChatMessageBubbleProps {
  message: ChatMessageItem;
  onProposalExecuted?: (proposalId: string) => void;
  onProposalCancelled?: (proposalId: string) => void;
}

export function ChatMessageBubble({
  message,
  onProposalExecuted,
  onProposalCancelled,
}: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      data-testid={`chat-bubble-${message.role}`}
      className={`flex w-full gap-3 ${isUser ? "justify-end" : "justify-start"} py-2`}
    >
      {/* Avatar Asisten */}
      {!isUser && (
        <AgentMark size={32} orbit={false} streaming={message.isStreaming} />
      )}

      {/* Bubble Content */}
      <div className={`flex flex-col max-w-[85%] sm:max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Tool Call Activity Indicator if active */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-700 border border-teal-100">
            <Wrench className="h-3 w-3 text-teal-600 animate-spin" />
            <span>Memproses data kelas deterministik...</span>
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
            isUser
              ? "bg-teal-600 text-white rounded-tr-xs shadow-xs"
              : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs shadow-xs"
          }`}
        >
          {/* Thinking / Typing Animation State */}
          {!isUser && message.isStreaming && !message.content.trim() ? (
            <div className="flex items-center gap-2 py-0.5">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1 ml-1">
                <Sparkles className="h-3 w-3 text-teal-600 animate-pulse" />
                Klassa Agent sedang berpikir & meracik respon...
              </span>
            </div>
          ) : !message.content.trim() ? (
            <div className="text-slate-500 italic text-xs flex items-center gap-1.5 py-0.5">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>Respon tidak dapat dimuat atau terpotong saat memproses data kelas. Silakan tanyakan kembali.</span>
            </div>
          ) : (
            <div>
              <FormattedMarkdown content={message.content} isUser={isUser} />
              {message.isStreaming && (
                <span className="inline-block h-3 w-1.5 ml-1 bg-teal-500 animate-pulse align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Action Confirmation Card (HITL) */}
        {!isUser && message.pendingProposal && (
          <ActionConfirmCard
            proposal={message.pendingProposal}
            onExecuted={onProposalExecuted}
            onCancelled={onProposalCancelled}
          />
        )}
      </div>

      {/* Avatar Guru */}
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
