import { Plus, MessageSquare, CheckSquare, Wrench } from "lucide-react";
import type { Interaction, InteractionType } from "../../types/models";
import { fr } from "../../lib/fr";
import { timeAgo } from "../../lib/formatters";
import { useAgentStore } from "../../stores/agentStore";

interface TimelineEventProps {
  interaction: Interaction;
}

const TYPE_ICONS: Record<InteractionType, typeof Plus> = {
  spawn: Plus,
  message: MessageSquare,
  task_assign: CheckSquare,
  tool_use: Wrench,
};

const TYPE_BORDER_COLORS: Record<InteractionType, string> = {
  spawn: "border-l-emerald-500",
  message: "border-l-blue-500",
  task_assign: "border-l-purple-500",
  tool_use: "border-l-amber-500",
};

const TYPE_ICON_COLORS: Record<InteractionType, string> = {
  spawn: "text-emerald-400 bg-emerald-500/10",
  message: "text-blue-400 bg-blue-500/10",
  task_assign: "text-purple-400 bg-purple-500/10",
  tool_use: "text-amber-400 bg-amber-500/10",
};

export default function TimelineEvent({ interaction }: TimelineEventProps) {
  const fromAgent = useAgentStore((s) =>
    s.agents.find((a) => a.agentId === interaction.fromAgentId),
  );
  const toAgent = useAgentStore((s) =>
    interaction.toAgentId
      ? s.agents.find((a) => a.agentId === interaction.toAgentId)
      : null,
  );

  const Icon = TYPE_ICONS[interaction.type];
  const borderColor = TYPE_BORDER_COLORS[interaction.type];
  const iconColor = TYPE_ICON_COLORS[interaction.type];
  const label = fr.timeline[interaction.type] ?? interaction.type;

  const agentsText = toAgent
    ? `${fromAgent?.name ?? "?"} → ${toAgent.name}`
    : fromAgent?.name ?? "?";

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border-l-2 bg-claude-surface p-3 fade-in ${borderColor}`}
    >
      {/* Icon */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconColor}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-claude-text">{label}</span>
          <span className="text-[11px] text-claude-text-secondary">
            {timeAgo(interaction.timestamp)}
          </span>
        </div>

        <p className="text-xs text-claude-text-secondary">{agentsText}</p>

        {interaction.label && (
          <p className="mt-1 text-xs text-claude-text-secondary">{interaction.label}</p>
        )}
      </div>
    </div>
  );
}
