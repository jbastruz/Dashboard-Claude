import type { AgentStatus } from "../../types/models";
import { AGENT_STATUS_COLORS } from "../../lib/constants";

interface AgentStatusDotProps {
  status: AgentStatus;
}

export default function AgentStatusDot({ status }: AgentStatusDotProps) {
  const colors = AGENT_STATUS_COLORS[status];

  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colors.dot} ${
        status === "active" ? "status-pulse" : ""
      }`}
    />
  );
}
