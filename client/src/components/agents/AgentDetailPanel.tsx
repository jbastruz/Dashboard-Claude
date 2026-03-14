import { X, Wrench } from "lucide-react";
import type { Agent } from "../../types/models";
import { fr } from "../../lib/fr";
import { timeAgo, formatTime } from "../../lib/formatters";
import { useAgentStore } from "../../stores/agentStore";
import AgentTypeBadge from "./AgentTypeBadge";
import AgentStatusDot from "./AgentStatusDot";

interface AgentDetailPanelProps {
  agent: Agent;
  onClose: () => void;
}

export default function AgentDetailPanel({ agent, onClose }: AgentDetailPanelProps) {
  return (
    <aside className="flex w-80 flex-col border-l border-claude-border bg-claude-surface slide-in overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-claude-border px-4 py-3">
        <h2 className="text-sm font-semibold text-claude-text">
          {fr.agent.detail}
        </h2>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-claude-text-secondary transition-colors hover:bg-claude-surface-hover hover:text-claude-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <AgentDetailContent agent={agent} />
    </aside>
  );
}

/** Reusable agent detail content (without aside wrapper), used by RightPanel */
export function AgentDetailContent({ agent }: { agent: Agent }) {
  const agents = useAgentStore((s) => s.agents);
  const parentAgent = agent.parentAgentId
    ? agents.find((a) => a.agentId === agent.parentAgentId)
    : null;

  const statusLabel =
    agent.status === "active"
      ? fr.agent.active
      : agent.status === "idle"
        ? fr.agent.idle
        : fr.agent.completed;

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto">
      {/* Name + type + status */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-claude-text">
            {agent.name}
          </h3>
          <AgentTypeBadge type={agent.type} />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <AgentStatusDot status={agent.status} />
          <span className="text-claude-text">{statusLabel}</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed text-claude-text-secondary">
        {agent.description}
      </p>

      {/* Info rows */}
      <div className="flex flex-col gap-3 text-sm">
        <InfoRow label={fr.agent.startedAt} value={formatTime(agent.startedAt)} />
        <InfoRow label={fr.agent.lastActivity} value={timeAgo(agent.lastActivity)} />

        {parentAgent && (
          <InfoRow label={fr.agent.parent} value={parentAgent.name} />
        )}

        {agent.teamName && (
          <InfoRow label={fr.agent.team} value={agent.teamName} />
        )}
      </div>

      {/* Tools */}
      <div className="flex flex-col gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-claude-text-secondary">
          <Wrench className="h-3 w-3" />
          {fr.agent.tools}
        </h4>

        {agent.toolsUsed.length === 0 ? (
          <p className="text-xs text-claude-text-secondary">{fr.agent.noTools}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {agent.toolsUsed.map((tool) => (
              <span
                key={tool}
                className="rounded-md bg-claude-overlay px-2 py-1 text-xs font-mono text-claude-text"
              >
                {tool}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-claude-text-secondary">{label}</span>
      <span className="text-claude-text">{value}</span>
    </div>
  );
}
