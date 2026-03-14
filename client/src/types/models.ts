export interface Session {
  sessionId: string;
  pid: number;
  cwd: string;
  startedAt: string;
  status: "active" | "ended";
}

export type AgentType =
  | "general-purpose"
  | "Explore"
  | "Plan"
  | "statusline-setup"
  | "claude-code-guide"
  | "custom";

export type AgentStatus = "active" | "idle" | "completed";

export type AgentActionType = "tool" | "idle" | "started" | "completed";

export interface AgentAction {
  type: AgentActionType;
  detail: string;
  timestamp: string;
}

export interface Agent {
  agentId: string;
  sessionId: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  description: string;
  parentAgentId: string | null;
  teamName: string | null;
  startedAt: string;
  endedAt: string | null;
  toolsUsed: string[];
  lastActivity: string;
  lastAction?: AgentAction;
}

export type TaskStatus = "pending" | "in_progress" | "completed";

export interface Task {
  taskId: string;
  sessionId: string;
  subject: string;
  status: TaskStatus;
  ownerId: string | null;
  ownerName: string | null;
  teamName: string | null;
  blocks: string[];
  blockedBy: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  teamName: string;
  leadSessionId: string;
  members: TeamMember[];
}

export interface TeamMember {
  name: string;
  agentId: string;
  agentType: AgentType;
}

export type InteractionType = "spawn" | "message" | "task_assign" | "tool_use";

export interface Interaction {
  id: string;
  type: InteractionType;
  fromAgentId: string;
  toAgentId: string | null;
  label: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface TmuxPane {
  paneId: string;
  sessionName: string;
  windowIndex: number;
  paneIndex: number;
  title: string;
  content: string;
  active: boolean;
}

export interface TmuxSession {
  sessionName: string;
  panes: TmuxPane[];
}

export interface FullState {
  sessions: Session[];
  agents: Agent[];
  tasks: Task[];
  teams: Team[];
  interactions: Interaction[];
}
