export type ChatMessageRole = "user" | "assistant" | "system" | "tool_call" | "tool_result" | "thinking";

export interface ChatMessage {
  id: string;
  agentId: string;
  role: ChatMessageRole;
  content: string;
  timestamp: string;
  isStreaming: boolean;
  toolName?: string;
  toolInput?: string;
}

/** Client-to-server WebSocket events — aligned with server/src/ws/clientEvents.ts */
export type WsClientEvent =
  | { type: "command:start-session"; requestId: string; data: { cwd: string; prompt?: string; model?: string } }
  | { type: "command:send-message"; requestId: string; data: { sessionId: string; message: string } }
  | { type: "command:stop-session"; requestId: string; data: { sessionId: string } }
  | { type: "command:resume-session"; requestId: string; data: { sessionId: string; cwd?: string } };
