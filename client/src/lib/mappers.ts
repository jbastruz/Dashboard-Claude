import type { ConversationEntry } from "../types/ws-events";
import type { ChatMessage } from "../types/chat";

/** Map server ConversationEntry to client ChatMessage (adds agentId). */
export function toClientMessages(agentId: string, entries: ConversationEntry[]): ChatMessage[] {
  return entries.map((e) => ({
    id: e.id,
    agentId,
    role: e.role,
    content: e.content,
    timestamp: e.timestamp,
    isStreaming: e.isStreaming ?? false,
    toolName: e.toolName,
    toolInput: e.toolInput,
  }));
}
