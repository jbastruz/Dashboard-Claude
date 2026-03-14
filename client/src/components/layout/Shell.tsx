import { useState } from "react";
import type { Session } from "../../types/models";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useSelectedAgent, useAgentStore, useRelevantAgents } from "../../stores/agentStore";
import RightPanel from "../chat/RightPanel";
import InteractionGraph from "../graph/InteractionGraph";
import AgentGrid from "../agents/AgentGrid";
import TaskBoard from "../tasks/TaskBoard";
import Timeline from "../timeline/Timeline";
import MonitoringView from "../monitoring/MonitoringView";
import ErrorBoundary from "../ErrorBoundary";

export type ViewId = "graph" | "agents" | "tasks" | "timeline" | "monitoring";

interface ShellProps {
  session: Session;
}

export default function Shell({ session }: ShellProps) {
  const [activeView, setActiveView] = useState<ViewId>("graph");
  const selectedAgent = useSelectedAgent();
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const agents = useRelevantAgents();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-claude-bg">
      {/* Sidebar */}
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header session={session} />

        <main className="flex-1 overflow-auto p-4">
          <ErrorBoundary>
            {activeView === "graph" && <InteractionGraph />}
            {activeView === "agents" && <AgentGrid sessionId={session?.sessionId} />}
            {activeView === "tasks" && <TaskBoard sessionId={session?.sessionId} />}
            {activeView === "timeline" && <Timeline />}
            {activeView === "monitoring" && <MonitoringView />}
          </ErrorBoundary>
        </main>
      </div>

      {/* Right panel (info + chat) */}
      {selectedAgent && (
        <ErrorBoundary>
          <RightPanel
            agent={selectedAgent}
            agents={agents}
            onClose={() => selectAgent(null)}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
