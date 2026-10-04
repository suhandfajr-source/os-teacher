export type AgentRole = "user" | "assistant" | "system" | "tool";

export type ActionStatus = "NONE" | "PENDING" | "CONFIRMED" | "REJECTED";

export interface PendingActionProposal {
  actionType: "RECORD_ATTENDANCE" | "CREATE_ASSIGNMENT" | "POST_ANNOUNCEMENT" | "UPDATE_ASSESSMENT";
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  requiresConfirmation: boolean;
}

export interface AgentMessageDTO {
  id: string;
  conversationId: string;
  role: AgentRole;
  content: string;
  toolCalls?: unknown;
  toolResults?: unknown;
  pendingAction?: PendingActionProposal | null;
  actionStatus?: ActionStatus | null;
  createdAt: Date;
}

export interface AgentConversationDTO {
  id: string;
  title: string;
  modelUsed: string;
  classContextId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  messagesCount?: number;
}

export interface TeacherMemoryDTO {
  id: string;
  teacherProfileId: string;
  communicationTone: "LUGAS_RINGKAS" | "RAMAH_SOPAN" | "FORMAL";
  preferredModel: string;
  pedagogyDefaults?: Record<string, unknown> | null;
  customContext?: string | null;
  updatedAt: Date;
}

export interface ModelProviderOption {
  id: string;
  name: string;
  provider: "google" | "openai-compatible" | "custom";
  description: string;
  isDefault?: boolean;
}
