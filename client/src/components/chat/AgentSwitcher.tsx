import type { Agent } from "../../types/models";
import AgentStatusDot from "../agents/AgentStatusDot";
import AgentTypeBadge from "../agents/AgentTypeBadge";

interface AgentSwitcherProps {
  agents: Agent[];
  activeAgentId: string | null;
  onSelect: (agentId: string) => void;
}

export default function AgentSwitcher({ agents, activeAgentId, onSelect }: AgentSwitcherProps) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-claude-border px-2 py-1 scrollbar-thin">
      {agents.map((agent) => {
        const isActive = agent.agentId === activeAgentId;
        const truncatedName =
          agent.name.length > 15 ? agent.name.slice(0, 15) + "\u2026" : agent.name;

        return (
          <button
            key={agent.agentId}
            onClick={() => onSelect(agent.agentId)}
            className={`flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors ${
              isActive
                ? "border-b-2 border-claude-orange text-claude-orange"
                : "text-claude-text-secondary hover:text-claude-text"
            }`}
          >
            <AgentStatusDot status={agent.status} />
            <span className="truncate">{truncatedName}</span>
            <AgentTypeBadge type={agent.type} />
          </button>
        );
      })}
    </div>
  );
}
