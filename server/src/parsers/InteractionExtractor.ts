import crypto from "node:crypto";
import type { Interaction } from "../store/Store.js";

/**
 * Represents a single entry from a JSONL conversation log.
 * The actual shape varies; we only care about specific tool-call patterns.
 */
interface ConversationEntry {
  role?: string;
  type?: string;
  content?: unknown;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  agent_id?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Resolve a short name (e.g. "team-lead-2") to a full agentId (e.g. "team-lead-2@fix-display")
 * when a teamName is known. If the name already contains "@" or no teamName, return as-is.
 */
function resolveAgentId(name: string | null, teamName?: string): string | null {
  if (!name) return null;
  if (name.includes("@") || !teamName || name === "*") return name;
  return `${name}@${teamName}`;
}

/**
 * Extracts Interaction records from parsed JSONL conversation entries.
 *
 * Looks for:
 * - "Agent" tool calls → spawn interactions
 * - "SendMessage" tool calls → message interactions
 *
 * @param teamName — if provided, short names in SendMessage.to are expanded to "name@team"
 */
export function extractInteractions(
  entries: unknown[],
  sourceAgentId: string,
  teamName?: string,
): Interaction[] {
  const interactions: Interaction[] = [];

  for (const raw of entries) {
    if (!raw || typeof raw !== "object") continue;

    const entry = raw as ConversationEntry;

    // Only look at assistant-side tool invocations
    if (entry.type === "tool_use" || entry.tool_name) {
      const toolName = entry.tool_name ?? (entry as Record<string, unknown>).name as string | undefined;
      const input = entry.tool_input ?? (entry as Record<string, unknown>).input as Record<string, unknown> | undefined;
      const ts = entry.timestamp ?? new Date().toISOString();

      if (toolName === "Agent" || toolName === "agent") {
        const targetId = (input?.agent_id as string) ?? null;
        const taskDesc = (input?.task as string) ?? (input?.description as string) ?? "sub-agent";
        interactions.push({
          id: crypto.randomUUID(),
          type: "spawn",
          fromAgentId: sourceAgentId,
          toAgentId: targetId,
          label: `spawn: ${taskDesc}`.slice(0, 120),
          timestamp: ts,
          data: input ? { ...input } : undefined,
        });
      }

      if (toolName === "SendMessage" || toolName === "send_message") {
        const targetId = (input?.to as string) ?? (input?.to_agent_id as string) ?? (input?.recipient as string) ?? null;
        const rawMsg = input?.message;
        const msg = typeof rawMsg === "string" ? rawMsg : (input?.summary as string) ?? "message";
        interactions.push({
          id: crypto.randomUUID(),
          type: "message",
          fromAgentId: sourceAgentId,
          toAgentId: resolveAgentId(targetId, teamName),
          label: msg.slice(0, 120),
          timestamp: ts,
          data: input ? { ...input } : undefined,
        });
      }
    }

    // Also check inside nested content arrays (common in Claude API format)
    if (Array.isArray(entry.content)) {
      for (const block of entry.content) {
        if (!block || typeof block !== "object") continue;

        const b = block as Record<string, unknown>;
        if (b.type !== "tool_use") continue;

        const toolName = b.name as string | undefined;
        const input = b.input as Record<string, unknown> | undefined;
        const ts = entry.timestamp ?? new Date().toISOString();

        if (toolName === "Agent" || toolName === "agent") {
          const targetId = (input?.agent_id as string) ?? null;
          const taskDesc = (input?.task as string) ?? (input?.description as string) ?? "sub-agent";
          interactions.push({
            id: crypto.randomUUID(),
            type: "spawn",
            fromAgentId: sourceAgentId,
            toAgentId: targetId,
            label: `spawn: ${taskDesc}`.slice(0, 120),
            timestamp: ts,
            data: input ? { ...input } : undefined,
          });
        }

        if (toolName === "SendMessage" || toolName === "send_message") {
          const targetId = (input?.to as string) ?? (input?.to_agent_id as string) ?? (input?.recipient as string) ?? null;
          const rawMsg = input?.message;
          const msg = typeof rawMsg === "string" ? rawMsg : (input?.summary as string) ?? "message";
          interactions.push({
            id: crypto.randomUUID(),
            type: "message",
            fromAgentId: sourceAgentId,
            toAgentId: resolveAgentId(targetId, teamName),
            label: msg.slice(0, 120),
            timestamp: ts,
            data: input ? { ...input } : undefined,
          });
        }
      }
    }
  }

  return interactions;
}
