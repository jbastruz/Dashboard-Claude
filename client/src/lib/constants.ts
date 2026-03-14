import type { AgentStatus, AgentType } from "../types/models";

export const AGENT_TYPE_COLORS: Record<AgentType, { bg: string; text: string; border: string; hex: string }> = {
  Explore: { bg: "bg-blue-100 dark:bg-blue-500/20", text: "text-blue-700 dark:text-blue-400", border: "border-blue-300 dark:border-blue-500/40", hex: "#3b82f6" },
  Plan: { bg: "bg-purple-100 dark:bg-purple-500/20", text: "text-purple-700 dark:text-purple-400", border: "border-purple-300 dark:border-purple-500/40", hex: "#a855f7" },
  "general-purpose": { bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-300 dark:border-emerald-500/40", hex: "#10b981" },
  "statusline-setup": { bg: "bg-amber-100 dark:bg-amber-500/20", text: "text-amber-700 dark:text-amber-400", border: "border-amber-300 dark:border-amber-500/40", hex: "#f59e0b" },
  "claude-code-guide": { bg: "bg-cyan-100 dark:bg-cyan-500/20", text: "text-cyan-700 dark:text-cyan-400", border: "border-cyan-300 dark:border-cyan-500/40", hex: "#06b6d4" },
  custom: { bg: "bg-gray-100 dark:bg-gray-500/20", text: "text-gray-600 dark:text-gray-400", border: "border-gray-300 dark:border-gray-500/40", hex: "#6b7280" },
};

export const AGENT_STATUS_COLORS: Record<AgentStatus, { dot: string; pulse: string }> = {
  active: { dot: "bg-emerald-500 dark:bg-emerald-400", pulse: "animate-pulse" },
  idle: { dot: "bg-amber-500 dark:bg-amber-400", pulse: "" },
  completed: { dot: "bg-gray-400 dark:bg-gray-500", pulse: "" },
};

// In dev, connect via Vite's proxy (same host:port as the page). In prod, connect to 3002 directly.
const loc = typeof window !== "undefined" ? window.location : null;
const wsProto = loc?.protocol === "https:" ? "wss:" : "ws:";
export const WS_URL = loc ? `${wsProto}//${loc.host}/ws` : "ws://localhost:3002/ws";
export const API_URL = loc ? `${loc.protocol}//${loc.host}` : "http://localhost:3002";

export const WS_RECONNECT_BASE_MS = 1000;
export const WS_RECONNECT_MAX_MS = 30000;
