import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import type { Store } from "../store/Store.js";
import { toAgentType } from "../utils/agentTypes.js";

/**
 * Shape of the JSON body sent by Claude Code hooks.
 */
interface HookPayload {
  hook_type: string;
  session_id?: string;
  session_cwd?: string;
  session_pid?: number;
  agent_id?: string;
  agent_type?: string;
  agent_name?: string;
  agent_description?: string;
  parent_agent_id?: string;
  tool_name?: string;
  team_name?: string;
  task_id?: string;
  task_subject?: string;
  task_status?: string;
  task_owner_id?: string;
  task_owner_name?: string;
  task_blocks?: string[];
  task_blocked_by?: string[];
  [key: string]: unknown;
}

/**
 * Ensure a session exists in the store. If it doesn't, create it
 * automatically so that agents are never orphaned.
 */
function ensureSession(
  store: Store,
  sessionId: string,
  payload: HookPayload,
  now: string,
): void {
  if (!sessionId || store.getSession(sessionId)) return;
  store.upsertSession({
    sessionId,
    pid: payload.session_pid ?? 0,
    cwd: payload.session_cwd ?? "",
    startedAt: now,
    status: "active",
  });
}

export function createHookReceiver(store: Store): Router {
  const router = Router();

  router.post("/", (req: Request, res: Response) => {
    const payload = req.body as HookPayload;

    if (!payload || !payload.hook_type) {
      res.status(400).json({ error: "missing hook_type" });
      return;
    }

    const now = new Date().toISOString();

    try {
      switch (payload.hook_type) {
        // ── Session lifecycle ──────────────────

        case "SessionStart": {
          const sessionId = payload.session_id ?? crypto.randomUUID();
          store.upsertSession({
            sessionId,
            pid: payload.session_pid ?? 0,
            cwd: payload.session_cwd ?? "",
            startedAt: now,
            status: "active",
          });
          break;
        }

        case "SessionEnd": {
          if (payload.session_id) {
            store.removeSession(payload.session_id);
          }
          break;
        }

        // ── Subagent lifecycle ─────────────────

        case "SubagentStart": {
          const agentId = payload.agent_id ?? crypto.randomUUID();
          const sessionId = payload.session_id ?? "";
          const agentType = toAgentType(payload.agent_type);

          ensureSession(store, sessionId, payload, now);

          store.upsertAgent({
            agentId,
            sessionId,
            name: payload.agent_name ?? agentType,
            type: agentType,
            status: "active",
            description: payload.agent_description ?? "",
            parentAgentId: payload.parent_agent_id ?? null,
            teamName: payload.team_name ?? null,
            startedAt: now,
            endedAt: null,
            toolsUsed: [],
            lastActivity: now,
            lastAction: { type: "started", detail: payload.agent_name ?? agentType, timestamp: now },
          });

          // Record spawn interaction
          if (payload.parent_agent_id) {
            store.addInteraction({
              id: crypto.randomUUID(),
              type: "spawn",
              fromAgentId: payload.parent_agent_id,
              toAgentId: agentId,
              label: `spawned ${payload.agent_name ?? agentType}`,
              timestamp: now,
            });
          }
          break;
        }

        case "SubagentStop": {
          if (payload.agent_id) {
            const existing = store.getAgent(payload.agent_id);
            if (existing) {
              store.upsertAgent({
                ...existing,
                status: "completed",
                endedAt: now,
                lastActivity: now,
                lastAction: { type: "completed", detail: existing.name, timestamp: now },
              });
            } else {
              store.removeAgent(payload.agent_id);
            }
          }
          break;
        }

        // ── Teammate idle ──────────────────────

        case "TeammateIdle": {
          if (payload.session_id) ensureSession(store, payload.session_id, payload, now);
          if (payload.agent_id) {
            store.updateAgentPartial({
              agentId: payload.agent_id,
              status: "idle",
              lastActivity: now,
              lastAction: { type: "idle", detail: "waiting", timestamp: now },
            });
          }
          break;
        }

        // ── Task lifecycle ─────────────────────

        case "TaskCompleted": {
          if (payload.task_id) {
            store.upsertTask({
              taskId: payload.task_id,
              sessionId: payload.session_id ?? "",
              subject: payload.task_subject ?? "",
              status: "completed",
              ownerId: payload.task_owner_id ?? null,
              ownerName: payload.task_owner_name ?? null,
              teamName: payload.team_name ?? null,
              blocks: payload.task_blocks ?? [],
              blockedBy: payload.task_blocked_by ?? [],
              createdAt: now,
              updatedAt: now,
            });
          }
          break;
        }

        // ── Tool usage ─────────────────────────

        case "PreToolUse": {
          if (payload.session_id) ensureSession(store, payload.session_id, payload, now);
          if (payload.agent_id && payload.tool_name) {
            // Emit tool:use event
            store.emit("tool:use", {
              agentId: payload.agent_id,
              toolName: payload.tool_name,
              timestamp: now,
            });

            // Add tool to agent's toolsUsed list and update lastAction
            const agent = store.getAgent(payload.agent_id);
            if (agent) {
              const partial: Parameters<typeof store.updateAgentPartial>[0] = {
                agentId: payload.agent_id,
                lastAction: { type: "tool", detail: payload.tool_name, timestamp: now },
              };
              if (!agent.toolsUsed.includes(payload.tool_name)) {
                partial.toolsUsed = [...agent.toolsUsed, payload.tool_name];
              }
              store.updateAgentPartial(partial);
            }

            // Record tool_use interaction
            store.addInteraction({
              id: crypto.randomUUID(),
              type: "tool_use",
              fromAgentId: payload.agent_id,
              toAgentId: null,
              label: payload.tool_name,
              timestamp: now,
              data: { toolName: payload.tool_name },
            });
          }
          break;
        }

        case "PostToolUse": {
          if (payload.agent_id) {
            store.updateAgentPartial({
              agentId: payload.agent_id,
              lastActivity: now,
              lastAction: { type: "tool", detail: payload.tool_name ?? "unknown", timestamp: now },
            });
          }
          break;
        }

        // ── Stop (session-level) ───────────────

        case "Stop": {
          if (payload.session_id) {
            const agents = store.getAgentsBySession(payload.session_id);
            for (const agent of agents) {
              if (agent.status !== "completed") {
                store.upsertAgent({
                  ...agent,
                  status: "completed",
                  endedAt: now,
                  lastActivity: now,
                  lastAction: { type: "completed", detail: "session stopped", timestamp: now },
                });
              }
            }
            store.removeSession(payload.session_id);
          }
          break;
        }

        default:
          console.log(`[dashboard] unknown hook_type: ${payload.hook_type}`);
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[dashboard] hook processing error: ${message}`);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
