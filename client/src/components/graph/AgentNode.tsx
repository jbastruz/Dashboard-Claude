import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Clock } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import type { Agent } from "../../types/models";
import { AGENT_TYPE_COLORS } from "../../lib/constants";
import { truncate } from "../../lib/formatters";
import { fr } from "../../lib/fr";
import AgentStatusDot from "../agents/AgentStatusDot";
import { useAgentStore } from "../../stores/agentStore";
import { useTaskStore } from "../../stores/taskStore";

export type AgentNodeData = { agent: Agent } & Record<string, unknown>;
export type AgentNodeType = Node<AgentNodeData, "agentNode">;

function AgentNodeComponent({ data }: NodeProps<AgentNodeType>) {
  const agent = data.agent;
  const colors = AGENT_TYPE_COLORS[agent.type];
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const typeLabel = fr.agentType[agent.type] ?? agent.type;

  const inProgressCount = useTaskStore(
    useShallow(
      (s) =>
        s.tasks.filter(
          (t) => t.ownerId === agent.agentId && t.status === "in_progress",
        ).length,
    ),
  );

  return (
    <div
      onClick={() => selectAgent(agent.agentId)}
      className={`relative flex w-[260px] cursor-pointer flex-col gap-2 rounded-lg border bg-claude-surface p-3 transition-colors hover:bg-claude-surface-hover ${colors.border}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-claude-handle !border-claude-handle-border !w-2 !h-2" />

      {/* Task count badge */}
      {inProgressCount > 0 && (
        <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-claude-orange px-1 text-[10px] font-bold text-white">
          {inProgressCount}
        </span>
      )}

      {/* Header: type + status */}
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}
        >
          {typeLabel}
        </span>
        <AgentStatusDot status={agent.status} />
      </div>

      {/* Name */}
      <h4 className="text-sm font-semibold text-claude-text">{agent.name}</h4>

      {/* Description */}
      <p className="text-[11px] leading-relaxed text-claude-text-secondary">
        {truncate(agent.description, 60)}
      </p>

      {/* Idle indicator */}
      {agent.status === "idle" && (
        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <Clock className="h-3 w-3" />
          {fr.agent.waitingFor}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-claude-handle !border-claude-handle-border !w-2 !h-2" />
    </div>
  );
}

export default memo(AgentNodeComponent);
