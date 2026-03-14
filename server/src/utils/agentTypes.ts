import type { AgentType } from "../store/Store.js";

export const KNOWN_AGENT_TYPES = new Set<AgentType>([
  "general-purpose",
  "Explore",
  "Plan",
  "statusline-setup",
  "claude-code-guide",
  "custom",
]);

export function toAgentType(raw: unknown): AgentType {
  if (typeof raw === "string" && KNOWN_AGENT_TYPES.has(raw as AgentType)) {
    return raw as AgentType;
  }
  return "custom";
}
