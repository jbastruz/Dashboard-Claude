import { Wrench, Pause, Play, CheckCircle } from "lucide-react";
import type { Agent, AgentActionType } from "../../types/models";
import { timeAgo, truncate } from "../../lib/formatters";
import { fr } from "../../lib/fr";
import { useAgentStore } from "../../stores/agentStore";
import AgentTypeBadge from "./AgentTypeBadge";
import AgentStatusDot from "./AgentStatusDot";

const actionIcons: Record<AgentActionType, React.ReactNode> = {
  tool: <Wrench className="h-3 w-3" />,
  idle: <Pause className="h-3 w-3" />,
  started: <Play className="h-3 w-3" />,
  completed: <CheckCircle className="h-3 w-3" />,
};

interface AgentCardProps {
  agent: Agent;
}

export default function AgentCard({ agent }: AgentCardProps) {
  const selectAgent = useAgentStore((s) => s.selectAgent);

  return (
    <button
      onClick={() => selectAgent(agent.agentId)}
      className="relative flex flex-col gap-3 rounded-lg border border-claude-border bg-claude-surface p-4 text-left transition-colors hover:border-claude-border hover:bg-claude-surface-hover fade-in"
    >
      {/* Type badge */}
      <div className="absolute right-3 top-3">
        <AgentTypeBadge type={agent.type} />
      </div>

      {/* Name + status */}
      <div className="flex items-center gap-2">
        <AgentStatusDot status={agent.status} />
        <h3 className="text-sm font-semibold text-claude-text">
          {agent.name}
        </h3>
      </div>

      {/* Description */}
      <p className="text-xs text-claude-text-secondary leading-relaxed">
        {truncate(agent.description, 80)}
      </p>

      {/* Last action */}
      {agent.lastAction && (
        <div className="flex items-center gap-1.5 text-xs text-claude-text-secondary">
          <span className="text-[#e07a3a]">
            {actionIcons[agent.lastAction.type]}
          </span>
          <span className="font-medium text-claude-text-secondary">
            {fr.agent.action[agent.lastAction.type] ?? agent.lastAction.type}
          </span>
          {agent.lastAction.detail && (
            <span className="truncate opacity-70">
              — {truncate(agent.lastAction.detail, 30)}
            </span>
          )}
          <span className="ml-auto shrink-0 opacity-50">
            {timeAgo(agent.lastAction.timestamp)}
          </span>
        </div>
      )}

      {/* Footer: last activity + tools */}
      <div className="mt-auto flex items-center justify-between text-xs text-claude-text-secondary">
        <span>{timeAgo(agent.lastActivity)}</span>
        <span className="flex items-center gap-1">
          <Wrench className="h-3 w-3" />
          {agent.toolsUsed.length} {fr.agent.tools.toLowerCase()}
        </span>
      </div>
    </button>
  );
}
