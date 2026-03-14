import { useState } from "react";
import { X } from "lucide-react";
import type { Agent } from "../../types/models";
import { fr } from "../../lib/fr";
import { useAgentStore } from "../../stores/agentStore";
import { AgentDetailContent } from "../agents/AgentDetailPanel";
import AgentChatPanel from "./AgentChatPanel";
import AgentSwitcher from "./AgentSwitcher";

interface RightPanelProps {
  agent: Agent;
  agents: Agent[];
  onClose: () => void;
}

export default function RightPanel({ agent, agents, onClose }: RightPanelProps) {
  const [mode, setMode] = useState<"info" | "chat">("info");
  const selectAgent = useAgentStore((s) => s.selectAgent);

  const handleAgentSwitch = (agentId: string) => {
    selectAgent(agentId);
  };

  const width = mode === "chat" ? "w-[480px]" : "w-80";

  return (
    <aside className={`flex ${width} flex-col border-l border-claude-border bg-claude-surface slide-in transition-all`}>
      {/* Header with tabs */}
      <div className="flex items-center justify-between border-b border-claude-border px-4 py-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMode("info")}
            className={`text-sm font-medium pb-1 transition-colors ${
              mode === "info"
                ? "text-claude-orange border-b-2 border-claude-orange"
                : "text-claude-text-secondary hover:text-claude-text"
            }`}
          >
            {fr.panel.info}
          </button>
          <button
            onClick={() => setMode("chat")}
            className={`text-sm font-medium pb-1 transition-colors ${
              mode === "chat"
                ? "text-claude-orange border-b-2 border-claude-orange"
                : "text-claude-text-secondary hover:text-claude-text"
            }`}
          >
            {fr.panel.chat}
          </button>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-claude-text-secondary transition-colors hover:bg-claude-surface-hover hover:text-claude-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Agent switcher (chat mode only) */}
      {mode === "chat" && agents.length > 1 && (
        <AgentSwitcher
          agents={agents}
          activeAgentId={agent.agentId}
          onSelect={handleAgentSwitch}
        />
      )}

      {/* Content */}
      {mode === "info" ? (
        <AgentDetailContent agent={agent} />
      ) : (
        <AgentChatPanel agent={agent} />
      )}
    </aside>
  );
}
