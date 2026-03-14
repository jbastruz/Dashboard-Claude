import type { AgentType } from "../../types/models";
import { AGENT_TYPE_COLORS } from "../../lib/constants";
import { fr } from "../../lib/fr";

interface AgentTypeBadgeProps {
  type: AgentType;
}

export default function AgentTypeBadge({ type }: AgentTypeBadgeProps) {
  const colors = AGENT_TYPE_COLORS[type];
  const label = fr.agentType[type] ?? type;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}
    >
      {label}
    </span>
  );
}
