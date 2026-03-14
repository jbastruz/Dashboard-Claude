import { useRelevantAgents } from "../../stores/agentStore";
import AgentCard from "./AgentCard";

interface AgentGridProps {
  sessionId?: string;
}

export default function AgentGrid({ sessionId: _sessionId }: AgentGridProps) {
  const agents = useRelevantAgents();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {agents.map((agent) => (
        <AgentCard key={agent.agentId} agent={agent} />
      ))}
    </div>
  );
}
