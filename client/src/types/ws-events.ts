import type { Agent, FullState, Interaction, Session, Task, Team, TmuxPane, TmuxSession } from "./models";

export interface ConversationEntry {
  id: string;
  role: "user" | "assistant" | "system" | "tool_call" | "tool_result" | "thinking";
  content: string;
  timestamp: string;
  toolName?: string;
  toolInput?: string;
  isStreaming?: boolean;
}

export type WsEvent =
  | { type: "snapshot"; data: FullState }
  | { type: "session:start"; data: Session }
  | { type: "session:end"; data: { sessionId: string } }
  | { type: "agent:start"; data: Agent }
  | { type: "agent:update"; data: Partial<Agent> & { agentId: string } }
  | { type: "agent:stop"; data: { agentId: string } }
  | { type: "task:update"; data: Task }
  | { type: "interaction:new"; data: Interaction }
  | { type: "team:update"; data: Team }
  | {
      type: "tool:use";
      data: { agentId: string; toolName: string; timestamp: string };
    }
  | { type: "conversation:update"; data: { targetId: string; entries: ConversationEntry[] } }
  | { type: "session:output"; data: { sessionId: string; chunk: unknown } }
  | { type: "command:ack"; data: { requestId: string; sessionId?: string } }
  | { type: "command:error"; data: { requestId: string; error: string } }
  | { type: "tmux:sessions"; data: { available: boolean; sessions: TmuxSession[] } }
  | { type: "tmux:update"; data: TmuxPane };
