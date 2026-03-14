import { Wrench } from "lucide-react";
import type { Agent } from "../../types/models";
import { timeAgo, truncate } from "../../lib/formatters";
import { fr } from "../../lib/fr";
import { useAgentStore } from "../../stores/agentStore";
import AgentTypeBadge from "./AgentTypeBadge";
import AgentStatusDot from "./AgentStatusDot";

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
