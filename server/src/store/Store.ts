import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import { config } from "../config.js";

// Typed EventEmitter helper — constrains emit/on/once/off to known events
type TypedEventEmitter<T> = {
  on<K extends keyof T & string>(event: K, listener: (...args: T[K] extends unknown[] ? T[K] : never) => void): EventEmitter;
  once<K extends keyof T & string>(event: K, listener: (...args: T[K] extends unknown[] ? T[K] : never) => void): EventEmitter;
  off<K extends keyof T & string>(event: K, listener: (...args: T[K] extends unknown[] ? T[K] : never) => void): EventEmitter;
  emit<K extends keyof T & string>(event: K, ...args: T[K] extends unknown[] ? T[K] : never): boolean;
  removeAllListeners<K extends keyof T & string>(event?: K): EventEmitter;
};

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type AgentType =
  | "general-purpose"
  | "Explore"
  | "Plan"
  | "statusline-setup"
  | "claude-code-guide"
  | "custom";

export type AgentStatus = "active" | "idle" | "completed";
export type TaskStatus = "pending" | "in_progress" | "completed";
export type InteractionType = "spawn" | "message" | "task_assign" | "tool_use";

export interface Session {
  sessionId: string;
  pid: number;
  cwd: string;
  startedAt: string;
  status: "active" | "ended";
}

export interface AgentLastAction {
  type: string;
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
  lastAction: AgentLastAction | null;
}

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

export interface Interaction {
  id: string;
  type: InteractionType;
  fromAgentId: string;
  toAgentId: string | null;
  label: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface FullState {
  sessions: Session[];
  agents: Agent[];
  tasks: Task[];
  teams: Team[];
  interactions: Interaction[];
}

// ──────────────────────────────────────────────
// Store event map (for typed emitter usage)
// ──────────────────────────────────────────────

export interface StoreEvents {
  "session:start": [session: Session];
  "session:end": [data: { sessionId: string }];
  "agent:start": [agent: Agent];
  "agent:update": [data: Partial<Agent> & { agentId: string }];
  "agent:stop": [data: { agentId: string }];
  "task:update": [task: Task];
  "team:update": [team: Team];
  "interaction:new": [interaction: Interaction];
  "tool:use": [data: { agentId: string; toolName: string; timestamp: string }];
}

// ──────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────

export class Store extends (EventEmitter as { new(): TypedEventEmitter<StoreEvents> & EventEmitter }) {
  private sessions = new Map<string, Session>();
  private agents = new Map<string, Agent>();
  private tasks = new Map<string, Task>();
  private teams = new Map<string, Team>();
  private interactions: Interaction[] = [];
  private gcTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.gcTimer = setInterval(() => this.gc(), config.gcIntervalMs);
    this.gcTimer.unref();
  }

  /**
   * Garbage-collect ended sessions, completed agents, and their associated
   * data after they have been stale for `config.gcMaxAgeMs`.
   */
  private gc(): void {
    const cutoff = Date.now() - config.gcMaxAgeMs;

    // Remove ended sessions older than cutoff
    for (const [id, session] of this.sessions) {
      if (session.status !== "ended") continue;
      const ts = new Date(session.startedAt).getTime();
      if (ts < cutoff) {
        this.sessions.delete(id);
      }
    }

    // Remove completed agents older than cutoff
    for (const [id, agent] of this.agents) {
      if (agent.status !== "completed") continue;
      const ts = agent.endedAt ? new Date(agent.endedAt).getTime() : 0;
      if (ts > 0 && ts < cutoff) {
        this.agents.delete(id);
      }
    }

    // Remove interactions older than cutoff
    this.interactions = this.interactions.filter((i) => {
      return new Date(i.timestamp).getTime() >= cutoff;
    });
  }

  /**
   * Stop the GC timer (for graceful shutdown).
   */
  stopGc(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }

  // ── Sessions ──────────────────────────────

  upsertSession(session: Session): void {
    const existing = this.sessions.get(session.sessionId);
    this.sessions.set(session.sessionId, session);

    if (!existing) {
      console.log(`[dashboard] session:start ${session.sessionId}`);
      this.emit("session:start", session);
    }
  }

  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = "ended";
    this.sessions.set(sessionId, session);
    console.log(`[dashboard] session:end ${sessionId}`);
    this.emit("session:end", { sessionId });
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  // ── Agents ────────────────────────────────

  upsertAgent(agent: Agent): void {
    const existing = this.agents.get(agent.agentId);
    this.agents.set(agent.agentId, agent);

    if (!existing) {
      console.log(`[dashboard] agent:start ${agent.agentId} (${agent.type})`);
      this.emit("agent:start", agent);
    } else {
      console.log(`[dashboard] agent:update ${agent.agentId}`);
      this.emit("agent:update", agent);
    }
  }

  updateAgentPartial(partial: Partial<Agent> & { agentId: string }): void {
    const existing = this.agents.get(partial.agentId);
    if (existing) {
      const updated = { ...existing, ...partial };
      this.agents.set(partial.agentId, updated);
      console.log(`[dashboard] agent:update ${partial.agentId}`);
      this.emit("agent:update", partial);
    }
  }

  removeAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = "completed";
      agent.endedAt = new Date().toISOString();
      this.agents.set(agentId, agent);
    }
    console.log(`[dashboard] agent:stop ${agentId}`);
    this.emit("agent:stop", { agentId });
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  getAgentsBySession(sessionId: string): Agent[] {
    return [...this.agents.values()].filter((a) => a.sessionId === sessionId);
  }

  // ── Tasks ─────────────────────────────────

  upsertTask(task: Task): void {
    this.tasks.set(task.taskId, task);
    console.log(`[dashboard] task:update ${task.taskId} → ${task.status}`);
    this.emit("task:update", task);
  }

  // ── Teams ─────────────────────────────────

  upsertTeam(team: Team): void {
    this.teams.set(team.teamName, team);
    console.log(`[dashboard] team:update ${team.teamName}`);
    this.emit("team:update", team);
  }

  getTeam(teamName: string): Team | undefined {
    return this.teams.get(teamName);
  }

  // ── Interactions ──────────────────────────

  addInteraction(interaction: Interaction): void {
    if (!interaction.id) {
      interaction.id = crypto.randomUUID();
    }
    this.interactions.push(interaction);

    // Cap interactions to prevent unbounded growth
    if (this.interactions.length > config.maxInteractions) {
      this.interactions = this.interactions.slice(-config.maxInteractions);
    }

    console.log(`[dashboard] interaction:new ${interaction.type} ${interaction.fromAgentId} → ${interaction.toAgentId ?? "—"}`);
    this.emit("interaction:new", interaction);
  }

  // ── Full state ────────────────────────────

  getFullState(): FullState {
    return {
      sessions: [...this.sessions.values()],
      agents: [...this.agents.values()],
      tasks: [...this.tasks.values()],
      teams: [...this.teams.values()],
      interactions: [...this.interactions],
    };
  }
}
