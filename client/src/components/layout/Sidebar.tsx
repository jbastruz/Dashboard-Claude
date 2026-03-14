import { Network, Users, ListTodo, Clock } from "lucide-react";
import { fr } from "../../lib/fr";
import type { ViewId } from "./Shell";
import { useAgentStore, useRelevantAgents } from "../../stores/agentStore";
import AgentStatusDot from "../agents/AgentStatusDot";

interface SidebarProps {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
}

const NAV_ITEMS: { id: ViewId; label: string; Icon: typeof Network }[] = [
  { id: "graph", label: fr.sidebar.graph, Icon: Network },
  { id: "agents", label: fr.sidebar.agents, Icon: Users },
  { id: "tasks", label: fr.sidebar.tasks, Icon: ListTodo },
  { id: "timeline", label: fr.sidebar.timeline, Icon: Clock },
];

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const agents = useRelevantAgents();
  const selectAgent = useAgentStore((s) => s.selectAgent);

  return (
    <aside className="flex w-56 flex-col border-r border-claude-border bg-claude-surface">
      {/* Logo area */}
      <div className="flex h-14 items-center gap-2 px-4 border-b border-claude-border">
        <div className="h-7 w-7 rounded-lg bg-claude-orange/20 flex items-center justify-center">
          <span className="text-claude-orange text-sm font-bold">C</span>
        </div>
        <span className="text-sm font-semibold text-claude-text">Dashboard</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              onClick={() => onViewChange(id)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-claude-orange/10 text-claude-orange"
                  : "text-claude-text-secondary hover:bg-claude-surface-hover hover:text-claude-text"
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Active agents section */}
      {agents.length > 0 && (
        <>
          <div className="mx-3 my-2 h-px bg-claude-border" />
          <div className="px-3">
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-claude-text-secondary">
              {fr.agent.activeAgents}
            </h4>
            <div className="flex flex-col gap-0.5">
              {agents.map((agent) => (
                <button
                  key={agent.agentId}
                  onClick={() => {
                    selectAgent(agent.agentId);
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-claude-text-secondary transition-colors hover:bg-claude-surface-hover hover:text-claude-text"
                >
                  <AgentStatusDot status={agent.status} />
                  <span className="truncate">{agent.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
